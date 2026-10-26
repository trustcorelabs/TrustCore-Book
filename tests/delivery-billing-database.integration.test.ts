import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/server/authorization";
import { createDatabaseClient } from "@/server/repositories/database-client";
import { approvedTestDatabase } from "./development-database-target";
const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/db", () => ({
  db: () => {
    if (!holder.client) throw Error("Verified fixture database required");
    return holder.client;
  },
}));
import {
  enqueueAppointmentNotifications,
  processNotificationBatch,
} from "@/server/repositories/notification-jobs";
import {
  applySandboxPaymentEvent,
  beginSandboxPayment,
  bindSandboxCheckout,
  cancelSandboxTrial,
  requestSandboxRefund,
  startSandboxTrial,
  assertCatalogEntitlement,
} from "@/server/repositories/billing";
import { effectivePlan } from "@/features/billing/policy";
const url = process.env.BOOKING_TEST_DATABASE_URL;
const suite =
  process.env.BOOKING_TEST_DATABASE_VERIFIED === "YES" &&
  approvedTestDatabase(url)
    ? describe
    : describe.skip;
const tag = randomUUID();
let businessId = "",
  otherId = "",
  ownerId = "",
  appointmentId = "",
  customerId = "",
  serviceId = "",
  staffId = "",
  paymentId = "";
const scope = () =>
  ({ businessId, actorId: ownerId, role: "OWNER" }) as TenantContext;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const sent = vi.fn(async (message: { recipient: string }) => {
  if (message.recipient !== `delivery-${tag}@example.invalid`)
    throw Error("Non-fixture recipient blocked");
  return { delivered: true, providerReference: "synthetic-provider-reference" };
});
const delivery = { configured: true, send: sent };
suite("delivery and sandbox ledger on verified disposable branch", () => {
  beforeAll(async () => {
    vi.stubEnv("APPOINTMENT_NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("APPOINTMENT_EMAIL_DELIVERY_ENABLED", "false");
    vi.stubEnv("BILLING_SANDBOX_ENABLED", "true");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw Error("External provider requests forbidden in rehearsal");
      }),
    );
    holder.client = createDatabaseClient(url!, 3);
    const db = holder.client;
    const history = await db.$queryRaw<
      { migration_name: string }[]
    >`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    expect(history.map((r) => r.migration_name)).toContain(
      "20261025020000_delivery_and_sandbox_ledger",
    );
    ownerId = (
      await db.user.create({
        data: {
          name: "Synthetic ledger owner",
          email: `ledger-${tag}@example.invalid`,
          passwordHash: "non-login-fixture",
        },
      })
    ).id;
    businessId = (
      await db.business.create({
        data: {
          name: "Synthetic ledger fixture",
          slug: `ledger-${tag}`,
          country: "LK",
          currency: "LKR",
          timezone: "Asia/Colombo",
          members: { create: { userId: ownerId, role: "OWNER" } },
        },
      })
    ).id;
    otherId = (
      await db.business.create({
        data: {
          name: "Foreign ledger fixture",
          slug: `ledger-other-${tag}`,
          country: "LK",
          currency: "LKR",
          timezone: "Asia/Colombo",
          members: { create: { userId: ownerId, role: "OWNER" } },
        },
      })
    ).id;
    serviceId = (
      await db.service.create({
        data: {
          businessId,
          name: "Synthetic service",
          durationMinutes: 30,
          price: "25",
        },
      })
    ).id;
    staffId = (
      await db.staff.create({ data: { businessId, name: "Synthetic staff" } })
    ).id;
    customerId = (
      await db.customer.create({
        data: {
          businessId,
          name: "Synthetic customer",
          email: `delivery-${tag}@example.invalid`,
        },
      })
    ).id;
    const startsAt = new Date(Date.now() + 4 * 86400000);
    appointmentId = (
      await db.appointment.create({
        data: {
          businessId,
          serviceId,
          staffId,
          customerId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 1800000),
          price: "25",
          currency: "LKR",
        },
      })
    ).id;
  }, 120000);
  afterAll(async () => {
    const db = holder.client;
    try {
      if (db) {
        for (const id of [businessId, otherId].filter(Boolean)) {
          const where = { businessId: id };
          await db.notificationJob.deleteMany({ where });
          await db.sandboxRefund.deleteMany({ where });
          await db.sandboxPaymentEvent.deleteMany({ where });
          await db.sandboxSubscriptionEvent.deleteMany({ where });
          await db.sandboxPayment.deleteMany({ where });
          await db.sandboxSubscription.deleteMany({ where });
          await db.auditLog.deleteMany({ where });
          await db.appointment.deleteMany({ where });
          await db.customer.deleteMany({ where });
          await db.staff.deleteMany({ where });
          await db.service.deleteMany({ where });
          await db.business.delete({ where: { id } });
        }
        if (ownerId) await db.user.delete({ where: { id: ownerId } });
      }
    } finally {
      await db?.$disconnect();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  }, 120000);
  it("defaults consent off and deduplicates opted-in notification jobs", async () => {
    const db = holder.client!;
    expect(
      (await db.customer.findUniqueOrThrow({ where: { id: customerId } }))
        .appointmentEmailOptIn,
    ).toBe(false);
    await db.$transaction((tx) =>
      enqueueAppointmentNotifications(
        tx,
        businessId,
        appointmentId,
        "CREATED",
        "fixture-created",
      ),
    );
    expect(await db.notificationJob.count({ where: { businessId } })).toBe(0);
    await db.customer.update({
      where: { id: customerId },
      data: { appointmentEmailOptIn: true },
    });
    for (let i = 0; i < 2; i++)
      await db.$transaction((tx) =>
        enqueueAppointmentNotifications(
          tx,
          businessId,
          appointmentId,
          "CREATED",
          "fixture-created",
        ),
      );
    expect(await db.notificationJob.count({ where: { businessId } })).toBe(2);
    expect(
      await processNotificationBatch(delivery, 1, new Date(), businessId),
    ).toMatchObject({ sent: 1 });
    expect(sent).toHaveBeenCalledTimes(1);
    expect(
      await processNotificationBatch(delivery, 1, new Date(), businessId),
    ).toMatchObject({ processed: 0 });
  });
  it("retries a synthetic failure and suppresses delivery after opt-out", async () => {
    const db = holder.client!,
      now = new Date();
    await db.$transaction((tx) =>
      enqueueAppointmentNotifications(
        tx,
        businessId,
        appointmentId,
        "CONFIRMED",
        "fixture-confirmed",
        now,
      ),
    );
    const fail = {
      configured: true,
      send: vi.fn(async () => ({ delivered: false })),
    };
    await processNotificationBatch(fail, 1, now, businessId);
    expect(
      await db.notificationJob.count({
        where: { businessId, state: "RETRY", attempts: 1 },
      }),
    ).toBe(1);
    await db.customer.update({
      where: { id: customerId },
      data: { appointmentEmailOptIn: false },
    });
    await processNotificationBatch(
      delivery,
      1,
      new Date(now.getTime() + 3600000),
      businessId,
    );
    expect(
      await db.notificationJob.count({
        where: { businessId, state: "SKIPPED" },
      }),
    ).toBe(1);
    expect(sent).toHaveBeenCalledTimes(1);
  });
  it("enforces tenant foreign keys and TEST-only ledger constraints", async () => {
    const db = holder.client!;
    await expect(
      db.notificationJob.create({
        data: {
          businessId: otherId,
          appointmentId,
          kind: "CREATED",
          revision: "fixture",
          dedupKey: randomUUID(),
          scheduledFor: new Date(),
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.sandboxSubscription.create({ data: { businessId, mode: "LIVE" } }),
    ).rejects.toThrow();
    await expect(
      beginSandboxPayment(
        { ...scope(), businessId: otherId },
        { appointmentId, operationKey: randomUUID() },
      ),
    ).rejects.toThrow("Appointment unavailable");
  });
  it("reserves once, rejects changed replay and reconciles signed-event input exactly once", async () => {
    const key = randomUUID();
    const first = await beginSandboxPayment(scope(), {
      appointmentId,
      operationKey: key,
    });
    paymentId = first.id;
    expect(first.amountMinor).toBe(2500);
    expect(
      (await beginSandboxPayment(scope(), { appointmentId, operationKey: key }))
        .id,
    ).toBe(first.id);
    await expect(
      beginSandboxPayment(scope(), {
        appointmentId,
        operationKey: key,
        amountMinor: 1,
      }),
    ).rejects.toThrow("conflict");
    await expect(
      beginSandboxPayment(scope(), {
        appointmentId,
        operationKey: randomUUID(),
      }),
    ).rejects.toThrow("outstanding");
    const reference = `cs_test_${tag.replaceAll("-", "")}`;
    await bindSandboxCheckout(scope(), paymentId, reference);
    const event = {
      id: `evt_${tag.replaceAll("-", "")}`,
      type: "checkout.session.completed",
      livemode: false as const,
      data: {
        object: {
          id: reference,
          currency: "lkr",
          amount_total: 2500,
          payment_status: "paid",
          payment_intent: `pi_${tag.replaceAll("-", "")}`,
          metadata: { businessId, appointmentId },
        },
      },
    };
    await expect(
      applySandboxPaymentEvent(
        {
          ...event,
          data: { object: { ...event.data.object, amount_total: 1 } },
        },
        hash("bad"),
      ),
    ).rejects.toThrow("mismatch");
    expect(await applySandboxPaymentEvent(event, hash("paid"))).toEqual({
      applied: true,
    });
    expect(await applySandboxPaymentEvent(event, hash("paid"))).toEqual({
      replay: true,
    });
    await expect(
      applySandboxPaymentEvent(event, hash("changed")),
    ).rejects.toThrow("conflict");
    expect(
      (
        await holder.client!.sandboxPayment.findUniqueOrThrow({
          where: { id: paymentId },
        })
      ).paidMinor,
    ).toBe(2500);
  });
  it("reserves refunds idempotently without exceeding paid funds", async () => {
    const operationKey = randomUUID();
    const first = await requestSandboxRefund(scope(), {
      paymentId,
      amountMinor: 1500,
      operationKey,
    });
    expect(
      (
        await requestSandboxRefund(scope(), {
          paymentId,
          amountMinor: 1500,
          operationKey,
        })
      ).id,
    ).toBe(first.id);
    await expect(
      requestSandboxRefund(scope(), {
        paymentId,
        amountMinor: 1500,
        operationKey: randomUUID(),
      }),
    ).rejects.toThrow("exceeds");
    await expect(
      requestSandboxRefund(
        { ...scope(), businessId: otherId },
        { paymentId, amountMinor: 1, operationKey: randomUUID() },
      ),
    ).rejects.toThrow("No verified payment");
  });
  it("enforces quotas, grants one trial, and preserves expiry/cancellation downgrade", async () => {
    const db = holder.client!;
    await db.service.createMany({
      data: Array.from({ length: 4 }, (_, i) => ({
        businessId,
        name: `Quota fixture ${i}`,
        price: "1",
        durationMinutes: 30,
      })),
    });
    await expect(
      db.$transaction((tx) =>
        assertCatalogEntitlement(tx, scope(), "services"),
      ),
    ).rejects.toThrow("plan limit");
    const trial = await startSandboxTrial(scope());
    expect(effectivePlan(trial)).toBe("PRO");
    expect(
      effectivePlan(trial, new Date(trial.trialEndsAt!.getTime() + 1)),
    ).toBe("FREE");
    await db.$transaction((tx) =>
      assertCatalogEntitlement(tx, scope(), "services"),
    );
    await expect(startSandboxTrial(scope())).rejects.toThrow("already used");
    await cancelSandboxTrial(scope());
    expect(
      effectivePlan(
        await db.sandboxSubscription.findUnique({ where: { businessId } }),
      ),
    ).toBe("FREE");
    await expect(startSandboxTrial(scope())).rejects.toThrow("already used");
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(startSandboxTrial(scope())).rejects.toThrow("disabled");
  });
});
