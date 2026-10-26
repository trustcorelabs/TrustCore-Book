-- PREPARED ONLY. Explicit disposable-development approval required before application.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "appointmentEmailOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(3),
    "providerReference" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxPayment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "operationKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "providerReference" TEXT,
    "providerIntent" TEXT,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "refundedMinor" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "mode" TEXT NOT NULL DEFAULT 'TEST',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SandboxPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxPaymentEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxRefund" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxSubscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "state" TEXT NOT NULL DEFAULT 'FREE',
    "mode" TEXT NOT NULL DEFAULT 'TEST',
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMPTZ(3),
    "periodEndsAt" TIMESTAMPTZ(3),
    "graceEndsAt" TIMESTAMPTZ(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "providerReference" TEXT,
    "lastProviderCreated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SandboxSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxSubscriptionEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxSubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_dedupKey_key" ON "NotificationJob"("dedupKey");

-- CreateIndex
CREATE INDEX "NotificationJob_state_scheduledFor_idx" ON "NotificationJob"("state", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationJob_leaseUntil_idx" ON "NotificationJob"("leaseUntil");

-- CreateIndex
CREATE INDEX "NotificationJob_businessId_createdAt_idx" ON "NotificationJob"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxPayment_providerReference_key" ON "SandboxPayment"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxPayment_providerIntent_key" ON "SandboxPayment"("providerIntent");

-- CreateIndex
CREATE INDEX "SandboxPayment_businessId_appointmentId_idx" ON "SandboxPayment"("businessId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxPayment_businessId_id_key" ON "SandboxPayment"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxPayment_businessId_operationKey_key" ON "SandboxPayment"("businessId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxPaymentEvent_providerEventId_key" ON "SandboxPaymentEvent"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxRefund_providerReference_key" ON "SandboxRefund"("providerReference");

-- CreateIndex
CREATE INDEX "SandboxRefund_businessId_paymentId_idx" ON "SandboxRefund"("businessId", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxRefund_businessId_operationKey_key" ON "SandboxRefund"("businessId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSubscription_businessId_key" ON "SandboxSubscription"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSubscription_providerReference_key" ON "SandboxSubscription"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSubscription_businessId_id_key" ON "SandboxSubscription"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSubscriptionEvent_providerEventId_key" ON "SandboxSubscriptionEvent"("providerEventId");

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD COLUMN "firstAttemptAt" TIMESTAMPTZ(3);
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_businessId_appointmentId_fkey" FOREIGN KEY ("businessId", "appointmentId") REFERENCES "Appointment"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxPayment" ADD CONSTRAINT "SandboxPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxPayment" ADD CONSTRAINT "SandboxPayment_businessId_appointmentId_fkey" FOREIGN KEY ("businessId", "appointmentId") REFERENCES "Appointment"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxPaymentEvent" ADD CONSTRAINT "SandboxPaymentEvent_businessId_paymentId_fkey" FOREIGN KEY ("businessId", "paymentId") REFERENCES "SandboxPayment"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxRefund" ADD CONSTRAINT "SandboxRefund_businessId_paymentId_fkey" FOREIGN KEY ("businessId", "paymentId") REFERENCES "SandboxPayment"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxSubscription" ADD CONSTRAINT "SandboxSubscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxSubscriptionEvent" ADD CONSTRAINT "SandboxSubscriptionEvent_businessId_subscriptionId_fkey" FOREIGN KEY ("businessId", "subscriptionId") REFERENCES "SandboxSubscription"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationJob" ADD CONSTRAINT notification_state_valid CHECK (state IN ('PENDING','PROCESSING','RETRY','SENT','SKIPPED','DEAD')), ADD CONSTRAINT notification_kind_valid CHECK (kind IN ('CREATED','CONFIRMED','CANCELLED','RESCHEDULED','REMINDER')), ADD CONSTRAINT notification_attempts_valid CHECK (attempts BETWEEN 0 AND 4);
ALTER TABLE "SandboxPayment" ADD CONSTRAINT sandbox_payment_test_only CHECK (mode='TEST'), ADD CONSTRAINT sandbox_payment_amount_valid CHECK ("amountMinor" BETWEEN 1 AND 99999999 AND "paidMinor" BETWEEN 0 AND "amountMinor" AND "refundedMinor" BETWEEN 0 AND "paidMinor"), ADD CONSTRAINT sandbox_payment_state_valid CHECK (state IN ('PENDING','SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED','FAILED','EXPIRED'));
ALTER TABLE "SandboxRefund" ADD CONSTRAINT sandbox_refund_amount_valid CHECK ("amountMinor" BETWEEN 1 AND 99999999), ADD CONSTRAINT sandbox_refund_state_valid CHECK (state IN ('PENDING','SUBMITTED','SETTLED','FAILED'));
ALTER TABLE "SandboxSubscription" ADD CONSTRAINT sandbox_subscription_test_only CHECK (mode='TEST'), ADD CONSTRAINT sandbox_subscription_plan_valid CHECK (plan IN ('FREE','PRO')), ADD CONSTRAINT sandbox_subscription_state_valid CHECK (state IN ('FREE','TRIALING','ACTIVE','PAST_DUE','CANCELED'));
COMMIT;
