import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseClient } from "@/server/repositories/database-client";
import {
  createStaffTimeOff,
  replaceStaffSchedule,
  transitionAppointment,
} from "@/server/repositories/workspace";
import type { TenantContext } from "@/server/authorization";
import { approvedTestDatabase } from "./development-database-target";

const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/db", () => ({
  db: () => {
    if (!holder.client)
      throw new Error("Disposable booking database unavailable");
    return holder.client;
  },
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    NEXTAUTH_SECRET: "booking-test-only-secret-never-for-production",
  }),
}));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: async () => {},
  RateLimitExceededError: class extends Error {},
}));
import {
  createPublicBooking as createBooking,
  getPublicSlots as loadSlots,
} from "@/server/public-booking";

const getPublicSlots = (input: Parameters<typeof loadSlots>[0]) =>
  loadSlots(input, "verified-disposable-test-client");
const createPublicBooking = (input: Parameters<typeof createBooking>[0]) =>
  createBooking(input, "verified-disposable-test-client");

const url = process.env.BOOKING_TEST_DATABASE_URL;
const approved =
  process.env.BOOKING_TEST_DATABASE_VERIFIED === "YES" &&
  !!url &&
  approvedTestDatabase(url);
const suite = approved ? describe : describe.skip;
const suffix = randomUUID();
const slug = `booking-test-${suffix}`;
let businessId = "";
let serviceId = "";
let staffId = "";
let ownerId = "";
let otherBusinessId = "";
let otherServiceId = "";
const scope = () =>
  ({ businessId, actorId: ownerId, role: "OWNER" }) as TenantContext;
let selectedSlot: { id: string; startsAt: string };

suite("booking persistence on externally verified disposable Neon only", () => {
  beforeAll(async () => {
    process.env.BOOKING_MVP_ENABLED = "true";
    holder.client = createDatabaseClient(url!, 5);
    const migrations = await holder.client.$queryRaw<
      { migration_name: string }[]
    >`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    const applied = new Set(migrations.map((row) => row.migration_name));
    for (const required of [
      "20261018000000_initial",
      "20261018010000_phase_a1_identity",
      "20261019010000_phase_a2_invitations",
      "20261019020000_phase_a2_final_owner_guard",
      "20261019030000_booking_idempotency",
    ])
      if (!applied.has(required))
        throw new Error(`Disposable-test migration missing: ${required}`);
    const business = await holder.client.business.create({
      data: {
        name: "Booking integration test",
        slug,
        country: "LK",
        currency: "LKR",
        timezone: "Asia/Colombo",
      },
    });
    businessId = business.id;
    const owner = await holder.client.user.create({
      data: {
        name: "Integration Owner",
        email: `owner-${suffix}@example.test`,
        passwordHash: "test-only-hash",
      },
    });
    ownerId = owner.id;
    await holder.client.businessMember.create({
      data: { businessId, userId: ownerId, role: "OWNER" },
    });
    const other = await holder.client.business.create({
      data: {
        name: "Other tenant",
        slug: `other-${suffix}`,
        country: "LK",
        currency: "LKR",
        timezone: "Asia/Colombo",
      },
    });
    otherBusinessId = other.id;
    const foreignService = await holder.client.service.create({
      data: {
        businessId: other.id,
        name: "Foreign",
        durationMinutes: 30,
        price: "1",
      },
    });
    otherServiceId = foreignService.id;
    const service = await holder.client.service.create({
      data: {
        businessId,
        name: "Test service",
        durationMinutes: 30,
        price: "25.00",
      },
    });
    serviceId = service.id;
    const staff = await holder.client.staff.create({
      data: { businessId, name: "Test staff" },
    });
    staffId = staff.id;
    await holder.client.staffService.create({
      data: { businessId, serviceId, staffId: staff.id },
    });
    await holder.client.availabilityRule.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        businessId,
        staffId: staff.id,
        weekday,
        startMinute: 0,
        endMinute: 1440,
      })),
    });
    const from = new Date(Date.now() + 2 * 86400_000);
    const to = new Date(from.getTime() + 86400_000);
    const slots = await getPublicSlots({
      slug,
      serviceId,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (!("slots" in slots) || !slots.slots?.length)
      throw new Error("Disposable test schedule yielded no slots");
    selectedSlot = slots.slots[0]!;
  });

  afterAll(async () => {
    if (!holder.client) return;
    try {
      if (businessId) {
        await holder.client.bookingRequest.deleteMany({
          where: { businessId },
        });
        await holder.client.appointment.deleteMany({ where: { businessId } });
        await holder.client.auditLog.deleteMany({ where: { businessId } });
        await holder.client.business.deleteMany({ where: { id: businessId } });
      }
      if (otherBusinessId)
        await holder.client.business.delete({ where: { id: otherBusinessId } });
      if (ownerId) await holder.client.user.delete({ where: { id: ownerId } });
    } finally {
      await holder.client.$disconnect();
      holder.client = null;
      delete process.env.BOOKING_MVP_ENABLED;
    }
  });

  it("returns the same appointment on an identical idempotency replay and rejects changed details", async () => {
    const request = {
      slug,
      serviceId,
      slotId: selectedSlot.id,
      startsAt: selectedSlot.startsAt,
      idempotencyKey: randomUUID(),
      name: "Booking Test",
      email: `test-${suffix}@example.test`,
      phone: "",
    };
    const first = await createPublicBooking(request);
    expect(first.success).toBe("Booking confirmed.");
    const second = await createPublicBooking(request);
    expect(second.bookingId).toBe(first.bookingId);
    const changed = await createPublicBooking({
      ...request,
      name: "Different Name",
    });
    expect(changed.error).toMatch(/already used/);
    expect(
      await holder.client!.appointment.count({
        where: { businessId, id: first.bookingId },
      }),
    ).toBe(1);
  });

  it("allows only one concurrent booking for the same staff interval", async () => {
    const slots = await getPublicSlots({
      slug,
      serviceId,
      from: new Date(
        Date.parse(selectedSlot.startsAt) + 3_600_000,
      ).toISOString(),
      to: new Date(Date.parse(selectedSlot.startsAt) + 7_200_000).toISOString(),
    });
    if (!("slots" in slots) || !slots.slots?.length)
      throw new Error("No second test slot");
    const slot = slots.slots[0]!;
    const base = {
      slug,
      serviceId,
      slotId: slot.id,
      startsAt: slot.startsAt,
      name: "Concurrent Test",
      email: `race-${suffix}@example.test`,
      phone: "",
    };
    const attempts = await Promise.all([
      createPublicBooking({ ...base, idempotencyKey: randomUUID() }),
      createPublicBooking({ ...base, idempotencyKey: randomUUID() }),
    ]);
    expect(attempts.filter((result) => result.success)).toHaveLength(1);
    expect(attempts.filter((result) => result.error)).toHaveLength(1);
    expect(attempts.find((result) => result.error)?.error).toMatch(
      /no longer available/,
    );
  });

  it("returns one booking for concurrent identical idempotency keys", async () => {
    const slots = await getPublicSlots({
      slug,
      serviceId,
      from: new Date(
        Date.parse(selectedSlot.startsAt) + 8 * 3_600_000,
      ).toISOString(),
      to: new Date(
        Date.parse(selectedSlot.startsAt) + 12 * 3_600_000,
      ).toISOString(),
    });
    if (!("slots" in slots) || !slots.slots?.length)
      throw new Error("No same-key test slot");
    const slot = slots.slots[0]!;
    const idempotencyKey = randomUUID();
    const request = {
      slug,
      serviceId,
      slotId: slot.id,
      startsAt: slot.startsAt,
      idempotencyKey,
      name: "Same Key Test",
      email: `same-key-${suffix}@example.test`,
      phone: "",
    };
    const attempts = await Promise.all([
      createPublicBooking(request),
      createPublicBooking(request),
    ]);
    expect(attempts[0].success).toBe("Booking confirmed.");
    expect(attempts[1].success).toBe("Booking confirmed.");
    expect(attempts[0].bookingId).toBe(attempts[1].bookingId);
    expect(
      await holder.client!.bookingRequest.count({
        where: { businessId, idempotencyKey },
      }),
    ).toBe(1);
  });
  async function freshSlot(hours = 16) {
    const from = new Date(Date.parse(selectedSlot.startsAt) + hours * 3600000);
    const result = await getPublicSlots({
      slug,
      serviceId,
      from: from.toISOString(),
      to: new Date(from.getTime() + 4 * 3600000).toISOString(),
    });
    if (!result.slots?.length) throw new Error("Fixture has no fresh slot");
    return result.slots[0]!;
  }
  function request(slot: { id: string; startsAt: string }) {
    return {
      slug,
      serviceId,
      slotId: slot.id,
      startsAt: slot.startsAt,
      idempotencyKey: randomUUID(),
      name: "Isolation Customer",
      email: `isolation-${suffix}@example.test`,
      phone: "",
    };
  }
  it("rejects cross-tenant services and forged slot tokens without creating customers", async () => {
    const slot = await freshSlot();
    const before = await holder.client!.customer.count({
      where: { businessId },
    });
    expect(
      (
        await getPublicSlots({
          slug,
          serviceId: otherServiceId,
          from: slot.startsAt,
          to: new Date(Date.parse(slot.startsAt) + 3600000).toISOString(),
        })
      ).error,
    ).toBe("Service is unavailable.");
    expect(
      (
        await createPublicBooking({
          ...request(slot),
          serviceId: otherServiceId,
        })
      ).error,
    ).toMatch(/no longer available/);
    expect(
      (await createPublicBooking({ ...request(slot), slotId: "0".repeat(64) }))
        .error,
    ).toMatch(/no longer available/);
    expect(await holder.client!.customer.count({ where: { businessId } })).toBe(
      before,
    );
  });
  it("rechecks time off at confirmation and rejects staff mutations from another tenant", async () => {
    const slot = await freshSlot();
    await expect(
      createStaffTimeOff(
        { ...scope(), businessId: otherBusinessId },
        staffId,
        new Date(slot.startsAt),
        new Date(slot.endsAt),
      ),
    ).rejects.toThrow();
    await createStaffTimeOff(
      scope(),
      staffId,
      new Date(slot.startsAt),
      new Date(slot.endsAt),
    );
    expect((await createPublicBooking(request(slot))).error).toMatch(
      /no longer available/,
    );
    const result = await getPublicSlots({
      slug,
      serviceId,
      from: slot.startsAt,
      to: new Date(Date.parse(slot.startsAt) + 3600000).toISOString(),
    });
    expect(result.slots?.some((item) => item.id === slot.id)).toBe(false);
  });
  it("rechecks service/staff active state and assignments for previously offered slots", async () => {
    const slot = await freshSlot(24);
    await holder.client!.service.update({
      where: { id: serviceId },
      data: { active: false },
    });
    expect((await createPublicBooking(request(slot))).error).toMatch(
      /no longer available/,
    );
    await holder.client!.service.update({
      where: { id: serviceId },
      data: { active: true },
    });
    await holder.client!.staff.update({
      where: { id: staffId },
      data: { active: false },
    });
    expect((await createPublicBooking(request(slot))).error).toMatch(
      /no longer available/,
    );
    await holder.client!.staff.update({
      where: { id: staffId },
      data: { active: true },
    });
    await replaceStaffSchedule(scope(), { staffId, serviceIds: [], rules: [] });
    expect((await createPublicBooking(request(slot))).error).toMatch(
      /no longer available/,
    );
    await replaceStaffSchedule(scope(), {
      staffId,
      serviceIds: [serviceId],
      rules: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        startMinute: 0,
        endMinute: 1440,
      })),
    });
  });
  it("stores server prices, blocks conflicting time off, isolates status changes and releases cancellations", async () => {
    const slot = await freshSlot(30);
    const result = await createPublicBooking({
      ...request(slot),
      price: "0",
      businessId: otherBusinessId,
    });
    expect(result.success).toBe("Booking confirmed.");
    const appointment = await holder.client!.appointment.findUniqueOrThrow({
      where: { id: result.bookingId },
    });
    expect(appointment.price.toString()).toBe("25");
    expect(appointment.businessId).toBe(businessId);
    await expect(
      createStaffTimeOff(
        scope(),
        staffId,
        appointment.startsAt,
        appointment.endsAt,
      ),
    ).rejects.toThrow(/conflicts/);
    await expect(
      transitionAppointment(
        { ...scope(), businessId: otherBusinessId },
        appointment.id,
        "CANCELLED",
      ),
    ).rejects.toThrow();
    await transitionAppointment(scope(), appointment.id, "CANCELLED");
    const slots = await getPublicSlots({
      slug,
      serviceId,
      from: slot.startsAt,
      to: new Date(Date.parse(slot.startsAt) + 3600000).toISOString(),
    });
    expect(slots.slots?.some((item) => item.id === slot.id)).toBe(true);
    await expect(
      transitionAppointment(scope(), appointment.id, "COMPLETED"),
    ).rejects.toThrow(/already closed/);
  });
  it("confirms a pending appointment and retains completed/no-show intervals as occupied", async () => {
    for (const [hours, status] of [
      [36, "COMPLETED"],
      [40, "NO_SHOW"],
    ] as const) {
      const slot = await freshSlot(hours);
      const result = await createPublicBooking(request(slot));
      expect(result.success).toBe("Booking confirmed.");
      await holder.client!.appointment.update({
        where: { id: result.bookingId },
        data: { status: "PENDING" },
      });
      await transitionAppointment(scope(), result.bookingId!, "CONFIRMED");
      await transitionAppointment(scope(), result.bookingId!, status);
      const slots = await getPublicSlots({
        slug,
        serviceId,
        from: slot.startsAt,
        to: new Date(Date.parse(slot.startsAt) + 3600000).toISOString(),
      });
      expect(slots.slots?.some((item) => item.id === slot.id)).toBe(false);
    }
  });
  it("rolls back customers, appointments and replay records if the final audit write fails", async () => {
    const slot = await freshSlot(44);
    const original = holder.client!;
    const before = await Promise.all([
      original.customer.count({ where: { businessId } }),
      original.appointment.count({ where: { businessId } }),
      original.bookingRequest.count({ where: { businessId } }),
    ]);
    holder.client = original.$extends({
      query: {
        auditLog: {
          async create() {
            throw new Error("Injected final write failure");
          },
        },
      },
    }) as unknown as PrismaClient;
    try {
      expect((await createPublicBooking(request(slot))).error).toMatch(
        /temporarily unavailable/,
      );
    } finally {
      holder.client = original;
    }
    const after = await Promise.all([
      original.customer.count({ where: { businessId } }),
      original.appointment.count({ where: { businessId } }),
      original.bookingRequest.count({ where: { businessId } }),
    ]);
    expect(after).toEqual(before);
  });
});
