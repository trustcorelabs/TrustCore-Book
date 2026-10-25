import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { sql, verified } from "./database";
import { businessLocalDate } from "../../src/features/booking-engine/slots";

test("registration through scheduled public booking and dashboard status management", async ({
  page,
  context,
}, testInfo) => {
  test.skip(!verified, "Requires verified migrated development database");
  test.setTimeout(240000);
  const suffix = randomUUID();
  const email = `journey-${suffix}@example.test`;
  const slug = `journey-${suffix}`;
  const name = `Journey ${suffix.slice(0, 8)}`;
  const date = businessLocalDate(
    new Date(Date.now() + 2 * 86400000),
    "Asia/Colombo",
  );
  let businessId = "";
  try {
    await page.goto("/register");
    await page.getByLabel("Full name", { exact: true }).fill("Journey Owner");
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(`Journey!${suffix}`);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("Business name", { exact: true }).fill(name);
    await page.getByLabel("Booking address", { exact: true }).fill(slug);
    await page.getByRole("button", { name: "Continue", exact: false }).click();
    await page.getByRole("button", { name: "Continue", exact: false }).click();
    await page
      .getByRole("button", { name: "Create business", exact: true })
      .click();
    await expect(page).toHaveURL(/\/app\/[a-z0-9]+$/);
    businessId = new URL(page.url()).pathname.split("/")[2]!;
    await page.goto(`/app/${businessId}/services`);
    await page.locator("#add-record > summary").click();
    await page.getByLabel("Name", { exact: true }).fill("Consultation");
    await page.getByLabel("Duration (minutes)").fill("45");
    await page.getByLabel("Price (LKR)").fill("2500");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Consultation", exact: true }),
    ).toBeVisible();
    await page.goto(`/app/${businessId}/staff`);
    await page.locator("#add-record > summary").click();
    await page.getByLabel("Name", { exact: true }).fill("Alex");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const staff = page.locator("details.editor-card");
    await expect(staff).toBeVisible();
    await staff.locator("summary").click();
    await staff.getByLabel("Consultation", { exact: true }).check();
    for (const day of [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]) {
      await staff.getByLabel(day, { exact: true }).check();
      await staff.getByLabel(`${day} start`, { exact: true }).fill("09:15");
      await staff.getByLabel(`${day} end`, { exact: true }).fill("11:15");
    }
    await staff
      .getByRole("button", { name: "Save schedule", exact: true })
      .click();
    await expect(staff.getByRole("status")).toHaveText("Schedule saved.");
    await staff.getByLabel("From date", { exact: true }).fill(date);
    await staff.getByLabel("To date", { exact: true }).fill(date);
    await staff.getByLabel("From time", { exact: true }).fill("09:15");
    await staff.getByLabel("To time", { exact: true }).fill("09:45");
    await staff
      .getByRole("button", { name: "Add time off", exact: true })
      .click();
    await expect(staff.getByRole("status")).toHaveText("Time off saved.");
    const customer = await context.newPage();
    // Exercise the HTTP LAN-browser fallback even on a loopback test host.
    await customer.addInitScript(() =>
      Object.defineProperty(crypto, "randomUUID", {
        value: undefined,
        configurable: true,
      }),
    );
    await customer.goto(`/book/${slug}`);
    await customer.getByLabel("Date", { exact: true }).fill(date);
    await customer
      .getByRole("button", { name: "Find times", exact: false })
      .click();
    const slots = customer.getByRole("button", { name: /Alex/ });
    await expect(slots).toHaveCount(2); // 09:45 and 10:15, 45-minute duration.
    await expect(slots.first()).toContainText(/9:45/);
    await slots.first().click();
    await customer.getByLabel("Name", { exact: true }).fill("Journey Customer");
    await customer
      .getByLabel("Email", { exact: true })
      .fill(`customer-${suffix}@example.test`);
    await customer
      .getByRole("button", { name: "Confirm booking", exact: false })
      .click();
    await expect(customer.getByRole("status")).toContainText(
      "Booking confirmed. Reference:",
    );
    await page.goto(`/app/${businessId}/appointments`);
    const appointment = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: "Journey Customer",
        exact: true,
      }),
    });
    await expect(appointment).toContainText(/confirmed/i);
    // The second candidate overlaps the booked 45-minute service and must disappear.
    await customer.reload();
    await customer.getByLabel("Date", { exact: true }).fill(date);
    await customer
      .getByRole("button", { name: "Find times", exact: false })
      .click();
    await expect(customer.getByRole("status")).toHaveText(
      "No times are available on this date.",
    );
    await appointment
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(appointment).toContainText(/cancelled/i);
    await customer
      .getByRole("button", { name: "Find times", exact: false })
      .click();
    await expect(slots).toHaveCount(2);
    await slots.first().click();
    await customer.getByLabel("Name", { exact: true }).fill("Second Customer");
    await customer
      .getByLabel("Email", { exact: true })
      .fill(`second-${suffix}@example.test`);
    await customer
      .getByRole("button", { name: "Confirm booking", exact: false })
      .click();
    await expect(customer.getByRole("status")).toContainText(
      "Booking confirmed.",
    );
    await page.reload();
    const second = page.locator("article").filter({
      has: page.getByRole("heading", {
        name: "Second Customer",
        exact: true,
      }),
    });
    await second.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(second).toContainText(/completed/i);
    expect(
      await sql(
        `SELECT count(*) FROM "Appointment" WHERE "businessId"='${businessId}'`,
      ),
    ).toBe("2");
    expect(
      await customer.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (testInfo.project.name === "chromium") {
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await customer.setViewportSize({ width, height: 1000 });
        await page.goto(`/app/${businessId}/staff`);
        await page.locator("details.editor-card > summary").click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`staff-${width}.png`),
          fullPage: true,
          caret: "initial",
        });
        if (width < 1024) {
          await page.getByRole("button", { name: "Open navigation" }).click();
          const drawer = page.getByRole("dialog", {
            name: "Workspace navigation",
          });
          await expect(drawer).toBeVisible();
          await drawer
            .getByRole("link", { name: "Appointments", exact: true })
            .click();
          await expect(drawer).not.toBeVisible();
        } else {
          await page.goto(`/app/${businessId}/appointments`);
        }
        await expect(page).toHaveURL(
          new RegExp(`/app/${businessId}/appointments$`),
        );
        await expect(
          page.getByRole("heading", { name: "Second Customer", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`appointments-${width}.png`),
          fullPage: true,
          caret: "initial",
        });
        await customer.reload();
        await expect(
          customer.getByRole("heading", { name, exact: true }),
        ).toBeVisible();
        expect(
          await customer.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await customer.screenshot({
          path: testInfo.outputPath(`public-booking-${width}.png`),
          fullPage: true,
          caret: "initial",
        });
      }
    }
    await customer.close();
  } finally {
    // Delete only this test's random fixture graph, including on partial onboarding failure.
    await sql(`BEGIN;
      DELETE FROM "BookingRequest" WHERE "businessId" IN (SELECT id FROM "Business" WHERE slug='${slug}');
      DELETE FROM "Appointment" WHERE "businessId" IN (SELECT id FROM "Business" WHERE slug='${slug}');
      DELETE FROM "AuditLog" WHERE "businessId" IN (SELECT id FROM "Business" WHERE slug='${slug}') OR "actorId" IN (SELECT id FROM "User" WHERE email='${email}');
      DELETE FROM "Business" WHERE slug='${slug}';
      DELETE FROM "User" WHERE email='${email}'; COMMIT;`);
  }
});
