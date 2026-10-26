import "server-only";
import { enqueueAppointmentNotifications } from "./notification-jobs";
import { db } from "@/lib/db";
import { policySelection } from "@/features/booking-engine/policy";
import type { BookingCapability } from "@/server/booking-management-token";
const publicDetails = {
  id: true,
  businessId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  price: true,
  currency: true,
  serviceNameSnapshot: true,
  customer: { select: { appointmentEmailOptIn: true } },
  business: {
    select: { name: true, slug: true, timezone: true, ...policySelection },
  },
  service: { select: { name: true } },
  staff: { select: { name: true } },
} as const;
export function receiptBusiness(appointmentId: string, slug: string) {
  return db().appointment.findFirst({
    where: { id: appointmentId, business: { slug } },
    select: { businessId: true },
  });
}
export function readManagedBooking(capability: BookingCapability) {
  return db().appointment.findFirst({
    where: { id: capability.appointmentId, businessId: capability.businessId },
    select: publicDetails,
  });
}
export async function cancelManagedBooking(
  capability: BookingCapability,
  now?: Date,
) {
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id"=${capability.businessId} FOR SHARE`;
    const policy = await tx.business.findUniqueOrThrow({
      where: { id: capability.businessId },
      select: { cancellationNoticeMinutes: true },
    });
    await tx.$queryRaw`SELECT "id" FROM "Appointment" WHERE "businessId"=${capability.businessId} AND "id"=${capability.appointmentId} FOR UPDATE`;
    const row = await tx.appointment.findFirst({
      where: {
        id: capability.appointmentId,
        businessId: capability.businessId,
      },
      select: { status: true, startsAt: true },
    });
    if (!row) throw Error("Booking unavailable");
    const checkedAt = now ?? new Date();
    if (capability.expiresAt <= checkedAt.getTime())
      throw Error("Booking link expired");
    if (row.status === "CANCELLED") return;
    if (
      !["PENDING", "CONFIRMED"].includes(row.status) ||
      row.startsAt.getTime() <
        checkedAt.getTime() + policy.cancellationNoticeMinutes * 60000
    )
      throw Error("Cancellation window closed");
    const result = await tx.appointment.updateMany({
      where: {
        id: capability.appointmentId,
        businessId: capability.businessId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startsAt: {
          gte: new Date(
            checkedAt.getTime() + policy.cancellationNoticeMinutes * 60000,
          ),
        },
      },
      data: { status: "CANCELLED" },
    });
    if (result.count !== 1) {
      const current = await tx.appointment.findFirst({
        where: {
          id: capability.appointmentId,
          businessId: capability.businessId,
        },
        select: { status: true },
      });
      if (current?.status === "CANCELLED") return;
      throw Error("Booking state changed");
    }
    const event = await tx.auditLog.create({
      data: {
        businessId: capability.businessId,
        action: "appointment.cancelled.customer",
        entityId: capability.appointmentId,
      },
    });
    await enqueueAppointmentNotifications(
      tx,
      capability.businessId,
      capability.appointmentId,
      "CANCELLED",
      event.id,
    );
  });
}

export async function changeManagedEmailPreference(
  capability: BookingCapability,
  enabled: boolean,
) {
  return db().$transaction(async (tx) => {
    const a = await tx.appointment.findFirst({
      where: {
        id: capability.appointmentId,
        businessId: capability.businessId,
      },
      select: { customerId: true },
    });
    if (!a || capability.expiresAt <= Date.now())
      throw Error("Link unavailable");
    await tx.customer.updateMany({
      where: { id: a.customerId, businessId: capability.businessId },
      data: { appointmentEmailOptIn: enabled },
    });
    await tx.auditLog.create({
      data: {
        businessId: capability.businessId,
        action: enabled
          ? "customer.notifications.opted_in"
          : "customer.notifications.opted_out",
        entityId: a.customerId,
      },
    });
  });
}
