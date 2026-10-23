import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
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
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  localDate: z.iso.date().optional(),
});
const bookingSchema = z.object({
  slug: slugSchema,
  serviceId: z.string().cuid(),
  slotId: z.string().regex(/^[0-9a-f]{64}$/),
  startsAt: z.iso.datetime({ offset: true }),
  idempotencyKey: z.uuid(),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254).trim().toLowerCase(),
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
) {
  return createHmac("sha256", getEnv().NEXTAUTH_SECRET)
    .update(`${businessId}:${serviceId}:${staffId}:${startsAt.toISOString()}`)
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
      ]),
    )
    .digest("hex");
}

async function schedule(
  client: Prisma.TransactionClient,
  businessId: string,
  serviceId: string,
  from: Date,
  to: Date,
) {
  const service = await client.service.findFirst({
    where: { id: serviceId, businessId, active: true },
    select: {
      id: true,
      durationMinutes: true,
      price: true,
      staff: {
        where: { staff: { active: true } },
        select: {
          staff: {
            select: {
              id: true,
              name: true,
              availability: true,
              exceptions: {
                where: {
                  unavailable: true,
                  startsAt: { lt: to },
                  endsAt: { gt: from },
                },
              },
              appointments: {
                where: {
                  status: { not: "CANCELLED" },
                  startsAt: { lt: to },
                  endsAt: { gt: from },
                },
                select: { startsAt: true, endsAt: true },
              },
            },
          },
        },
      },
    },
  });
  return service;
}

export async function getPublicSlots(input: unknown, clientId: string) {
  if (!enabled()) return { error: "Online booking is not available yet." };
  const parsed = slotRequestSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Choose a valid service and date range." };
  const { slug, serviceId } = parsed.data;
  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  const now = new Date();
  if (
    from.getTime() < now.getTime() - 60_000 ||
    to <= from ||
    to.getTime() - from.getTime() > 7 * 86400_000 ||
    to.getTime() > now.getTime() + 60 * 86400_000
  )
    return { error: "Choose up to seven days within the next 60 days." };
  try {
    await rateLimit("booking-slots:global", 600, 60);
    await rateLimit(`booking-slots:client:${clientId}`, 30, 60);
    const business = await db().business.findUnique({
      where: { slug },
      select: { id: true, timezone: true },
    });
    if (!business) return { error: "Service is unavailable." };
    const service = await schedule(
      db(),
      business.id,
      serviceId,
      from < now ? now : from,
      to,
    );
    if (!service) return { error: "Service is unavailable." };
    const slots = service.staff
      .flatMap(({ staff }) =>
        computeSlots({
          from: from < now ? now : from,
          to,
          now,
          durationMinutes: service.durationMinutes,
          timezone: business.timezone,
          rules: staff.availability,
          exceptions: staff.exceptions,
          appointments: staff.appointments,
        }).map(({ startsAt, endsAt }) => ({
          id: slotId(business.id, service.id, staff.id, startsAt),
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
      select: { id: true, timezone: true, currency: true },
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
    if (
      from.getTime() < now.getTime() + 60 * 60_000 ||
      from.getTime() > now.getTime() + 60 * 86400_000
    )
      return { error: "Choose a time within the next 60 days." };
    const result = await db().$transaction(async (tx) => {
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
        { timezone: string; currency: string }[]
      >`
        SELECT "timezone", "currency" FROM "Business" WHERE "id" = ${business.id} AND "slug" = ${data.slug} FOR SHARE
      `;
      if (!lockedBusiness[0]) throw new BookingUnavailable();
      const lockedService = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Service" WHERE "businessId" = ${business.id} AND "id" = ${data.serviceId} FOR SHARE
      `;
      if (!lockedService.length) throw new BookingUnavailable();
      const selectedService = await tx.service.findFirst({
        where: { id: data.serviceId, businessId: business.id, active: true },
        select: { durationMinutes: true },
      });
      if (!selectedService) throw new BookingUnavailable();
      const to = new Date(
        from.getTime() + selectedService.durationMinutes * 60_000,
      );
      const service = await schedule(tx, business.id, data.serviceId, from, to);
      if (!service) throw new BookingUnavailable();
      for (const { staff } of service.staff) {
        if (slotId(business.id, service.id, staff.id, from) !== data.slotId)
          continue;
        const chosen = { startsAt: from, endsAt: to };
        await tx.$queryRaw`SELECT "id" FROM "Staff" WHERE "businessId" = ${business.id} AND "id" = ${staff.id} FOR UPDATE`;
        // Re-read under the staff lock so schedule edits cannot race this check.
        const latest = await schedule(
          tx,
          business.id,
          data.serviceId,
          chosen.startsAt,
          chosen.endsAt,
        );
        const current = latest?.staff.find(
          (row) => row.staff.id === staff.id,
        )?.staff;
        if (
          !latest ||
          !current ||
          !isBookableInterval({
            ...chosen,
            timezone: lockedBusiness[0].timezone,
            rules: current.availability,
            exceptions: current.exceptions,
            appointments: current.appointments,
          })
        )
          throw new BookingUnavailable();
        const customer = await tx.customer.create({
          data: {
            businessId: business.id,
            name: data.name,
            email: data.email,
            phone: data.phone || null,
          },
        });
        const appointment = await tx.appointment.create({
          data: {
            businessId: business.id,
            staffId: staff.id,
            serviceId: service.id,
            customerId: customer.id,
            startsAt: chosen.startsAt,
            endsAt: chosen.endsAt,
            price: service.price,
            currency: lockedBusiness[0].currency,
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
        await tx.auditLog.create({
          data: {
            businessId: business.id,
            action: "appointment.booked",
            entityId: appointment.id,
          },
        });
        return appointment.id;
      }
      throw new BookingUnavailable();
    });
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
