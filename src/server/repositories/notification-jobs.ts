import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  appointmentEmailText,
  nextNotificationRetry,
  type AppointmentNotificationKind,
} from "@/server/notifications/contracts";
import type { AppointmentDelivery } from "@/server/notifications/provider";
export async function enqueueAppointmentNotifications(
  tx: Prisma.TransactionClient,
  businessId: string,
  appointmentId: string,
  kind: AppointmentNotificationKind,
  eventId: string,
  now = new Date(),
) {
  if (process.env.APPOINTMENT_NOTIFICATIONS_ENABLED !== "true") return;
  const a = await tx.appointment.findFirst({
    where: { id: appointmentId, businessId },
    select: {
      startsAt: true,
      customer: { select: { appointmentEmailOptIn: true } },
    },
  });
  if (!a?.customer.appointmentEmailOptIn) return;
  const jobs = [{ kind, scheduledFor: now }];
  const reminderAt = new Date(a.startsAt.getTime() - 24 * 3600000);
  if (
    ["CREATED", "CONFIRMED", "RESCHEDULED"].includes(kind) &&
    reminderAt > now
  )
    jobs.push({ kind: "REMINDER", scheduledFor: reminderAt });
  for (const job of jobs)
    await tx.notificationJob.upsert({
      where: {
        dedupKey: createHash("sha256")
          .update(
            JSON.stringify([businessId, appointmentId, eventId, job.kind]),
          )
          .digest("hex"),
      },
      create: {
        businessId,
        appointmentId,
        kind: job.kind,
        revision: a.startsAt.toISOString(),
        scheduledFor: job.scheduledFor,
        dedupKey: createHash("sha256")
          .update(
            JSON.stringify([businessId, appointmentId, eventId, job.kind]),
          )
          .digest("hex"),
      },
      update: {},
    });
}
async function claim(now: Date, businessId?: string) {
  return db().$transaction(async (tx) => {
    await tx.notificationJob.updateMany({
      where: {
        businessId,
        state: "PROCESSING",
        attempts: { gte: 4 },
        leaseUntil: { lt: now },
      },
      data: {
        state: "DEAD",
        leaseToken: null,
        leaseUntil: null,
        errorCode: "LEASE_EXHAUSTED",
      },
    });
    const rows = await tx.$queryRaw<
      { id: string; firstAttemptAt: Date | null }[]
    >`SELECT "id", "firstAttemptAt" FROM "NotificationJob" WHERE (${businessId ?? null}::text IS NULL OR "businessId"=${businessId ?? null}) AND "attempts"<4 AND (("state" IN ('PENDING','RETRY') AND "scheduledFor"<=${now}) OR ("state"='PROCESSING' AND "leaseUntil"<${now})) ORDER BY "scheduledFor","id" FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!rows[0]) return null;
    return tx.notificationJob.update({
      where: { id: rows[0].id },
      data: {
        state: "PROCESSING",
        firstAttemptAt: rows[0].firstAttemptAt ?? now,
        leaseToken: randomUUID(),
        leaseUntil: new Date(now.getTime() + 60000),
        attempts: { increment: 1 },
      },
    });
  });
}
export async function processNotificationBatch(
  delivery: AppointmentDelivery,
  limit = 10,
  now = new Date(),
  businessId?: string,
) {
  if (
    !delivery.configured ||
    process.env.APPOINTMENT_NOTIFICATIONS_ENABLED !== "true"
  )
    return { processed: 0, sent: 0, disabled: true };
  let processed = 0,
    sent = 0;
  const started = Date.now();
  for (let i = 0; i < Math.min(25, Math.max(0, Math.floor(limit))); i++) {
    const current = new Date(now.getTime() + Date.now() - started);
    const job = await claim(current, businessId);
    if (!job) break;
    processed++;
    const a = await db().appointment.findFirst({
      where: { id: job.appointmentId, businessId: job.businessId },
      include: {
        business: { select: { name: true, timezone: true } },
        customer: { select: { appointmentEmailOptIn: true, email: true } },
        service: { select: { name: true } },
      },
    });
    const cancelled = job.kind === "CANCELLED";
    const eligible =
      a &&
      a.customer.appointmentEmailOptIn &&
      a.customer.email &&
      a.startsAt.toISOString() === job.revision &&
      (cancelled
        ? a.status === "CANCELLED"
        : ["PENDING", "CONFIRMED"].includes(a.status) && a.startsAt > current);
    let state = "SKIPPED",
      reference: string | undefined,
      errorCode: string | null = null,
      scheduledFor = job.scheduledFor;
    if (
      job.firstAttemptAt &&
      current.getTime() - job.firstAttemptAt.getTime() > 23 * 3600000
    ) {
      state = "DEAD";
      errorCode = "IDEMPOTENCY_WINDOW_EXPIRED";
    } else if (eligible && a) {
      try {
        const r = await delivery.send({
          recipient: a.customer.email!,
          idempotencyKey: job.dedupKey,
          subject: `Your appointment · ${a.business.name}`,
          text: appointmentEmailText({
            businessName: a.business.name,
            serviceName: a.serviceNameSnapshot ?? a.service.name,
            startsAt: a.startsAt.toISOString(),
            timezone: a.business.timezone,
            kind: job.kind as AppointmentNotificationKind,
          }),
        });
        if (r.delivered) {
          state = "SENT";
          reference = r.providerReference;
        } else {
          const retry = nextNotificationRetry(
            job.attempts - 1,
            current,
            r.retryAfterSeconds,
          );
          state = retry && job.attempts < 4 ? "RETRY" : "DEAD";
          scheduledFor = retry ?? job.scheduledFor;
          errorCode = "PROVIDER_UNAVAILABLE";
        }
      } catch {
        state = job.attempts < 4 ? "RETRY" : "DEAD";
        scheduledFor =
          nextNotificationRetry(job.attempts - 1, current) ?? job.scheduledFor;
        errorCode = "PROVIDER_UNAVAILABLE";
      }
    }
    await db().$transaction(async (tx) => {
      const result = await tx.notificationJob.updateMany({
        where: { id: job.id, leaseToken: job.leaseToken, state: "PROCESSING" },
        data: {
          state,
          providerReference: reference,
          errorCode,
          scheduledFor,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (result.count && state === "SENT") {
        sent++;
        await tx.auditLog.create({
          data: {
            businessId: job.businessId,
            action: "notification.sent",
            entityId: job.id,
          },
        });
      }
    });
  }
  return { processed, sent, disabled: false };
}
export function notificationStatus(businessId: string) {
  return db().notificationJob.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      kind: true,
      state: true,
      attempts: true,
      scheduledFor: true,
      errorCode: true,
      createdAt: true,
    },
  });
}
