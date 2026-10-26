import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireTenant: vi.fn(),
  rateLimit: vi.fn(),
  readCalendar: vi.fn(),
  readReportAppointments: vi.fn(),
  readAudit: vi.fn(),
  readCustomerHistory: vi.fn(),
}));
vi.mock("@/server/authorization", () => ({
  requireTenant: mocks.requireTenant,
}));
vi.mock("@/server/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/server/repositories/insights", () => mocks);
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
import {
  auditData,
  customerHistory,
  reportingData,
  calendarData,
} from "@/server/insights";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireTenant.mockResolvedValue({
    context: { businessId: "verified" },
    member: { role: "OWNER" },
    business: { timezone: "Asia/Colombo" },
    user: { id: "actor" },
  });
  mocks.readReportAppointments.mockResolvedValue({
    rows: [],
    truncated: false,
  });
  mocks.readCalendar.mockResolvedValue({
    rows: [],
    staff: [],
    truncated: false,
  });
});
it("requires current manager membership for audit and export before any repository access", async () => {
  mocks.requireTenant.mockRejectedValue(Error("DENIED"));
  await expect(auditData("foreign")).rejects.toThrow("DENIED");
  await expect(reportingData("foreign", {}, true)).rejects.toThrow("DENIED");
  expect(mocks.readAudit).not.toHaveBeenCalled();
  expect(mocks.readReportAppointments).not.toHaveBeenCalled();
  expect(mocks.requireTenant).toHaveBeenCalledWith("foreign", true);
});
it("rate limits exports before fetching records and supplies verified scope only", async () => {
  await reportingData(
    "requested",
    { from: "2026-10-25", to: "2026-10-25" },
    true,
  );
  expect(mocks.rateLimit).toHaveBeenCalledWith("report-export:actor", 10, 60);
  expect(mocks.rateLimit.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.readReportAppointments.mock.invocationCallOrder[0]!,
  );
  expect(mocks.readReportAppointments.mock.calls[0]![0]).toEqual({
    businessId: "verified",
  });
});
it("rejects invalid report ranges without running a report query", async () => {
  const result = await reportingData("requested", {
    from: "2026-01-01",
    to: "2026-10-25",
  });
  expect(result.error).toBeDefined();
  expect(mocks.readReportAppointments).not.toHaveBeenCalled();
});
it("requires current tenant membership for customer history and calendar reads", async () => {
  mocks.requireTenant.mockRejectedValue(Error("DENIED"));
  await expect(
    customerHistory("foreign", "cm12345678901234567890123"),
  ).rejects.toThrow();
  await expect(calendarData("foreign", {})).rejects.toThrow();
  expect(mocks.readCustomerHistory).not.toHaveBeenCalled();
  expect(mocks.readCalendar).not.toHaveBeenCalled();
});
