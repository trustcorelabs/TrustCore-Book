export type BookingPolicy = {
  bookingLeadMinutes: number;
  cancellationNoticeMinutes: number;
  rescheduleNoticeMinutes: number;
  bookingHorizonDays: number;
};
export const defaultBookingPolicy: BookingPolicy = {
  bookingLeadMinutes: 60,
  cancellationNoticeMinutes: 60,
  rescheduleNoticeMinutes: 60,
  bookingHorizonDays: 60,
};
export const policySelection = {
  bookingLeadMinutes: true,
  cancellationNoticeMinutes: true,
  rescheduleNoticeMinutes: true,
  bookingHorizonDays: true,
} as const;
export function inBookingWindow(
  start: Date,
  now: Date,
  policy: Pick<BookingPolicy, "bookingLeadMinutes" | "bookingHorizonDays">,
) {
  return (
    Number.isFinite(start.getTime()) &&
    start.getTime() >= now.getTime() + policy.bookingLeadMinutes * 60000 &&
    start.getTime() <= now.getTime() + policy.bookingHorizonDays * 86400000
  );
}
export function noticeAllowed(start: Date, now: Date, minutes: number) {
  return (
    Number.isFinite(start.getTime()) &&
    Number.isFinite(now.getTime()) &&
    start.getTime() >= now.getTime() + minutes * 60000
  );
}
export function bufferMinutes(value: number | undefined) {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0 || value > 180)
    throw Error("Invalid booking buffer");
  return value;
}
export function occupiedInterval(input: {
  startsAt: Date;
  endsAt: Date;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}) {
  return {
    startsAt: new Date(
      input.startsAt.getTime() -
        bufferMinutes(input.bufferBeforeMinutes) * 60000,
    ),
    endsAt: new Date(
      input.endsAt.getTime() + bufferMinutes(input.bufferAfterMinutes) * 60000,
    ),
  };
}
