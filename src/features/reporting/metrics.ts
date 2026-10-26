import { businessLocalDate } from "@/features/booking-engine/slots";
import { shiftDay } from "@/features/calendar/dates";
export type ReportRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  staffId: string;
  serviceId: string;
  service: string;
  staff: string;
};
export function appointmentMetrics(
  rows: ReportRecord[],
  from: string,
  to: string,
  timezone: string,
) {
  const days = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) {
    if (days.length >= 93) throw Error("Reporting range too large");
    days.push({ day: d, count: 0 });
  }
  const inside = rows.filter((r) => {
    const d = businessLocalDate(new Date(r.startsAt), timezone);
    return d >= from && d <= to;
  });
  const services = new Map<string, { name: string; count: number }>(),
    staff = new Map<string, { name: string; minutes: number }>();
  for (const r of inside) {
    const day = days.find(
      (d) => d.day === businessLocalDate(new Date(r.startsAt), timezone),
    );
    if (day) day.count++;
    if (!["CANCELLED", "NO_SHOW"].includes(r.status)) {
      const s = services.get(r.serviceId) ?? { name: r.service, count: 0 };
      s.count++;
      services.set(r.serviceId, s);
    }
    if (r.status === "COMPLETED") {
      const s = staff.get(r.staffId) ?? { name: r.staff, minutes: 0 };
      s.minutes += Math.max(
        0,
        (Date.parse(r.endsAt) - Date.parse(r.startsAt)) / 60000,
      );
      staff.set(r.staffId, s);
    }
  }
  const cancelled = inside.filter((r) => r.status === "CANCELLED").length,
    noShow = inside.filter((r) => r.status === "NO_SHOW").length,
    completed = inside.filter((r) => r.status === "COMPLETED").length;
  return {
    total: inside.length,
    cancelled,
    noShow,
    completed,
    cancellationRate: inside.length ? cancelled / inside.length : null,
    noShowRate: inside.length ? noShow / inside.length : null,
    days,
    services: [...services.values()].sort((a, b) => b.count - a.count),
    staff: [...staff.values()].sort((a, b) => b.minutes - a.minutes),
  };
}
/** Spreadsheet-formula injection protection applies even inside quoted CSV fields. */
export function csvCell(value: string) {
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function reportCsv(rows: ReportRecord[], timezone: string) {
  return (
    "\uFEFF" +
    [
      [
        "Appointment",
        "Business date",
        "Starts (UTC)",
        "Ends (UTC)",
        "Service",
        "Staff",
        "Status",
      ],
      ...rows.map((r) => [
        r.id,
        businessLocalDate(new Date(r.startsAt), timezone),
        r.startsAt,
        r.endsAt,
        r.service,
        r.staff,
        r.status,
      ]),
    ]
      .map((r) => r.map(csvCell).join(","))
      .join("\r\n")
  );
}
