import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { TenantContext } from "@/server/authorization";
import type { BookingCapability } from "@/server/booking-management-token";
import { enqueueAppointmentNotifications } from "./notification-jobs";
import { requireCurrentManager } from "./workspace";
import {
  computeSlots,
  isBookableInterval,
  resolveBusinessLocalTime,
} from "@/features/booking-engine/slots";
import {
  inBookingWindow,
  noticeAllowed,
  occupiedInterval,
  policySelection,
} from "@/features/booking-engine/policy";
type Move = {
  startsAt: string;
  expectedStartsAt: string;
  operationKey: string;
};
type Actor =
  | { kind: "manager"; scope: TenantContext }
  | { kind: "customer"; capability: BookingCapability; move: Move };
export function rescheduleAppointment(
  scope: TenantContext,
  id: string,
  localDate: string,
  localTime: string,
  now?: Date,
) {
  return moveAppointment(
    { kind: "manager", scope },
    id,
    { localDate, localTime },
    now,
  );
}
export function rescheduleManagedBooking(
  capability: BookingCapability,
  move: Move,
  now?: Date,
) {
  return moveAppointment(
    { kind: "customer", capability, move },
    capability.appointmentId,
    { startsAt: move.startsAt },
    now,
  );
}
async function moveAppointment(
  actor: Actor,
  id: string,
  target: { localDate?: string; localTime?: string; startsAt?: string },
  now?: Date,
) {
  const businessId =
    actor.kind === "manager"
      ? actor.scope.businessId
      : actor.capability.businessId;
  return db().$transaction(
    async (tx) => {
      if (actor.kind === "manager")
        await requireCurrentManager(tx, actor.scope);
      const policyRows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT "id" FROM "Business" WHERE "id"=${businessId} FOR SHARE`;
      if (!policyRows.length) throw Error("Business unavailable");
      const business = await tx.business.findUniqueOrThrow({
        where: { id: businessId },
        select: { timezone: true, ...policySelection },
      });
      const hash =
        actor.kind === "customer"
          ? createHash("sha256")
              .update(
                JSON.stringify([
                  id,
                  actor.move.startsAt,
                  actor.move.expectedStartsAt,
                ]),
              )
              .digest("hex")
          : null;
      if (actor.kind === "customer") {
        await tx.$queryRaw`SELECT true AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`move:${businessId}:${actor.move.operationKey}`},0))) AS guard`;
        const replay = await tx.bookingMutation.findUnique({
          where: {
            businessId_operationKey: {
              businessId,
              operationKey: actor.move.operationKey,
            },
          },
        });
        if (replay) {
          if (
            actor.capability.expiresAt <= (now ?? new Date()).getTime() ||
            replay.appointmentId !== id ||
            replay.payloadHash !== hash
          )
            throw Error("Invalid operation replay");
          return;
        }
      }
      const candidate = await tx.appointment.findFirst({
        where: { id, businessId },
        select: { staffId: true, serviceId: true },
      });
      if (!candidate) throw Error("Appointment unavailable");
      await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "businessId"=${businessId} AND "id"=${candidate.serviceId} FOR SHARE`;
      await tx.$queryRaw`SELECT "id" FROM "Staff" WHERE "businessId"=${businessId} AND "id"=${candidate.staffId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Appointment" WHERE "businessId"=${businessId} AND "id"=${id} FOR UPDATE`;
      const a = await tx.appointment.findFirst({ where: { id, businessId } });
      const checkedAt = now ?? new Date();
      if (
        !a ||
        a.staffId !== candidate.staffId ||
        a.serviceId !== candidate.serviceId ||
        !["PENDING", "CONFIRMED"].includes(a.status) ||
        !noticeAllowed(a.startsAt, checkedAt, business.rescheduleNoticeMinutes)
      )
        throw Error("Appointment cannot be moved");
      if (
        actor.kind === "customer" &&
        (actor.capability.expiresAt <= checkedAt.getTime() ||
          a.startsAt.toISOString() !==
            new Date(actor.move.expectedStartsAt).toISOString())
      )
        throw Error("Booking changed or link expired");
      const start = target.startsAt
        ? new Date(target.startsAt)
        : resolveBusinessLocalTime(
            target.localDate!,
            target.localTime!,
            business.timezone,
          );
      const duration = a.endsAt.getTime() - a.startsAt.getTime();
      if (
        !start ||
        duration < 5 * 60000 ||
        duration > 720 * 60000 ||
        !inBookingWindow(start, checkedAt, business)
      )
        throw Error("Invalid booking window");
      const end = new Date(start.getTime() + duration);
      const staff = await tx.staff.findFirst({
        where: {
          id: a.staffId,
          businessId,
          active: true,
          services: {
            some: {
              businessId,
              serviceId: a.serviceId,
              service: { active: true },
            },
          },
        },
        include: { availability: { where: { businessId } } },
      });
      if (!staff) throw Error("Staff/service unavailable");
      const bufferBeforeMinutes = Math.max(
          a.bufferBeforeMinutes,
          staff.bufferBeforeMinutes,
        ),
        bufferAfterMinutes = Math.max(
          a.bufferAfterMinutes,
          staff.bufferAfterMinutes,
        );
      const occupied = occupiedInterval({
        startsAt: start,
        endsAt: end,
        bufferBeforeMinutes,
        bufferAfterMinutes,
      });
      const [exceptions, conflicts] = await Promise.all([
        tx.scheduleException.findMany({
          where: {
            businessId,
            staffId: a.staffId,
            unavailable: true,
            startsAt: { lt: occupied.endsAt },
            endsAt: { gt: occupied.startsAt },
          },
        }),
        tx.appointment.findMany({
          where: {
            businessId,
            staffId: a.staffId,
            id: { not: id },
            status: { not: "CANCELLED" },
            occupiedStartsAt: { lt: occupied.endsAt },
            occupiedEndsAt: { gt: occupied.startsAt },
          },
          select: { occupiedStartsAt: true, occupiedEndsAt: true },
        }),
      ]);
      if (
        !isBookableInterval({
          startsAt: start,
          endsAt: end,
          timezone: business.timezone,
          rules: staff.availability,
          exceptions,
          appointments: conflicts.map((c) => ({
            startsAt: c.occupiedStartsAt,
            endsAt: c.occupiedEndsAt,
          })),
          bufferBeforeMinutes,
          bufferAfterMinutes,
        })
      )
        throw Error("That time is unavailable");
      if (a.startsAt.getTime() !== start.getTime()) {
        await tx.appointment.update({
          where: { businessId_id: { businessId, id } },
          data: {
            startsAt: start,
            endsAt: end,
            bufferBeforeMinutes,
            bufferAfterMinutes,
          },
        });
        const event = await tx.auditLog.create({
          data: {
            businessId,
            actorId: actor.kind === "manager" ? actor.scope.actorId : null,
            action:
              actor.kind === "manager"
                ? "appointment.rescheduled"
                : "appointment.rescheduled.customer",
            entityId: id,
          },
        });
        await enqueueAppointmentNotifications(
          tx,
          businessId,
          id,
          "RESCHEDULED",
          event.id,
        );
      }
      if (actor.kind === "customer")
        await tx.bookingMutation.create({
          data: {
            businessId,
            appointmentId: id,
            operationKey: actor.move.operationKey,
            payloadHash: hash!,
          },
        });
    },
    { timeout: 30000 },
  );
}
export async function managedRescheduleSlots(
  capability: BookingCapability,
  from: Date,
  to: Date,
) {
  const a = await db().appointment.findFirst({
    where: { id: capability.appointmentId, businessId: capability.businessId },
    include: {
      business: true,
      staff: {
        include: {
          availability: { where: { businessId: capability.businessId } },
          services: {
            where: { businessId: capability.businessId },
            select: { serviceId: true, service: { select: { active: true } } },
          },
        },
      },
    },
  });
  const now = new Date();
  if (
    !a ||
    capability.expiresAt <= now.getTime() ||
    !["PENDING", "CONFIRMED"].includes(a.status) ||
    !a.staff.active ||
    !a.staff.services.some(
      (s) => s.serviceId === a.serviceId && s.service.active,
    ) ||
    !noticeAllowed(a.startsAt, now, a.business.rescheduleNoticeMinutes)
  )
    throw Error("Rescheduling unavailable");
  const margin = 180 * 60000;
  const [exceptions, appointments] = await Promise.all([
    db().scheduleException.findMany({
      where: {
        businessId: a.businessId,
        staffId: a.staffId,
        unavailable: true,
        startsAt: { lt: new Date(to.getTime() + margin) },
        endsAt: { gt: new Date(from.getTime() - margin) },
      },
    }),
    db().appointment.findMany({
      where: {
        businessId: a.businessId,
        staffId: a.staffId,
        id: { not: a.id },
        status: { not: "CANCELLED" },
        occupiedStartsAt: { lt: new Date(to.getTime() + margin) },
        occupiedEndsAt: { gt: new Date(from.getTime() - margin) },
      },
      select: { occupiedStartsAt: true, occupiedEndsAt: true },
    }),
  ]);
  return {
    expectedStartsAt: a.startsAt.toISOString(),
    timezone: a.business.timezone,
    slots: computeSlots({
      from,
      to,
      durationMinutes: (a.endsAt.getTime() - a.startsAt.getTime()) / 60000,
      timezone: a.business.timezone,
      rules: a.staff.availability,
      exceptions,
      appointments: appointments.map((p) => ({
        startsAt: p.occupiedStartsAt,
        endsAt: p.occupiedEndsAt,
      })),
      now,
      bookingLeadMinutes: a.business.bookingLeadMinutes,
      bookingHorizonDays: a.business.bookingHorizonDays,
      bufferBeforeMinutes: Math.max(
        a.bufferBeforeMinutes,
        a.staff.bufferBeforeMinutes,
      ),
      bufferAfterMinutes: Math.max(
        a.bufferAfterMinutes,
        a.staff.bufferAfterMinutes,
      ),
    }).map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
    })),
  };
}
