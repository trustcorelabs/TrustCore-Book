-- Additive only. Rehearse on an explicitly approved disposable development target before deployment.
ALTER TABLE "Business"
  ADD COLUMN "businessType" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "terminologyMode" TEXT NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Business" ADD CONSTRAINT "Business_businessType_check"
  CHECK ("businessType" IN ('GENERAL','SALON','BARBER','SPA','NAIL_LASH','BRIDAL','FITNESS','TUTORING','PHOTOGRAPHY')),
  ADD CONSTRAINT "Business_terminologyMode_check" CHECK ("terminologyMode" IN ('STANDARD','INDUSTRY'));
CREATE TABLE "CustomerNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerNote_body_check" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "CustomerNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerNote_businessId_customerId_fkey" FOREIGN KEY ("businessId","customerId") REFERENCES "Customer"("businessId","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "CustomerNote_businessId_customerId_createdAt_idx" ON "CustomerNote"("businessId","customerId","createdAt");
CREATE INDEX "CustomerNote_authorId_idx" ON "CustomerNote"("authorId");
