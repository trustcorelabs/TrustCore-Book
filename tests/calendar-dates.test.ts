import { describe, it, expect } from "vitest";
import {
  validDay,
  shiftDay,
  calendarDays,
  boundedDateRange,
  moveCalendar,
} from "@/features/calendar/dates";
describe("business calendar boundaries", () => {
  it("rejects normalized invalid dates and untrusted non-string query values", () => {
    expect(validDay("2026-02-30")).toBe(false);
    expect(validDay(["2026-10-25"] as unknown as string)).toBe(false);
    expect(() => boundedDateRange("2026-01-01", "2026-06-01", "UTC")).toThrow();
    expect(() => boundedDateRange("2026-02-02", "2026-01-01", "UTC")).toThrow();
  });
  it("uses Monday weeks, leap days and stable month navigation", () => {
    expect(calendarDays("2026-10-25", "week")[0]).toBe("2026-10-19");
    expect(calendarDays("2026-10-25", "month")).toHaveLength(42);
    expect(shiftDay("2024-02-28", 1)).toBe("2024-02-29");
    expect(moveCalendar("2026-01-31", "month", 1)).toBe("2026-02-01");
  });
  it("uses actual DST day lengths instead of adding 24 hours", () => {
    const spring = boundedDateRange(
        "2026-03-08",
        "2026-03-08",
        "America/New_York",
      ),
      fall = boundedDateRange("2026-11-01", "2026-11-01", "America/New_York");
    expect(spring.to.getTime() - spring.from.getTime()).toBe(23 * 3600000);
    expect(fall.to.getTime() - fall.from.getTime()).toBe(25 * 3600000);
  });
  it("handles midnight DST gaps and rejects a nonexistent local day", () => {
    const r = boundedDateRange("2018-11-04", "2018-11-04", "America/Sao_Paulo");
    expect(r.from.toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(() =>
      boundedDateRange("2011-12-30", "2011-12-30", "Pacific/Apia"),
    ).toThrow(/does not exist/);
  });
});
