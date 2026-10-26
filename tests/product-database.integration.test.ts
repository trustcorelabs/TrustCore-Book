import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseClient } from "@/server/repositories/database-client";
import type { TenantContext } from "@/server/authorization";
import { approvedTestDatabase } from "./development-database-target";
const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/db", () => ({
  db: () => {
    if (!holder.client) throw Error("Verified fixture database unavailable");
    return holder.client;
  },
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    NEXTAUTH_SECRET: "test-only-product-secret-not-for-production-00000",
  }),
}));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: async () => {},
  RateLimitExceededError: class extends Error {},
}));
import {
  readCalendar,
  readReportAppointments,
  readAudit,
  readCustomerHistory,
} from "@/server/repositories/insights";
import {
  insertCustomerNote,
  readCustomerNotes,
} from "@/server/repositories/customer-notes";
import { updateProfile } from "@/server/repositories/workspace";
import { insertRecord } from "@/server/repositories/workspace";
import { serviceSchema } from "@/lib/validation";
import {
  rescheduleAppointment,
  rescheduleManagedBooking,
  managedRescheduleSlots,
} from "@/server/repositories/rescheduling";
import {
  readManagedBooking,
  cancelManagedBooking,
} from "@/server/repositories/booking-management";
import {
  issueBookingCapability,
  verifyBookingCapability,
} from "@/server/booking-management-token";
import {
  businessLocalDate,
  resolveBusinessLocalTime,
} from "@/features/booking-engine/slots";
import { boundedDateRange } from "@/features/calendar/dates";
import { getPublicSlots, createPublicBooking } from "@/server/public-booking";
const url = process.env.BOOKING_TEST_DATABASE_URL,
  approved =
    process.env.BOOKING_TEST_DATABASE_VERIFIED === "YES" &&
    approvedTestDatabase(url),
  suite = approved ? describe : describe.skip,
  suffix = randomUUID();
let businessId = "",
  otherId = "",
  ownerId = "",
  memberId = "",
  staffId = "",
  serviceId = "",
  customerId = "",
  firstId = "",
  secondId = "",
  foreignCustomerId = "",
  day = "";
const scope = () =>
  ({ businessId, actorId: ownerId, role: "OWNER" }) as TenantContext;
const at = (time: string) =>
  resolveBusinessLocalTime(day, time, "Asia/Colombo")!;
suite(
  "new product workflows on independently verified disposable development only",
  () => {
    beforeAll(async () => {
      process.env.BOOKING_MVP_ENABLED = "true";
      holder.client = createDatabaseClient(url!, 5);
      const db = holder.client;
      const rows = await db.$queryRaw<
        { migration_name: string }[]
      >`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      expect(rows).toHaveLength(8);
      expect(rows.map((r) => r.migration_name)).toContain(
        "20261026010000_industry_preferences_customer_notes",
      );
      expect(rows.map((r) => r.migration_name)).toContain(
        "20261025010000_booking_product_core",
      );
      const owner = await db.user.create({
        data: {
          email: `product-owner-${suffix}@example.invalid`,
          name: "Synthetic product owner",
          passwordHash: "non-login-fixture",
        },
      });
      ownerId = owner.id;
      const member = await db.user.create({
        data: {
          email: `product-member-${suffix}@example.invalid`,
          name: "Synthetic member",
          passwordHash: "non-login-fixture",
        },
      });
      memberId = member.id;
      const b = await db.business.create({
        data: {
          name: "Synthetic product workspace",
          slug: `product-${suffix}`,
          country: "LK",
          currency: "LKR",
          timezone: "Asia/Colombo",
          members: {
            create: [
              { userId: ownerId, role: "OWNER" },
              { userId: memberId, role: "MEMBER" },
            ],
          },
        },
      });
      businessId = b.id;
      const other = await db.business.create({
        data: {
          name: "Other fixture tenant",
          slug: `product-other-${suffix}`,
          country: "LK",
          currency: "LKR",
          timezone: "Asia/Colombo",
        },
      });
      otherId = other.id;
      foreignCustomerId = (
        await db.customer.create({
          data: { businessId: otherId, name: "Foreign fixture customer" },
        })
      ).id;
      serviceId = (
        await db.service.create({
          data: {
            businessId,
            name: "Fixture service",
            durationMinutes: 30,
            price: "25",
          },
        })
      ).id;
      staffId = (
        await db.staff.create({
          data: { businessId, name: "Fixture professional" },
        })
      ).id;
      await db.staffService.create({
        data: { businessId, staffId, serviceId },
      });
      await db.availabilityRule.createMany({
        data: Array.from({ length: 7 }, (_, weekday) => ({
          businessId,
          staffId,
          weekday,
          startMinute: 0,
          endMinute: 1440,
        })),
      });
      customerId = (
        await db.customer.create({
          data: {
            businessId,
            name: "Fixture customer",
            email: `product-client-${suffix}@example.invalid`,
          },
        })
      ).id;
      day = businessLocalDate(
        new Date(Date.now() + 3 * 86400000),
        "Asia/Colombo",
      );
      for (const [key, time] of [
        ["first", "09:00"],
        ["second", "12:00"],
      ]) {
        const a = await db.appointment.create({
          data: {
            businessId,
            staffId,
            serviceId,
            customerId,
            startsAt: at(time!),
            endsAt: new Date(at(time!).getTime() + 30 * 60000),
            price: "25",
            currency: "LKR",
          },
        });
        if (key === "first") firstId = a.id;
        else secondId = a.id;
      }
      await db.auditLog.create({
        data: {
          businessId,
          actorId: ownerId,
          action: "fixture.product.created",
        },
      });
    }, 120000);
    afterAll(async () => {
      const db = holder.client;
      if (!db) return;
      for (const id of [businessId, otherId].filter(Boolean)) {
        await db.customerNote.deleteMany({ where: { businessId: id } });
        await db.bookingMutation.deleteMany({ where: { businessId: id } });
        await db.serviceComponent.deleteMany({ where: { businessId: id } });
        await db.bookingRequest.deleteMany({ where: { businessId: id } });
        await db.auditLog.deleteMany({ where: { businessId: id } });
        await db.appointment.deleteMany({ where: { businessId: id } });
        await db.customer.deleteMany({ where: { businessId: id } });
        await db.staff.deleteMany({ where: { businessId: id } });
        await db.service.deleteMany({ where: { businessId: id } });
        await db.business.delete({ where: { id } });
      }
      await db.user.deleteMany({
        where: { id: { in: [ownerId, memberId].filter(Boolean) } },
      });
      await db.$disconnect();
      delete process.env.BOOKING_MVP_ENABLED;
    }, 120000);
    it("isolates calendar, reports, customers and audit reads", async () => {
      const r = boundedDateRange(day, day, "Asia/Colombo"),
        calendar = await readCalendar(scope(), r.from, r.to),
        report = await readReportAppointments(scope(), r.from, r.to);
      expect(calendar.rows.map((a) => a.id)).toEqual([firstId, secondId]);
      expect(report.rows).toHaveLength(2);
      expect(calendar.staff.every((s) => s.id === staffId)).toBe(true);
      expect(await readCustomerHistory(scope(), foreignCustomerId)).toBeNull();
      expect(
        (await readCustomerHistory(scope(), customerId))?.appointments,
      ).toHaveLength(2);
      expect(
        (await readAudit(scope())).some(
          (a) => a.action === "fixture.product.created",
        ),
      ).toBe(true);
    });
    it("moves appointments atomically, preserves snapshot price/duration and rejects conflicts/time off", async () => {
      await holder.client!.service.update({
        where: { id: serviceId },
        data: { price: "99", durationMinutes: 45 },
      });
      await rescheduleAppointment(scope(), firstId, day, "10:00");
      const a = await holder.client!.appointment.findUniqueOrThrow({
        where: { id: firstId },
      });
      expect(a.startsAt).toEqual(at("10:00"));
      expect(a.endsAt.getTime() - a.startsAt.getTime()).toBe(30 * 60000);
      expect(a.price.toString()).toBe("25");
      await expect(
        rescheduleAppointment(scope(), firstId, day, "12:00"),
      ).rejects.toThrow();
      await holder.client!.scheduleException.create({
        data: {
          businessId,
          staffId,
          startsAt: at("13:00"),
          endsAt: at("14:00"),
        },
      });
      await expect(
        rescheduleAppointment(scope(), firstId, day, "13:00"),
      ).rejects.toThrow();
    });
    it("serializes conflicting moves and checks live manager membership", async () => {
      await expect(
        rescheduleAppointment(
          { ...scope(), actorId: memberId },
          firstId,
          day,
          "11:00",
        ),
      ).rejects.toThrow();
      const moved = await Promise.allSettled([
        rescheduleAppointment(scope(), firstId, day, "14:00"),
        rescheduleAppointment(scope(), secondId, day, "14:00"),
      ]);
      expect(moved.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(
        await holder.client!.appointment.count({
          where: {
            businessId,
            staffId,
            startsAt: at("14:00"),
            status: { not: "CANCELLED" },
          },
        }),
      ).toBe(1);
    });
    it("issues a private management capability for a real idempotent booking", async () => {
      const range = boundedDateRange(day, day, "Asia/Colombo");
      const slots = await getPublicSlots(
        {
          slug: `product-${suffix}`,
          serviceId,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          localDate: day,
        },
        "product-fixture",
      );
      expect(slots.error).toBeUndefined();
      const slot = slots.slots![0]!;
      const payload = {
        slug: `product-${suffix}`,
        serviceId,
        slotId: slot.id,
        startsAt: slot.startsAt,
        idempotencyKey: randomUUID(),
        name: "Synthetic booking client",
        email: `booking-${suffix}@example.invalid`,
        phone: "",
      };
      const a = await createPublicBooking(payload, "product-fixture"),
        b = await createPublicBooking(payload, "product-fixture");
      expect(a.success).toBe("Booking confirmed.");
      expect(b.bookingId).toBe(a.bookingId);
      const cap = verifyBookingCapability(
        a.managementToken,
        "test-only-product-secret-not-for-production-00000",
      );
      expect(cap).not.toBeNull();
      expect((await readManagedBooking(cap!))?.id).toBe(a.bookingId);
      await cancelManagedBooking(cap!);
      await cancelManagedBooking(cap!);
      expect((await readManagedBooking(cap!))?.status).toBe("CANCELLED");
      expect(
        await holder.client!.auditLog.count({
          where: {
            businessId,
            entityId: a.bookingId,
            action: "appointment.cancelled.customer",
          },
        }),
      ).toBe(1);
    });
    it("does not accept a validly signed capability rebound to a foreign tenant", async () => {
      const t = issueBookingCapability(
          otherId,
          firstId,
          "test-only-product-secret-not-for-production-00000",
        ),
        cap = verifyBookingCapability(
          t,
          "test-only-product-secret-not-for-production-00000",
        )!;
      expect(await readManagedBooking(cap)).toBeNull();
      await expect(cancelManagedBooking(cap)).rejects.toThrow();
    });

    it("enforces buffered occupancy in the database and releases it on cancellation", async () => {
      const db = holder.client!;
      const a = await db.appointment.create({
        data: {
          businessId,
          staffId,
          serviceId,
          customerId,
          startsAt: at("16:00"),
          endsAt: at("16:30"),
          bufferAfterMinutes: 15,
          price: "25",
          currency: "LKR",
        },
      });
      expect(a.occupiedEndsAt).toEqual(at("16:45"));
      const adjacent = {
        businessId,
        staffId,
        serviceId,
        customerId,
        startsAt: at("16:30"),
        endsAt: at("17:00"),
        price: "25",
        currency: "LKR",
      };
      await expect(db.appointment.create({ data: adjacent })).rejects.toThrow();
      const cap = verifyBookingCapability(
        issueBookingCapability(
          businessId,
          a.id,
          "test-only-product-secret-not-for-production-00000",
        ),
        "test-only-product-secret-not-for-production-00000",
      )!;
      await cancelManagedBooking(cap);
      expect(
        (await db.appointment.create({ data: adjacent })).startsAt,
      ).toEqual(at("16:30"));
    });
    it("serializes customer moves, rejects stale/foreign/expired links and replays exactly once", async () => {
      const db = holder.client!;
      const created = [];
      for (const time of ["17:00", "18:00"])
        created.push(
          await db.appointment.create({
            data: {
              businessId,
              staffId,
              serviceId,
              customerId,
              startsAt: at(time),
              endsAt: new Date(at(time).getTime() + 30 * 60000),
              price: "25",
              currency: "LKR",
            },
          }),
        );
      const caps = created.map((a) =>
        verifyBookingCapability(
          issueBookingCapability(
            businessId,
            a.id,
            "test-only-product-secret-not-for-production-00000",
          ),
          "test-only-product-secret-not-for-production-00000",
        )!,
      );
      const moves = created.map((a) => ({
        startsAt: at("19:00").toISOString(),
        expectedStartsAt: a.startsAt.toISOString(),
        operationKey: randomUUID(),
      }));
      const results = await Promise.allSettled(
        caps.map((cap, i) => rescheduleManagedBooking(cap, moves[i]!)),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const winner = results.findIndex((r) => r.status === "fulfilled");
      await rescheduleManagedBooking(caps[winner]!, moves[winner]!);
      expect(
        await db.auditLog.count({
          where: {
            businessId,
            entityId: created[winner]!.id,
            action: "appointment.rescheduled.customer",
          },
        }),
      ).toBe(1);
      await expect(
        rescheduleManagedBooking(caps[winner]!, {
          ...moves[winner]!,
          startsAt: at("20:00").toISOString(),
        }),
      ).rejects.toThrow();
      await expect(
        rescheduleManagedBooking(
          { ...caps[winner]!, expiresAt: Date.now() - 1 },
          { ...moves[winner]!, operationKey: randomUUID() },
        ),
      ).rejects.toThrow();
      await expect(
        rescheduleManagedBooking(
          { ...caps[winner]!, businessId: otherId },
          moves[winner]!,
        ),
      ).rejects.toThrow();
      const available = await managedRescheduleSlots(
        caps[winner]!,
        at("20:00"),
        at("22:00"),
      );
      expect(available.slots.length).toBeGreaterThan(0);
    });
    it("books a priced package with an add-on and preserves the historical quote", async () => {
      const db = holder.client!;
      const category = await db.serviceCategory.create({
        data: { businessId, name: "Synthetic package category" },
      });
      const addon = await db.service.create({
        data: {
          businessId,
          name: "Fixture extra",
          kind: "ADDON",
          durationMinutes: 10,
          price: "5",
        },
      });
      await insertRecord(scope(), {
        kind: "services",
        input: serviceSchema.parse({
          name: "Fixture bundle",
          kind: "PACKAGE",
          categoryId: category.id,
          durationMinutes: 5,
          price: "50",
          components: [{ componentId: serviceId, quantity: 2 }],
        }),
      });
      const packageRow = await db.service.findFirstOrThrow({
        where: { businessId, name: "Fixture bundle" },
      });
      expect(packageRow.durationMinutes).toBe(90);
      await db.staffService.createMany({
        data: [packageRow.id, addon.id].map((id) => ({
          businessId,
          staffId,
          serviceId: id,
        })),
      });
      const business = await db.business.findUniqueOrThrow({
        where: { id: businessId },
      });
      const available = await getPublicSlots(
        {
          slug: business.slug,
          serviceId: packageRow.id,
          addonIds: [addon.id],
          from: at("20:00").toISOString(),
          to: at("23:00").toISOString(),
          localDate: day,
        },
        "product-package",
      );
      if (!("slots" in available) || !available.slots?.length)
        throw Error("Package fixture availability failed");
      const slot = available.slots[0]!;
      const booking = await createPublicBooking(
        {
          slug: business.slug,
          serviceId: packageRow.id,
          addonIds: [addon.id],
          slotId: slot.id,
          startsAt: slot.startsAt,
          idempotencyKey: randomUUID(),
          name: "Synthetic bundle client",
          email: `bundle-${suffix}@example.invalid`,
          phone: "",
        },
        "product-package",
      );
      expect(booking.success).toBe("Booking confirmed.");
      const recorded = await db.appointment.findUniqueOrThrow({
        where: { id: booking.bookingId! },
      });
      expect(recorded.price.toString()).toBe("55");
      expect(recorded.endsAt.getTime() - recorded.startsAt.getTime()).toBe(
        100 * 60000,
      );
      await db.service.update({
        where: { id: packageRow.id },
        data: { price: "99" },
      });
      expect(
        (
          await db.appointment.findUniqueOrThrow({ where: { id: recorded.id } })
        ).price.toString(),
      ).toBe("55");
      expect(JSON.stringify(recorded.catalogSnapshot)).toContain(
        "Fixture extra",
      );
      await expect(
        db.service.create({
          data: {
            businessId: otherId,
            name: "Foreign category",
            categoryId: category.id,
            durationMinutes: 30,
            price: "5",
          },
        }),
      ).rejects.toThrow();
    });
    it("persists industry preferences without inserting sample records", async () => {
      const db = holder.client!;
      const before = await db.service.count({ where: { businessId } });
      await updateProfile(scope(), {
        name: "Synthetic tutoring fixture",
        slug: `product-${suffix}`,
        country: "LK",
        timezone: "Asia/Colombo",
        businessType: "TUTORING",
        terminologyMode: "INDUSTRY",
      });
      expect(
        await db.business.findUniqueOrThrow({ where: { id: businessId } }),
      ).toMatchObject({
        businessType: "TUTORING",
        terminologyMode: "INDUSTRY",
      });
      expect(await db.service.count({ where: { businessId } })).toBe(before);
      await expect(
        db.business.update({
          where: { id: businessId },
          data: { businessType: "INVALID" },
        }),
      ).rejects.toThrow();
    });
    it("enforces private-note tenant keys, current manager permissions and atomic audit", async () => {
      const db = holder.client!;
      const noteId = await insertCustomerNote(
        scope(),
        customerId,
        "Synthetic service preference",
      );
      expect(
        (await readCustomerNotes(scope(), customerId)).map((n) => n.id),
      ).toContain(noteId);
      await expect(
        insertCustomerNote(scope(), foreignCustomerId, "Foreign note"),
      ).rejects.toThrow();
      await expect(
        db.customerNote.create({
          data: {
            businessId,
            customerId: foreignCustomerId,
            authorId: ownerId,
            body: "Cross-tenant relation",
          },
        }),
      ).rejects.toThrow();
      await expect(
        readCustomerNotes(
          { ...scope(), actorId: memberId, role: "OWNER" } as TenantContext,
          customerId,
        ),
      ).rejects.toThrow();
      await expect(
        insertCustomerNote(
          { ...scope(), actorId: memberId, role: "OWNER" } as TenantContext,
          customerId,
          "Denied",
        ),
      ).rejects.toThrow();
      const audit = await db.auditLog.findMany({
        where: {
          businessId,
          action: "customer.note.created",
          entityId: customerId,
        },
      });
      expect(audit).toHaveLength(1);
      expect(JSON.stringify(audit)).not.toContain(
        "Synthetic service preference",
      );
    });
  },
);
