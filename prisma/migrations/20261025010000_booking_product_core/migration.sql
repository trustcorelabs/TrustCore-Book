-- PREPARED ONLY. Rehearse on an explicitly approved disposable DEVELOPMENT branch.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "bookingHorizonDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "bookingLeadMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "cancellationNoticeMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "rescheduleNoticeMinutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'SERVICE';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "catalogSnapshot" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "occupiedEndsAt" TIMESTAMPTZ(3),
ADD COLUMN     "occupiedStartsAt" TIMESTAMPTZ(3),
ADD COLUMN     "serviceNameSnapshot" TEXT;

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceComponent" (
    "businessId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceComponent_pkey" PRIMARY KEY ("businessId","packageId","componentId")
);

-- CreateTable
CREATE TABLE "BookingMutation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_businessId_id_key" ON "ServiceCategory"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_businessId_name_key" ON "ServiceCategory"("businessId", "name");

-- CreateIndex
CREATE INDEX "ServiceComponent_businessId_componentId_idx" ON "ServiceComponent"("businessId", "componentId");

-- CreateIndex
CREATE INDEX "BookingMutation_businessId_appointmentId_idx" ON "BookingMutation"("businessId", "appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingMutation_businessId_operationKey_key" ON "BookingMutation"("businessId", "operationKey");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_categoryId_fkey" FOREIGN KEY ("businessId", "categoryId") REFERENCES "ServiceCategory"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComponent" ADD CONSTRAINT "ServiceComponent_businessId_packageId_fkey" FOREIGN KEY ("businessId", "packageId") REFERENCES "Service"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComponent" ADD CONSTRAINT "ServiceComponent_businessId_componentId_fkey" FOREIGN KEY ("businessId", "componentId") REFERENCES "Service"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingMutation" ADD CONSTRAINT "BookingMutation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingMutation" ADD CONSTRAINT "BookingMutation_businessId_appointmentId_fkey" FOREIGN KEY ("businessId", "appointmentId") REFERENCES "Appointment"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing appointments retain exactly their current occupied times and zero buffers.
UPDATE "Appointment" SET "occupiedStartsAt"="startsAt", "occupiedEndsAt"="endsAt";
ALTER TABLE "Appointment" ALTER COLUMN "occupiedStartsAt" SET NOT NULL, ALTER COLUMN "occupiedEndsAt" SET NOT NULL;
CREATE FUNCTION trustcore_set_occupied_interval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."occupiedStartsAt" := NEW."startsAt" - make_interval(mins => NEW."bufferBeforeMinutes");
  NEW."occupiedEndsAt" := NEW."endsAt" + make_interval(mins => NEW."bufferAfterMinutes");
  RETURN NEW;
END $$;
CREATE TRIGGER appointment_occupied_interval BEFORE INSERT OR UPDATE ON "Appointment"
FOR EACH ROW EXECUTE FUNCTION trustcore_set_occupied_interval();
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_buffers_valid CHECK ("bufferBeforeMinutes" BETWEEN 0 AND 180 AND "bufferAfterMinutes" BETWEEN 0 AND 180);
-- Preserve the original exclusion constraint; add a stronger occupied-interval guard.
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_staff_no_buffer_overlap EXCLUDE USING gist (
 "businessId" WITH =, "staffId" WITH =, tstzrange("occupiedStartsAt", "occupiedEndsAt", '[)') WITH &&
) WHERE (status <> 'CANCELLED');
ALTER TABLE "Service" ADD CONSTRAINT service_buffers_valid CHECK ("bufferBeforeMinutes" BETWEEN 0 AND 180 AND "bufferAfterMinutes" BETWEEN 0 AND 180), ADD CONSTRAINT service_kind_valid CHECK (kind IN ('SERVICE','PACKAGE','ADDON'));
ALTER TABLE "Staff" ADD CONSTRAINT staff_buffers_valid CHECK ("bufferBeforeMinutes" BETWEEN 0 AND 180 AND "bufferAfterMinutes" BETWEEN 0 AND 180);
ALTER TABLE "Business" ADD CONSTRAINT booking_policy_valid CHECK ("bookingLeadMinutes" BETWEEN 0 AND 10080 AND "cancellationNoticeMinutes" BETWEEN 0 AND 10080 AND "rescheduleNoticeMinutes" BETWEEN 0 AND 10080 AND "bookingHorizonDays" BETWEEN 1 AND 180);
ALTER TABLE "ServiceComponent" ADD CONSTRAINT package_component_valid CHECK ("packageId" <> "componentId" AND quantity BETWEEN 1 AND 10);
COMMIT;
