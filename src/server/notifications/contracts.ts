import "server-only";
export type AppointmentNotificationKind =
  "CREATED" | "CONFIRMED" | "RESCHEDULED" | "CANCELLED" | "REMINDER";
export type AppointmentNotification = {
  kind: AppointmentNotificationKind;
  businessId: string;
  appointmentId: string;
  recipient: string;
  revision: string;
  scheduledFor: string;
};
export type NotificationResult =
  | { queued: false; reason: "delivery-not-configured" }
  | { queued: true; jobId: string };
export interface NotificationQueue {
  enqueue(message: AppointmentNotification): Promise<NotificationResult>;
}
export const disabledNotificationQueue: NotificationQueue = {
  async enqueue() {
    return { queued: false, reason: "delivery-not-configured" };
  },
};
export function notificationKey(m: AppointmentNotification) {
  if (
    !m.businessId ||
    !m.appointmentId ||
    !m.revision ||
    !Number.isFinite(Date.parse(m.scheduledFor))
  )
    throw new Error("Invalid notification identity");
  return JSON.stringify([
    m.businessId,
    m.appointmentId,
    m.kind,
    m.revision,
    m.scheduledFor,
  ]);
}
export function appointmentEmailText(input: {
  businessName: string;
  serviceName: string;
  startsAt: string;
  timezone: string;
  kind: AppointmentNotificationKind;
}) {
  const instant = new Date(input.startsAt);
  if (!Number.isFinite(instant.getTime()))
    throw new Error("Invalid appointment time");
  return [
    input.businessName,
    `Appointment ${input.kind.toLowerCase()}`,
    input.serviceName,
    new Intl.DateTimeFormat("en", {
      timeZone: input.timezone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(instant),
    `Time zone: ${input.timezone}`,
  ].join("\n");
}
// Durable job persistence, provider idempotency and retry scheduling must be
// integrated before any worker can claim delivery. No in-memory fake queue is active.

export function nextNotificationRetry(
  attempt: number,
  now: Date,
  retryAfterSeconds?: number,
) {
  if (
    !Number.isInteger(attempt) ||
    attempt < 0 ||
    attempt >= 4 ||
    !Number.isFinite(retryAfterSeconds ?? 0) ||
    !Number.isFinite(now.getTime())
  )
    return null;
  const backoff = [60, 300, 900, 3600][attempt]!;
  const delay = Math.max(
    backoff,
    Math.min(86400, Math.max(0, retryAfterSeconds ?? 0)),
  );
  return new Date(now.getTime() + delay * 1000);
}
export function reminderEligibility(input: {
  status: string;
  startsAt: Date;
  scheduledFor: Date;
  now: Date;
  consent: boolean;
}) {
  return (
    input.consent &&
    ["PENDING", "CONFIRMED"].includes(input.status) &&
    Number.isFinite(input.startsAt.getTime()) &&
    Number.isFinite(input.scheduledFor.getTime()) &&
    input.startsAt > input.now &&
    input.scheduledFor <= input.now
  );
}
