import { expect, it } from "vitest";
import {
  computeSlots,
  isBookableInterval,
  resolveBusinessLocalTime,
} from "@/features/booking-engine/slots";
import {
  occupiedInterval,
  defaultBookingPolicy,
  inBookingWindow,
  noticeAllowed,
} from "@/features/booking-engine/policy";
import { quoteCatalog } from "@/features/booking-engine/catalog";
const at = (time: string) => new Date(`2026-10-26T${time}:00Z`);
const rules = [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }];
it("requires buffer occupancy to fit working hours and time-off boundaries", () => {
  const input = {
    timezone: "UTC",
    startsAt: at("09:00"),
    endsAt: at("09:30"),
    rules,
    exceptions: [],
    appointments: [],
    bufferBeforeMinutes: 15,
  };
  expect(isBookableInterval(input)).toBe(false);
  expect(
    isBookableInterval({
      ...input,
      startsAt: at("09:30"),
      endsAt: at("10:00"),
      bufferAfterMinutes: 15,
      exceptions: [{ startsAt: at("10:00"), endsAt: at("10:15") }],
    }),
  ).toBe(false);
  expect(
    occupiedInterval({ ...input, bufferBeforeMinutes: 10 }).startsAt,
  ).toEqual(at("08:50"));
});
it("allows exactly adjacent occupied intervals and rejects a one-minute buffer overlap", () => {
  const input = {
    timezone: "UTC",
    startsAt: at("10:00"),
    endsAt: at("10:30"),
    rules,
    exceptions: [],
    appointments: [{ startsAt: at("09:00"), endsAt: at("09:45") }],
    bufferBeforeMinutes: 15,
  };
  expect(isBookableInterval(input)).toBe(true);
  expect(isBookableInterval({ ...input, bufferBeforeMinutes: 16 })).toBe(false);
});
it("uses configured lead time and horizon in discovered slots", () => {
  const slots = computeSlots({
    from: at("09:00"),
    to: at("12:00"),
    now: at("08:00"),
    timezone: "UTC",
    rules,
    durationMinutes: 30,
    exceptions: [],
    appointments: [],
    bookingLeadMinutes: 120,
    bufferBeforeMinutes: 15,
  });
  expect(slots[0]?.startsAt).toEqual(at("10:00"));
  expect(
    inBookingWindow(at("10:00"), at("08:00"), {
      ...defaultBookingPolicy,
      bookingLeadMinutes: 120,
    }),
  ).toBe(true);
  expect(noticeAllowed(at("10:00"), at("09:01"), 60)).toBe(false);
  expect(() =>
    occupiedInterval({
      startsAt: at("10:00"),
      endsAt: at("10:30"),
      bufferAfterMinutes: -1,
    }),
  ).toThrow();
});
it("does not permit buffered appointments through a DST discontinuity", () => {
  expect(
    resolveBusinessLocalTime("2026-11-01", "01:30", "America/New_York"),
  ).toBeNull();
  expect(
    resolveBusinessLocalTime("2026-03-08", "02:30", "America/New_York"),
  ).toBeNull();
});
const base = {
  id: "base",
  name: "Cut",
  kind: "SERVICE",
  durationMinutes: 30,
  price: "10.10",
  active: true,
};
it("calculates decimal-safe add-ons and fixed-price package durations without changing source objects", () => {
  const addon = {
    ...base,
    id: "extra",
    name: "Extra",
    kind: "ADDON",
    durationMinutes: 10,
    price: "0.20",
  };
  expect(quoteCatalog(base, [addon])).toMatchObject({
    price: "10.30",
    durationMinutes: 40,
  });
  const bundle = {
    ...base,
    kind: "PACKAGE",
    price: "15.00",
    durationMinutes: 5,
  };
  const result = quoteCatalog(
    bundle,
    [addon],
    [{ component: base, quantity: 2 }],
  );
  expect(result).toMatchObject({ price: "15.20", durationMinutes: 70 });
  expect(result.snapshot[0]?.durationMinutes).toBe(60);
  expect(base.durationMinutes).toBe(30);
});
it("rejects duplicate add-ons, inactive components, nested packages and excessive duration", () => {
  const addon = { ...base, kind: "ADDON" };
  expect(() => quoteCatalog(base, [addon, addon])).toThrow();
  expect(() =>
    quoteCatalog(
      { ...base, kind: "PACKAGE" },
      [],
      [{ quantity: 1, component: { ...base, active: false } }],
    ),
  ).toThrow();
  expect(() =>
    quoteCatalog(
      { ...base, kind: "PACKAGE" },
      [],
      [{ quantity: 1, component: { ...base, kind: "PACKAGE" } }],
    ),
  ).toThrow();
  expect(() =>
    quoteCatalog({ ...base, durationMinutes: 720 }, [addon]),
  ).toThrow();
});
