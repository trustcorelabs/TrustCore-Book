import { describe, expect, it } from "vitest";
import {
  businessLocalDate,
  computeSlots,
  isBookableInterval,
  resolveBusinessLocalTime,
} from "@/features/booking-engine/slots";

const interval = (start: string, end: string) => ({
  startsAt: new Date(start),
  endsAt: new Date(end),
});

describe("booking slot boundaries", () => {
  it("uses the business date rather than the UTC date", () => {
    expect(
      businessLocalDate(new Date("2026-10-18T20:00:00Z"), "Asia/Colombo"),
    ).toBe("2026-10-19");
  });
  it("resolves ordinary local times and rejects DST gaps or ambiguous repeats", () => {
    expect(
      resolveBusinessLocalTime(
        "2026-10-19",
        "09:00",
        "Asia/Colombo",
      )?.toISOString(),
    ).toBe("2026-10-19T03:30:00.000Z");
    expect(
      resolveBusinessLocalTime("2027-03-14", "02:30", "America/New_York"),
    ).toBeNull();
    expect(
      resolveBusinessLocalTime("2027-11-07", "01:30", "America/New_York"),
    ).toBeNull();
  });
  it("enforces business-local weekly hours", () => {
    const rules = [{ weekday: 1, startMinute: 9 * 60, endMinute: 17 * 60 }];
    const monday = interval("2026-10-19T03:30:00Z", "2026-10-19T04:30:00Z");
    expect(
      isBookableInterval({
        ...monday,
        timezone: "Asia/Colombo",
        rules,
        exceptions: [],
        appointments: [],
      }),
    ).toBe(true);
    expect(
      isBookableInterval({
        ...interval("2026-10-19T11:00:00Z", "2026-10-19T12:00:00Z"),
        timezone: "Asia/Colombo",
        rules,
        exceptions: [],
        appointments: [],
      }),
    ).toBe(false);
  });

  it("blocks overlapping appointments and time off but permits adjacent slots", () => {
    const input = {
      ...interval("2026-10-19T09:00:00Z", "2026-10-19T09:30:00Z"),
      timezone: "UTC",
      rules: [{ weekday: 1, startMinute: 540, endMinute: 1020 }],
      exceptions: [],
      appointments: [],
    };
    expect(
      isBookableInterval({
        ...input,
        appointments: [
          interval("2026-10-19T09:30:00Z", "2026-10-19T10:00:00Z"),
        ],
      }),
    ).toBe(true);
    expect(
      isBookableInterval({
        ...input,
        appointments: [
          interval("2026-10-19T09:15:00Z", "2026-10-19T10:00:00Z"),
        ],
      }),
    ).toBe(false);
    expect(
      isBookableInterval({
        ...input,
        exceptions: [interval("2026-10-19T08:00:00Z", "2026-10-19T09:01:00Z")],
      }),
    ).toBe(false);
  });

  it("does not offer nonexistent spring-forward wall time", () => {
    const slots = computeSlots({
      from: new Date("2027-03-14T06:00:00Z"),
      to: new Date("2027-03-14T09:00:00Z"),
      now: new Date("2027-03-13T00:00:00Z"),
      durationMinutes: 30,
      timezone: "America/New_York",
      rules: [{ weekday: 0, startMinute: 60, endMinute: 240 }],
      exceptions: [],
      appointments: [],
    });
    const times = slots.map((slot) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      }).format(slot.startsAt),
    );
    expect(times).toContain("1:00 AM");
    expect(times).not.toContain("2:00 AM");
  });

  it("uses distinct UTC instants for repeated fall-back hours", () => {
    const slots = computeSlots({
      from: new Date("2027-11-07T04:00:00Z"),
      to: new Date("2027-11-07T08:00:00Z"),
      now: new Date("2027-11-06T00:00:00Z"),
      durationMinutes: 30,
      timezone: "America/New_York",
      rules: [{ weekday: 0, startMinute: 60, endMinute: 180 }],
      exceptions: [],
      appointments: [],
    });
    expect(
      slots.some(
        (slot) => slot.startsAt.toISOString() === "2027-11-07T05:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      slots.some(
        (slot) => slot.startsAt.toISOString() === "2027-11-07T06:00:00.000Z",
      ),
    ).toBe(true);
  });
  it("anchors slots to working hours rather than a UTC half-hour grid", () => {
    const slots = computeSlots({
      from: new Date("2026-10-19T00:00:00Z"),
      to: new Date("2026-10-20T00:00:00Z"),
      now: new Date("2026-10-18T00:00:00Z"),
      durationMinutes: 45,
      timezone: "Asia/Colombo",
      rules: [{ weekday: 1, startMinute: 555, endMinute: 675 }],
      exceptions: [interval("2026-10-19T03:45:00Z", "2026-10-19T04:15:00Z")],
      appointments: [],
    });
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      "2026-10-19T04:15:00.000Z",
      "2026-10-19T04:45:00.000Z",
    ]);
  });
  it("offers intervals ending at local midnight and enforces the one-hour lead time", () => {
    const slots = computeSlots({
      from: new Date("2026-10-19T22:00:00Z"),
      to: new Date("2026-10-20T00:00:00Z"),
      now: new Date("2026-10-19T22:00:00Z"),
      durationMinutes: 30,
      timezone: "UTC",
      rules: [{ weekday: 1, startMinute: 1320, endMinute: 1440 }],
      exceptions: [],
      appointments: [],
    });
    expect(slots.map((slot) => slot.startsAt.toISOString())).toEqual([
      "2026-10-19T23:00:00.000Z",
      "2026-10-19T23:30:00.000Z",
    ]);
  });
});
