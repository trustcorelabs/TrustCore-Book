import { businessLocalDate } from "@/features/booking-engine/slots";
export type CalendarMode = "day" | "week" | "month";
export function validDay(value: string): boolean {
  return (
    typeof value === "string" &&
    value >= "1900-01-01" &&
    value <= "2200-12-31" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function shiftDay(value: string, days: number) {
  if (!validDay(value)) throw new Error("Invalid calendar date");
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function calendarDays(anchor: string, mode: CalendarMode) {
  if (!validDay(anchor)) throw new Error("Invalid calendar date");
  if (mode === "day") return [anchor];
  const d = new Date(anchor + "T12:00:00Z");
  if (mode === "week") {
    const start = shiftDay(anchor, -((d.getUTCDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  }
  const first = anchor.slice(0, 8) + "01",
    start = shiftDay(
      first,
      -((new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7),
    );
  return Array.from({ length: 42 }, (_, i) => shiftDay(start, i));
}
export function moveCalendar(
  anchor: string,
  mode: CalendarMode,
  direction: number,
) {
  if (mode !== "month")
    return shiftDay(anchor, direction * (mode === "week" ? 7 : 1));
  const d = new Date(anchor.slice(0, 8) + "01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + direction);
  return d.toISOString().slice(0, 10);
}
/** Earliest instant belonging to a business-local day, including midnight DST jumps. */
export function startOfBusinessDay(day: string, timezone: string) {
  if (!validDay(day)) throw new Error("Invalid local date");
  const base = Date.parse(day + "T00:00:00Z");
  let lo = base - 36 * 3600000,
    hi = base + 36 * 3600000;
  while (lo < hi) {
    const middle = Math.floor((lo + hi) / 2);
    if (businessLocalDate(new Date(middle), timezone) < day) lo = middle + 1;
    else hi = middle;
  }
  const result = new Date(lo);
  if (businessLocalDate(result, timezone) !== day)
    throw new Error("This local date does not exist in the business timezone");
  return result;
}
export function boundedDateRange(
  from: string,
  to: string,
  timezone: string,
  maxDays = 93,
) {
  if (!validDay(from) || !validDay(to) || to < from)
    throw new Error("Choose valid dates");
  const days =
    (Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) /
      86400000 +
    1;
  if (days > maxDays) throw new Error(`Choose no more than ${maxDays} days`);
  return {
    from: startOfBusinessDay(from, timezone),
    to: startOfBusinessDay(shiftDay(to, 1), timezone),
  };
}
