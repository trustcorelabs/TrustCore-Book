import { expect, it } from "vitest";
import {
  appointmentMetrics,
  csvCell,
  reportCsv,
  type ReportRecord,
} from "@/features/reporting/metrics";
const row = (status: string, service = "Care"): ReportRecord => ({
  id: "fixture",
  startsAt: "2026-10-24T20:00:00Z",
  endsAt: "2026-10-24T21:00:00Z",
  status,
  staffId: "staff",
  serviceId: "service",
  service,
  staff: "Alex",
});
it("has explicit status denominators and business-local dates without inferring revenue", () => {
  const m = appointmentMetrics(
    [row("COMPLETED"), row("CANCELLED"), row("NO_SHOW"), row("PENDING")],
    "2026-10-25",
    "2026-10-25",
    "Asia/Colombo",
  );
  expect(m.total).toBe(4);
  expect(m.cancellationRate).toBe(0.25);
  expect(m.noShowRate).toBe(0.25);
  expect(m.services[0]!.count).toBe(2);
  expect(m.staff[0]!.minutes).toBe(60);
  expect(m.days[0]!.count).toBe(4);
  expect(m).not.toHaveProperty("revenue");
});
it("reports an undefined rate for empty periods", () => {
  expect(
    appointmentMetrics([], "2026-10-25", "2026-10-25", "UTC").cancellationRate,
  ).toBeNull();
});
it("escapes spreadsheet formulas, quotes, commas and multiline content", () => {
  for (const s of ["=1+1", "+CMD", "-2+3", "@SUM(1)", "\t=1", "  =1"])
    expect(csvCell(s).startsWith("\"'")).toBe(true);
  expect(csvCell('a,"b"')).toBe('"a,""b"""');
  expect(reportCsv([row("CONFIRMED", '=HYPERLINK("bad")')], "UTC")).toContain(
    "'=HYPERLINK",
  );
  expect(reportCsv([row("CONFIRMED")], "UTC")).not.toContain("customer");
});
