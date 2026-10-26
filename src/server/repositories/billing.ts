import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/server/authorization";
import { requireCurrentManager } from "./workspace";
import {
  effectivePlan,
  planLimits,
  sandboxBillingEnabled,
} from "@/features/billing/policy";
import { amountToMinorUnits } from "@/server/payments/gateway";
export async function assertCatalogEntitlement(
  tx: Prisma.TransactionClient,
  scope: TenantContext,
  kind: "services" | "staff",
  excludeId?: string,
) {
  if (!sandboxBillingEnabled()) return;
  await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id"=${scope.businessId} FOR UPDATE`;
  const subscription = await tx.sandboxSubscription.findUnique({
    where: { businessId: scope.businessId },
  });
  const count =
    kind === "services"
      ? await tx.service.count({
          where: {
            businessId: scope.businessId,
            active: true,
            id: excludeId ? { not: excludeId } : undefined,
          },
        })
      : await tx.staff.count({
          where: {
            businessId: scope.businessId,
            active: true,
            id: excludeId ? { not: excludeId } : undefined,
          },
        });
  if (count >= planLimits[effectivePlan(subscription)][kind])
    throw Error(
      "The sandbox plan limit has been reached. Archive a record or change your test plan.",
    );
}
export async function startSandboxTrial(scope: TenantContext) {
  if (!sandboxBillingEnabled()) throw Error("Sandbox billing disabled");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id"=${scope.businessId} FOR UPDATE`;
    const current = await tx.sandboxSubscription.findUnique({
      where: { businessId: scope.businessId },
    });
    if (current?.trialUsed || current?.providerReference)
      throw Error("Trial already used");
    const trialEndsAt = new Date(Date.now() + 14 * 86400000);
    const result = await tx.sandboxSubscription.upsert({
      where: { businessId: scope.businessId },
      create: {
        businessId: scope.businessId,
        plan: "PRO",
        state: "TRIALING",
        trialUsed: true,
        trialEndsAt,
      },
      update: { plan: "PRO", state: "TRIALING", trialUsed: true, trialEndsAt },
    });
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "billing.sandbox.trial.started",
        entityId: result.id,
      },
    });
    return result;
  });
}
export async function cancelSandboxTrial(scope: TenantContext) {
  if (!sandboxBillingEnabled()) throw Error("Sandbox billing disabled");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id"=${scope.businessId} FOR UPDATE`;
    const result = await tx.sandboxSubscription.updateMany({
      where: {
        businessId: scope.businessId,
        state: "TRIALING",
        providerReference: null,
      },
      data: { state: "CANCELED", plan: "FREE" },
    });
    if (result.count !== 1)
      throw Error("Only a local sandbox trial can be cancelled here");
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "billing.sandbox.trial.cancelled",
      },
    });
  });
}
const beginSchema = z.object({
  appointmentId: z.string().cuid(),
  operationKey: z.uuid(),
  amountMinor: z.number().int().min(1).max(99999999).optional(),
});
export async function beginSandboxPayment(
  scope: TenantContext,
  input: unknown,
) {
  if (!sandboxBillingEnabled()) throw Error("Sandbox billing disabled");
  const data = beginSchema.parse(input),
    hash = createHash("sha256")
      .update(JSON.stringify([data.appointmentId, data.amountMinor ?? null]))
      .digest("hex");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    await tx.$queryRaw`SELECT "id" FROM "Appointment" WHERE "businessId"=${scope.businessId} AND "id"=${data.appointmentId} FOR UPDATE`;
    const existing = await tx.sandboxPayment.findUnique({
      where: {
        businessId_operationKey: {
          businessId: scope.businessId,
          operationKey: data.operationKey,
        },
      },
    });
    if (existing) {
      if (
        existing.payloadHash !== hash ||
        existing.appointmentId !== data.appointmentId
      )
        throw Error("Payment request conflict");
      return existing;
    }
    const a = await tx.appointment.findFirst({
      where: { id: data.appointmentId, businessId: scope.businessId },
    });
    if (!a || a.status === "CANCELLED") throw Error("Appointment unavailable");
    const total = amountToMinorUnits(a.price.toString(), a.currency);
    const other = await tx.sandboxPayment.findMany({
      where: {
        businessId: scope.businessId,
        appointmentId: a.id,
        state: { notIn: ["FAILED", "EXPIRED"] },
      },
      select: {
        state: true,
        amountMinor: true,
        paidMinor: true,
        refundedMinor: true,
      },
    });
    const reserved = other.reduce(
        (sum, p) =>
          sum +
          (p.state === "PENDING"
            ? p.amountMinor
            : p.paidMinor - p.refundedMinor),
        0,
      ),
      amount = data.amountMinor ?? total - reserved;
    if (amount <= 0 || amount > total - reserved || amount > 99999999)
      throw Error("Payment exceeds outstanding appointment amount");
    return tx.sandboxPayment.create({
      data: {
        businessId: scope.businessId,
        appointmentId: a.id,
        operationKey: data.operationKey,
        payloadHash: hash,
        currency: a.currency,
        amountMinor: amount,
      },
    });
  });
}
export async function bindSandboxCheckout(
  scope: TenantContext,
  paymentId: string,
  reference: string,
) {
  if (!sandboxBillingEnabled() || !/^cs_test_[A-Za-z0-9]+$/.test(reference))
    throw Error("Verified test checkout required");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const result = await tx.sandboxPayment.updateMany({
      where: {
        id: paymentId,
        businessId: scope.businessId,
        mode: "TEST",
        state: "PENDING",
        OR: [{ providerReference: null }, { providerReference: reference }],
      },
      data: { providerReference: reference },
    });
    if (result.count !== 1) throw Error("Checkout binding failed");
  });
}
export type PaymentEvent = {
  id: string;
  type: string;
  livemode: false;
  data: { object: Record<string, unknown> };
};
/** Call only after raw-body provider signature verification. It never trusts redirect parameters. */
export async function applySandboxPaymentEvent(
  event: PaymentEvent,
  payloadHash: string,
) {
  if (!sandboxBillingEnabled() || event.livemode !== false)
    throw Error("Sandbox event disabled");
  if (
    !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    !/^[a-f0-9]{64}$/.test(payloadHash)
  )
    throw Error("Invalid verified event identity");
  const object = event.data.object;
  if (object.livemode === true) throw Error("Live provider object rejected");
  const checkout = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
      "checkout.session.async_payment_failed",
    ].includes(event.type),
    refund = event.type === "charge.refunded";
  if (!checkout && !refund) return { ignored: true };
  const reference = checkout ? object.id : object.payment_intent;
  if (typeof reference !== "string") throw Error("Missing provider binding");
  return db().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT true AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`payment-event:${event.id}`},0))) AS guard`;
      const replay = await tx.sandboxPaymentEvent.findUnique({
        where: { providerEventId: event.id },
      });
      if (replay) {
        if (replay.payloadHash !== payloadHash)
          throw Error("Provider event replay conflict");
        return { replay: true };
      }
      const candidate = await tx.sandboxPayment.findFirst({
        where: checkout
          ? { providerReference: reference, mode: "TEST" }
          : { providerIntent: reference, mode: "TEST" },
      });
      if (!candidate) throw Error("Unknown sandbox payment");
      await tx.$queryRaw`SELECT "id" FROM "SandboxPayment" WHERE "id"=${candidate.id} AND "businessId"=${candidate.businessId} FOR UPDATE`;
      const payment = await tx.sandboxPayment.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      if (
        typeof object.currency !== "string" ||
        object.currency.toUpperCase() !== payment.currency
      )
        throw Error("Provider currency mismatch");
      if (checkout) {
        const metadata = object.metadata as
          { businessId?: unknown; appointmentId?: unknown } | undefined;
        if (
          metadata?.businessId !== payment.businessId ||
          metadata?.appointmentId !== payment.appointmentId ||
          object.amount_total !== payment.amountMinor
        )
          throw Error("Provider amount or tenant mismatch");
        if (
          [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
          ].includes(event.type) &&
          object.payment_status === "paid"
        ) {
          if (
            typeof object.payment_intent !== "string" ||
            !/^pi_[A-Za-z0-9]+$/.test(object.payment_intent)
          )
            throw Error("Missing payment intent binding");
          await tx.sandboxPayment.update({
            where: { id: payment.id },
            data: {
              paidMinor: payment.amountMinor,
              providerIntent: object.payment_intent,
              state: payment.refundedMinor
                ? payment.refundedMinor === payment.amountMinor
                  ? "REFUNDED"
                  : "PARTIALLY_REFUNDED"
                : "SUCCEEDED",
            },
          });
        } else if (
          !payment.paidMinor &&
          [
            "checkout.session.expired",
            "checkout.session.async_payment_failed",
          ].includes(event.type)
        )
          await tx.sandboxPayment.update({
            where: { id: payment.id },
            data: {
              state: event.type.endsWith("expired") ? "EXPIRED" : "FAILED",
            },
          });
      } else {
        const amount = object.amount_refunded;
        if (
          !Number.isInteger(amount) ||
          typeof amount !== "number" ||
          amount < 0 ||
          amount > payment.paidMinor
        )
          throw Error("Refund reconciliation mismatch");
        await tx.sandboxPayment.update({
          where: { id: payment.id },
          data: {
            refundedMinor: Math.max(amount, payment.refundedMinor),
            state:
              Math.max(amount, payment.refundedMinor) === payment.paidMinor
                ? "REFUNDED"
                : "PARTIALLY_REFUNDED",
          },
        });
      }
      await tx.sandboxPaymentEvent.create({
        data: {
          businessId: payment.businessId,
          paymentId: payment.id,
          providerEventId: event.id,
          payloadHash,
          eventType: event.type,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId: payment.businessId,
          action: "payment.sandbox.reconciled",
          entityId: payment.id,
        },
      });
      return { applied: true };
    },
    { timeout: 30000 },
  );
}
export async function requestSandboxRefund(
  scope: TenantContext,
  input: { paymentId: string; amountMinor: number; operationKey: string },
) {
  if (
    !sandboxBillingEnabled() ||
    !z.uuid().safeParse(input.operationKey).success ||
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor <= 0
  )
    throw Error("Invalid sandbox refund");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    await tx.$queryRaw`SELECT "id" FROM "SandboxPayment" WHERE "id"=${input.paymentId} AND "businessId"=${scope.businessId} FOR UPDATE`;
    const replay = await tx.sandboxRefund.findUnique({
      where: {
        businessId_operationKey: {
          businessId: scope.businessId,
          operationKey: input.operationKey,
        },
      },
    });
    if (replay) {
      if (
        replay.paymentId !== input.paymentId ||
        replay.amountMinor !== input.amountMinor
      )
        throw Error("Refund request conflict");
      return replay;
    }
    const p = await tx.sandboxPayment.findFirst({
      where: {
        id: input.paymentId,
        businessId: scope.businessId,
        mode: "TEST",
      },
    });
    if (!p || !p.providerIntent) throw Error("No verified payment to refund");
    const pending = await tx.sandboxRefund.aggregate({
      where: {
        businessId: scope.businessId,
        paymentId: p.id,
        state: { in: ["PENDING", "SUBMITTED"] },
      },
      _sum: { amountMinor: true },
    });
    if (
      input.amountMinor >
      p.paidMinor - p.refundedMinor - (pending._sum.amountMinor ?? 0)
    )
      throw Error("Refund exceeds remaining paid amount");
    return tx.sandboxRefund.create({
      data: {
        businessId: scope.businessId,
        paymentId: p.id,
        operationKey: input.operationKey,
        amountMinor: input.amountMinor,
      },
    });
  });
}
export function readBilling(scope: TenantContext) {
  return Promise.all([
    db().sandboxSubscription.findUnique({
      where: { businessId: scope.businessId },
    }),
    db().sandboxPayment.findMany({
      where: { businessId: scope.businessId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        state: true,
        currency: true,
        amountMinor: true,
        paidMinor: true,
        refundedMinor: true,
        createdAt: true,
      },
    }),
  ]);
}
/** Normalized snapshots must be fetched/authenticated by a trusted test provider adapter. */
export async function reconcileSandboxSubscription(input: {
  reference: string;
  businessId: string;
  eventId: string;
  payloadHash: string;
  created: number;
  plan: "FREE" | "PRO";
  state: "ACTIVE" | "PAST_DUE" | "CANCELED";
  periodEndsAt: Date;
  cancelAtPeriodEnd: boolean;
}) {
  if (
    !sandboxBillingEnabled() ||
    !/^sub_[A-Za-z0-9]+$/.test(input.reference) ||
    !/^evt_[A-Za-z0-9]+$/.test(input.eventId) ||
    !/^[a-f0-9]{64}$/.test(input.payloadHash) ||
    !Number.isSafeInteger(input.created) ||
    input.created <= 0 ||
    input.created > 2147483647 ||
    !Number.isFinite(input.periodEndsAt.getTime())
  )
    throw Error("Invalid normalized sandbox subscription event");
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT true AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`subscription-event:${input.eventId}`},0))) AS guard`;
    const replay = await tx.sandboxSubscriptionEvent.findUnique({
      where: { providerEventId: input.eventId },
    });
    if (replay) {
      if (
        replay.payloadHash !== input.payloadHash ||
        replay.businessId !== input.businessId
      )
        throw Error("Subscription replay conflict");
      return;
    }
    await tx.$queryRaw`SELECT "id" FROM "SandboxSubscription" WHERE "businessId"=${input.businessId} AND "providerReference"=${input.reference} FOR UPDATE`;
    const row = await tx.sandboxSubscription.findFirst({
      where: {
        businessId: input.businessId,
        providerReference: input.reference,
        mode: "TEST",
      },
    });
    if (!row) throw Error("Unknown subscription binding");
    if (input.created === row.lastProviderCreated)
      throw Error("Ambiguous event order requires provider reconciliation");
    if (input.created > row.lastProviderCreated) {
      await tx.sandboxSubscription.update({
        where: { id: row.id },
        data: {
          state: input.state,
          plan: input.plan,
          periodEndsAt: input.periodEndsAt,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          lastProviderCreated: input.created,
          graceEndsAt:
            input.state === "PAST_DUE"
              ? (row.graceEndsAt ?? new Date(Date.now() + 3 * 86400000))
              : null,
        },
      });
    }
    await tx.sandboxSubscriptionEvent.create({
      data: {
        businessId: input.businessId,
        subscriptionId: row.id,
        providerEventId: input.eventId,
        payloadHash: input.payloadHash,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: input.businessId,
        action: "subscription.sandbox.reconciled",
        entityId: row.id,
      },
    });
  });
}
export async function markSandboxRefundSubmitted(
  scope: TenantContext,
  refundId: string,
  providerReference: string,
) {
  if (!sandboxBillingEnabled() || !/^re_[A-Za-z0-9]+$/.test(providerReference))
    throw Error("Invalid sandbox refund response");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const r = await tx.sandboxRefund.updateMany({
      where: {
        id: refundId,
        businessId: scope.businessId,
        state: { in: ["PENDING", "SUBMITTED"] },
        OR: [{ providerReference: null }, { providerReference }],
      },
      data: { providerReference, state: "SUBMITTED" },
    });
    if (!r.count) throw Error("Refund binding conflict");
  });
}
