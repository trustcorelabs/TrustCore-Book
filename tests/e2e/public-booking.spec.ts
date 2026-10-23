import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { sql, verified } from "./database";

test.describe("public booking on verified development database", () => {
  test.skip(
    !verified,
    "Requires externally verified disposable booking database",
  );
  test.describe.configure({ mode: "serial" });

  const suffix = randomUUID();
  const slug = `booking-e2e-${suffix}`;
  const businessId = `e2e-business-${suffix}`;
  const serviceId = `c${suffix.replaceAll("-", "").slice(0, 24)}`;
  const staffId = `e2e-staff-${suffix}`;
  let businessCreated = false;

  test.beforeAll(async () => {
    const migration = await sql(`SELECT count(*) FROM "_prisma_migrations"
      WHERE migration_name = '20261019030000_booking_idempotency'
      AND finished_at IS NOT NULL AND rolled_back_at IS NULL`);
    if (migration !== "1")
      throw new Error("Disposable booking migration is not applied");
    await sql(`INSERT INTO "Business" (id,name,slug,country,currency,timezone)
      VALUES ('${businessId}','Browser booking fixture','${slug}','LK','LKR','Asia/Colombo')`);
    businessCreated = true;
    await sql(`INSERT INTO "Service" (id,"businessId",name,"durationMinutes",price)
      VALUES ('${serviceId}','${businessId}','Browser test service',30,25.00);
      INSERT INTO "Staff" (id,"businessId",name)
      VALUES ('${staffId}','${businessId}','Browser test staff');
      INSERT INTO "StaffService" ("businessId","staffId","serviceId")
      VALUES ('${businessId}','${staffId}','${serviceId}');
      INSERT INTO "AvailabilityRule" (id,"businessId","staffId",weekday,"startMinute","endMinute")
      SELECT 'e2e-rule-${suffix}-' || day, '${businessId}', '${staffId}', day, 0, 1440
      FROM generate_series(0,6) AS day;`);
  });

  test.afterAll(async () => {
    if (!businessCreated) return;
    await sql(`BEGIN;
      DELETE FROM "BookingRequest" WHERE "businessId" = '${businessId}';
      DELETE FROM "Appointment" WHERE "businessId" = '${businessId}';
      DELETE FROM "AuditLog" WHERE "businessId" = '${businessId}';
      DELETE FROM "Business" WHERE id = '${businessId}';
      COMMIT;`);
  });

  test("books a visible slot and displays its reference", async ({ page }) => {
    await page.goto(`/book/${slug}`);
    await expect(
      page.getByRole("heading", { name: "Browser booking fixture" }),
    ).toBeVisible();
    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(Date.now() + 2 * 86400_000));
    const part = (type: string) =>
      dateParts.find((item) => item.type === type)?.value;
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    await page.getByLabel("Date").fill(date);
    await page.getByRole("button", { name: "Find times" }).click();
    const slots = page.getByRole("button", { name: /Browser test staff/ });
    await expect(slots.first()).toBeVisible();
    await slots.first().click();
    await page.getByLabel("Name").fill("Browser Test Customer");
    await page.getByLabel("Email").fill(`browser-${suffix}@example.test`);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("status")).toContainText(
      /Booking confirmed\. Reference:/,
    );
    expect(
      await sql(`SELECT count(*) FROM "Appointment"
        WHERE "businessId" = '${businessId}' AND status = 'CONFIRMED'`),
    ).toBe("1");
  });
});
