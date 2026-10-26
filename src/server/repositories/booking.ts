import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { quoteCatalog } from "@/features/booking-engine/catalog";
import {
  policySelection,
  inBookingWindow,
} from "@/features/booking-engine/policy";
import { enqueueAppointmentNotifications } from "./notification-jobs";
import { rateLimit, RateLimitExceededError } from "../rate-limit";
import {
  businessLocalDate,
  computeSlots,
  isBookableInterval,
} from "@/features/booking-engine/slots";

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(3)
  .max(60);
const slotRequestSchema = z.object({
  slug: slugSchema,
  serviceId: z.string().cuid(),
  addonIds: z
    .array(z.string().cuid())
    .max(6)
    .default([])
    .transform((ids) => [...new Set(ids)].sort()),
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  localDate: z.iso.date().optional(),
});
const bookingSchema = z.object({
  slug: slugSchema,
  serviceId: z.string().cuid(),
  addonIds: z
    .array(z.string().cuid())
    .max(6)
    .default([])
    .transform((ids) => [...new Set(ids)].sort()),
  slotId: z.string().regex(/^[0-9a-f]{64}$/),
  startsAt: z.iso.datetime({ offset: true }),
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254).trim().toLowerCase(),
  emailOptIn: z.boolean().default(false),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || /^\+?[0-9 ()-]{6,30}$/.test(v)),
});
type BookingInput = z.infer<typeof bookingSchema>;

function enabled() {
  return process.env.BOOKING_MVP_ENABLED === "true";
}

function slotId(
  businessId: string,
  serviceId: string,
  staffId: string,
  startsAt: Date,
  addonIds: string[] = [],
) {
  return createHmac("sha256", getEnv().NEXTAUTH_SECRET)
    .update(
      `${businessId}:${serviceId}:${staffId}:${startsAt.toISOString()}:${addonIds.join(",")}`,
    )
    .digest("hex");
}

function payloadHash(input: BookingInput) {
  return createHmac("sha256", getEnv().NEXTAUTH_SECRET)
    .update(
      JSON.stringify([
        input.slug,
        input.serviceId,
        input.slotId,
        input.startsAt,
        input.name,
        input.email,
        input.phone,
        input.addonIds,
        input.emailOptIn,
      ]),
    )
    .digest("hex");
}

async function readCatalog(
  client: Prisma.TransactionClient,
  businessId: string,
  serviceId: string,
  addonIds: string[],
) {
  const service = await client.service.findFirst({
    where: {
      id: serviceId,
      businessId,
      active: true,
      kind: { in: ["SERVICE", "PACKAGE"] },
    },
    include: {
      components: { where: { businessId }, include: { component: true } },
      staff: { where: { businessId }, select: { staffId: true } },
    },
  });
  if (!service) return null;
  const addons = addonIds.length
    ? await client.service.findMany({
        where: {
          businessId,
          id: { in: addonIds },
          active: true,
          kind: "ADDON",
        },
        orderBy: { id: "asc" },
      })
    : [];
  if (addons.length !== addonIds.length) return null;
  return {
    ...service,
    ...quoteCatalog(service, addons, service.components),
    bufferBeforeMinutes: Math.max(
      service.bufferBeforeMinutes,
      ...addons.map((a) => a.bufferBeforeMinutes),
    ),
    bufferAfterMinutes: Math.max(
      service.bufferAfterMinutes,
      ...addons.map((a) => a.bufferAfterMinutes),
    ),
  };
}
async function schedule(
  client: Prisma.TransactionClient,
  businessId: string,
  serviceId: string,
  from: Date,
  to: Date,
  addonIds: string[] = [],
) {
  const catalog = await readCatalog(client, businessId, serviceId, addonIds);
  if (!catalog) return null;
  const margin = 180 * 60000;
  const staff = await client.staff.findMany({
    where: {
      businessId,
      active: true,
      AND: [serviceId, ...addonIds].map((id) => ({
        services: { some: { businessId, serviceId: id } },
      })),
    },
    select: {
      id: true,
      name: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
      availability: { where: { businessId } },
      exceptions: {
        where: {
          businessId,
          unavailable: true,
          startsAt: { lt: new Date(to.getTime() + margin) },
          endsAt: { gt: new Date(from.getTime() - margin) },
        },
      },
      appointments: {
        where: {
          businessId,
          status: { not: "CANCELLED" },
          occupiedStartsAt: { lt: new Date(to.getTime() + margin) },
          occupiedEndsAt: { gt: new Date(from.getTime() - margin) },
        },
        select: { occupiedStartsAt: true, occupiedEndsAt: true },
      },
    },
  });
  return {
    ...catalog,
    staff: staff.map((row) => ({
      staff: {
        ...row,
        appointments: row.appointments.map((a) => ({
          startsAt: a.occupiedStartsAt,
          endsAt: a.occupiedEndsAt,
        })),
      },
    })),
  };
}

export async function getPublicSlots(input: unknown, clientId: string) {
  if (!enabled()) return { error: "Online booking is not available yet." };
  const parsed = slotRequestSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Choose a valid service and date range." };
  const { slug, serviceId, addonIds } = parsed.data;
  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  const now = new Date();
  if (
    from.getTime() < now.getTime() - 60_000 ||
    to <= from ||
    to.getTime() - from.getTime() > 7 * 86400_000 ||
    to.getTime() > now.getTime() + 181 * 86400_000
  )
    return { error: "Choose up to seven days within the next 60 days." };
  try {
    await rateLimit("booking-slots:global", 600, 60);
    await rateLimit(`booking-slots:client:${clientId}`, 30, 60);
    const business = await db().business.findUnique({
      where: { slug },
      select: { id: true, timezone: true, ...policySelection },
    });
    if (!business) return { error: "Service is unavailable." };
    const service = await schedule(
      db(),
      business.id,
      serviceId,
      from < now ? now : from,
      to,
      addonIds,
    );
    if (!service) return { error: "Service is unavailable." };
    const slots = service.staff
      .flatMap(({ staff }) =>
        computeSlots({
          from: from < now ? now : from,
          to,
          now,
          durationMinutes: service.durationMinutes,
          bookingLeadMinutes: business.bookingLeadMinutes,
          bookingHorizonDays: business.bookingHorizonDays,
          bufferBeforeMinutes: Math.max(
            service.bufferBeforeMinutes,
            staff.bufferBeforeMinutes,
          ),
          bufferAfterMinutes: Math.max(
            service.bufferAfterMinutes,
            staff.bufferAfterMinutes,
          ),
          timezone: business.timezone,
          rules: staff.availability,
          exceptions: staff.exceptions,
          appointments: staff.appointments,
        }).map(({ startsAt, endsAt }) => ({
          id: slotId(business.id, service.id, staff.id, startsAt, addonIds),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          staffName: staff.name,
        })),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const selected = parsed.data.localDate
      ? slots.filter(
          (slot) =>
            businessLocalDate(new Date(slot.startsAt), business.timezone) ===
            parsed.data.localDate,
        )
      : slots;
    return { slots: selected.slice(0, 500) };
  } catch (error) {
    return {
      error:
        error instanceof RateLimitExceededError
          ? "Too many requests. Try again later."
          : "Availability is temporarily unavailable.",
    };
  }
}

export async function createPublicBooking(input: unknown, clientId: string) {
  if (!enabled()) return { error: "Online booking is not available yet." };
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { error: "Check your booking details." };
  const data = parsed.data;
  const hash = payloadHash(data);
  try {
    await rateLimit("public-booking-create:global", 300, 60);
    await rateLimit(`public-booking-create:client:${clientId}`, 6, 60);
    await rateLimit(`public-booking-create:${data.email}`, 5, 3600);
    const business = await db().business.findUnique({
      where: { slug: data.slug },
      select: { id: true, timezone: true, currency: true, ...policySelection },
    });
    if (!business) return { error: "Service is unavailable." };
    const existing = await db().bookingRequest.findUnique({
      where: {
        businessId_idempotencyKey: {
          businessId: business.id,
          idempotencyKey: data.idempotencyKey,
        },
      },
    });
    if (existing)
      return existing.payloadHash === hash
        ? { success: "Booking confirmed.", bookingId: existing.appointmentId }
        : {
            error:
              "This booking request was already used for different details.",
          };
    const now = new Date();
    const from = new Date(data.startsAt);
    if (!inBookingWindow(from, now, business))
      return { error: "Choose a time within this business's booking policy." };
    const result = await db().$transaction(
      async (tx) => {
        // Serialize identical requests before availability checks. A second caller
        // must receive the committed result even when its slot is now occupied.
        await tx.$queryRaw`SELECT true AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`booking:${business.id}:${data.idempotencyKey}`}, 0))) AS guard`;
        const replay = await tx.bookingRequest.findUnique({
          where: {
            businessId_idempotencyKey: {
              businessId: business.id,
              idempotencyKey: data.idempotencyKey,
            },
          },
        });
        if (replay) {
          if (replay.payloadHash !== hash) throw new BookingRequestConflict();
          return replay.appointmentId;
        }
        const lockedBusiness = await tx.$queryRaw<
          {
            timezone: string;
            currency: string;
            bookingLeadMinutes: number;
            bookingHorizonDays: number;
          }[]
        >`
        SELECT "timezone", "currency", "bookingLeadMinutes", "bookingHorizonDays" FROM "Business" WHERE "id" = ${business.id} AND "slug" = ${data.slug} FOR SHARE
      `;
        if (!lockedBusiness[0]) throw new BookingUnavailable();
        const lockedService = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Service" WHERE "businessId" = ${business.id} AND "id" = ${data.serviceId} FOR SHARE
      `;
        if (!lockedService.length) throw new BookingUnavailable();
        const preview = await readCatalog(
          tx,
          business.id,
          data.serviceId,
          data.addonIds,
        );
        if (!preview) throw new BookingUnavailable();
        const catalogIds = [
          ...new Set([
            data.serviceId,
            ...data.addonIds,
            ...preview.components.map((c) => c.componentId),
          ]),
        ].sort();
        for (const id of catalogIds)
          await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "businessId"=${business.id} AND "id"=${id} FOR SHARE`;
        const selectedService = await readCatalog(
          tx,
          business.id,
          data.serviceId,
          data.addonIds,
        );
        if (!selectedService) throw new BookingUnavailable();
        const to = new Date(
          from.getTime() + selectedService.durationMinutes * 60_000,
        );
        // Only candidate IDs are needed before acquiring the staff lock. Loading
        // the full schedule here duplicated every relation query and extended the
        // transaction without providing the authoritative availability check.
        for (const { staffId } of selectedService.staff) {
          if (
            slotId(
              business.id,
              selectedService.id,
              staffId,
              from,
              data.addonIds,
            ) !== data.slotId
          )
            continue;
          const chosen = { startsAt: from, endsAt: to };
          await tx.$queryRaw`SELECT "id" FROM "Staff" WHERE "businessId" = ${business.id} AND "id" = ${staffId} FOR UPDATE`;
          // Re-read under the staff lock so schedule edits cannot race this check.
          const latest = await schedule(
            tx,
            business.id,
            data.serviceId,
            chosen.startsAt,
            chosen.endsAt,
            data.addonIds,
          );
          const current = latest?.staff.find(
            (row) => row.staff.id === staffId,
          )?.staff;
          if (
            !latest ||
            !current ||
            !inBookingWindow(from, new Date(), lockedBusiness[0]) ||
            !isBookableInterval({
              ...chosen,
              timezone: lockedBusiness[0].timezone,
              rules: current.availability,
              exceptions: current.exceptions,
              appointments: current.appointments,
              bufferBeforeMinutes: Math.max(
                latest.bufferBeforeMinutes,
                current.bufferBeforeMinutes,
              ),
              bufferAfterMinutes: Math.max(
                latest.bufferAfterMinutes,
                current.bufferAfterMinutes,
              ),
            })
          )
            throw new BookingUnavailable();
          const customer = await tx.customer.create({
            data: {
              businessId: business.id,
              name: data.name,
              email: data.email,
              phone: data.phone || null,
              appointmentEmailOptIn: data.emailOptIn,
            },
          });
          const appointment = await tx.appointment.create({
            data: {
              businessId: business.id,
              staffId,
              serviceId: latest.id,
              customerId: customer.id,
              startsAt: chosen.startsAt,
              endsAt: chosen.endsAt,
              price: latest.price,
              currency: lockedBusiness[0].currency,
              serviceNameSnapshot: latest.name,
              catalogSnapshot: latest.snapshot,
              bufferBeforeMinutes: Math.max(
                latest.bufferBeforeMinutes,
                current.bufferBeforeMinutes,
              ),
              bufferAfterMinutes: Math.max(
                latest.bufferAfterMinutes,
                current.bufferAfterMinutes,
              ),
              status: "CONFIRMED",
            },
          });
          await tx.bookingRequest.create({
            data: {
              businessId: business.id,
              idempotencyKey: data.idempotencyKey,
              payloadHash: hash,
              appointmentId: appointment.id,
            },
          });
          const event = await tx.auditLog.create({
            data: {
              businessId: business.id,
              action: "appointment.booked",
              entityId: appointment.id,
            },
          });
          await enqueueAppointmentNotifications(
            tx,
            business.id,
            appointment.id,
            "CONFIRMED",
            event.id,
          );
          return appointment.id;
        }
        throw new BookingUnavailable();
      },
      {
        // Rehearsal measured P2028 after 16.5s of execution with fast acquisition.
        // Booking includes serialized replays, locked schedule reads and four
        // atomic writes; give this longer operation a bounded execution budget.
        timeout: 30_000,
      },
    );
    return { success: "Booking confirmed.", bookingId: result };
  } catch (error) {
    const constraintConflict =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" ||
        error.code === "P2004" ||
        (error.code === "P2010" && error.meta?.code === "23P01"));
    if (constraintConflict || error instanceof BookingUnavailable) {
      const business = await db().business.findUnique({
        where: { slug: data.slug },
        select: { id: true },
      });
      const existing =
        business &&
        (await db().bookingRequest.findUnique({
          where: {
            businessId_idempotencyKey: {
              businessId: business.id,
              idempotencyKey: data.idempotencyKey,
            },
          },
        }));
      if (existing)
        return existing.payloadHash === hash
          ? { success: "Booking confirmed.", bookingId: existing.appointmentId }
          : {
              error:
                "This booking request was already used for different details.",
            };
    }
    if (error instanceof BookingRequestConflict)
      return {
        error: "This booking request was already used for different details.",
      };
    if (error instanceof RateLimitExceededError)
      return { error: "Too many requests. Try again later." };
    if (error instanceof BookingUnavailable || constraintConflict)
      return {
        error: "That time is no longer available. Choose another slot.",
      };
    return { error: "Booking is temporarily unavailable. Please try again." };
  }
}

class BookingUnavailable extends Error {}

class BookingRequestConflict extends Error {}
