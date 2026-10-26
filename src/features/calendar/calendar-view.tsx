"use client";
import { useVocabulary } from "@/features/industries/vocabulary-context";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { calendarDays, moveCalendar, type CalendarMode } from "./dates";
import { businessLocalDate } from "@/features/booking-engine/slots";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { AppointmentControls } from "@/features/appointments/appointment-controls";
import { RescheduleForm } from "@/features/appointments/reschedule-form";
import { useHydrated } from "@/hooks/use-hydrated";
export type CalendarAppointment = {
  id: string;
  staffId: string;
  customer: string;
  service: string;
  staff: string;
  startsAt: string;
  endsAt: string;
  status: string;
};
export type CalendarStaff = {
  id: string;
  name: string;
  active: boolean;
  rules: { weekday: number; startMinute: number; endMinute: number }[];
  timeOff: { startsAt: string; endsAt: string }[];
};
export function CalendarView({
  businessId,
  timezone,
  day,
  mode,
  appointments,
  staff,
  manage = false,
  truncated = false,
  canReschedule = false,
}: {
  businessId: string;
  timezone: string;
  day: string;
  mode: CalendarMode;
  appointments: CalendarAppointment[];
  staff: CalendarStaff[];
  manage?: boolean;
  truncated?: boolean;
  canReschedule?: boolean;
}) {
  const words = useVocabulary();
  const hydrated = useHydrated(),
    dialog = useRef<HTMLDialogElement>(null);
  const [staffId, setStaffId] = useState(""),
    [status, setStatus] = useState(""),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const days = calendarDays(day, mode);
  const selected = appointments.find((a) => a.id === selectedId) ?? null;
  const filtered = appointments.filter(
    (a) =>
      (!staffId || a.staffId === staffId) && (!status || a.status === status),
  );
  const visibleStaff = staff.filter(
    (s) => s.active && (!staffId || s.id === staffId),
  );
  const base = `/app/${businessId}/calendar`;
  const clock = (iso: string) =>
    new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(d + "T12:00:00Z"));
  const covering = (a: { startsAt: string; endsAt: string }, d: string) =>
    businessLocalDate(new Date(a.startsAt), timezone) <= d &&
    businessLocalDate(new Date(Date.parse(a.endsAt) - 1), timezone) >= d;
  const card = (a: CalendarAppointment) => (
    <button
      key={a.id}
      type="button"
      disabled={!hydrated}
      onClick={() => {
        setSelectedId(a.id);
        dialog.current?.showModal();
      }}
      className={`calendar-event status-${a.status.toLowerCase()} w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary focus-visible:outline-primary`}
    >
      <span className="block text-[11px] font-semibold">
        {clock(a.startsAt)}–{clock(a.endsAt)}
      </span>
      <span className="mt-1 block break-words text-xs font-bold">
        {a.customer}
      </span>
      <span className="mt-1 block break-words text-[11px] text-muted-foreground">
        {a.service} · {a.staff}
      </span>
      <span className="mt-2 block">
        <StatusBadge status={a.status} />
      </span>
    </button>
  );
  return (
    <section aria-label="Business calendar">
      <div className="surface mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              aria-label="Previous calendar period"
              href={`${base}?day=${moveCalendar(day, mode, -1)}&view=${mode}`}
            >
              <ChevronLeft size={16} />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              aria-label="Next calendar period"
              href={`${base}?day=${moveCalendar(day, mode, 1)}&view=${mode}`}
            >
              <ChevronRight size={16} />
            </Link>
          </Button>
        </div>
        <form className="flex min-w-0 flex-wrap items-end gap-2" action={base}>
          <div>
            <label htmlFor="calendar-day">Calendar date</label>
            <input
              id="calendar-day"
              className="input max-w-44"
              type="date"
              name="day"
              defaultValue={day}
              min="1901-01-01"
              max="2199-12-31"
              required
            />
          </div>
          <input type="hidden" name="view" value={mode} />
          <Button type="submit" size="sm" variant="outline">
            Go
          </Button>
        </form>
        <div
          className="flex flex-wrap gap-1 rounded-xl bg-muted p-1"
          aria-label="Calendar view"
        >
          {(["day", "week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={`${base}?day=${day}&view=${v}`}
              aria-current={mode === v ? "page" : undefined}
              className={`rounded-lg px-4 py-3 text-xs font-semibold capitalize ${mode === v ? "bg-card text-primary-ink shadow-card" : "text-muted-foreground"}`}
            >
              {v}
            </Link>
          ))}
        </div>
        <div className="min-w-36 flex-1">
          <label htmlFor="calendar-staff">{words.team}</label>
          <select
            id="calendar-staff"
            disabled={!hydrated}
            className="input"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">All {words.team.toLowerCase()}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-36 flex-1">
          <label htmlFor="calendar-status">Status</label>
          <select
            id="calendar-status"
            disabled={!hydrated}
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map(
              (s) => (
                <option key={s} value={s}>
                  {s.toLowerCase().replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
      <p className="mb-4 text-xs leading-6 text-muted-foreground">
        All times in {timezone}. Select an appointment for details. Schedule
        changes are not performed by dragging.
      </p>
      {truncated && (
        <p role="status" className="notice mb-5">
          Partial view: first 2,000 overlapping appointments. Switch to a
          shorter date range to see all records.
        </p>
      )}
      <div
        className="space-y-3 md:hidden"
        aria-label="Calendar accessible agenda"
      >
        {days.map((d) => {
          const rows = filtered.filter((a) => covering(a, d));
          return (
            <section key={d} className="surface p-4">
              <h2 className="mb-3 text-sm font-semibold">{dayLabel(d)}</h2>
              {rows.length ? (
                <div className="space-y-2">{rows.map(card)}</div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No appointments in this view.
                </p>
              )}
            </section>
          );
        })}
      </div>
      <div
        className={`calendar-grid hidden gap-2 md:grid ${mode === "day" ? "grid-cols-1" : "grid-cols-7"}`}
        aria-label="Calendar date grid"
      >
        {days.map((d) => {
          const rows = filtered.filter((a) => covering(a, d)),
            weekday = new Date(d + "T12:00:00Z").getUTCDay();
          return (
            <section
              key={d}
              className={`surface min-w-0 p-3 ${mode === "month" && d.slice(0, 7) !== day.slice(0, 7) ? "opacity-65" : ""}`}
            >
              <h2 className="mb-3 text-xs font-semibold">{dayLabel(d)}</h2>
              <div className="space-y-2">
                {rows.map(card)}
                {!rows.length && (
                  <p className="py-4 text-[11px] leading-5 text-muted-foreground">
                    No appointments
                  </p>
                )}
              </div>
              {mode !== "month" && (
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  {visibleStaff.map((s) => {
                    const hours = s.rules.filter((r) => r.weekday === weekday),
                      off = s.timeOff.filter((e) => covering(e, d));
                    return (
                      <div
                        key={s.id}
                        className="rounded-lg bg-muted/60 p-2 text-[10px] leading-5"
                      >
                        <p className="font-semibold">{s.name}</p>
                        {hours.length ? (
                          hours.map((r, i) => (
                            <p key={i}>
                              <Clock3 size={10} className="mr-1 inline" />
                              {String(Math.floor(r.startMinute / 60)).padStart(
                                2,
                                "0",
                              )}
                              :{String(r.startMinute % 60).padStart(2, "0")}–
                              {String(Math.floor(r.endMinute / 60)).padStart(
                                2,
                                "0",
                              )}
                              :{String(r.endMinute % 60).padStart(2, "0")}
                            </p>
                          ))
                        ) : (
                          <p className="text-muted-foreground">
                            No working hours
                          </p>
                        )}
                        {off.map((e, i) => (
                          <p key={i} className="text-destructive">
                            Time off · {clock(e.startsAt)}–{clock(e.endsAt)}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {staff.length === 0 && (
        <p className="notice mt-5 flex items-center gap-2">
          <CalendarDays size={17} />
          Add staff and working schedules to see team availability.
        </p>
      )}
      <dialog
        ref={dialog}
        aria-label="Appointment details"
        onClose={() => setSelectedId(null)}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-card p-6 text-foreground shadow-float backdrop:bg-foreground/40"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Appointment details</h2>
          <button
            type="button"
            aria-label="Close appointment details"
            onClick={() => dialog.current?.close()}
            className="grid size-11 place-items-center rounded-xl hover:bg-muted"
          >
            <X size={19} />
          </button>
        </div>
        {selected && (
          <>
            <p className="text-lg font-semibold">{selected.customer}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {selected.service} · {selected.staff}
            </p>
            <p className="mt-4 text-sm">
              {dayLabel(
                businessLocalDate(new Date(selected.startsAt), timezone),
              )}{" "}
              · {clock(selected.startsAt)}–{clock(selected.endsAt)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{timezone}</p>
            <div className="my-5">
              <StatusBadge status={selected.status} />
            </div>
            {manage &&
              canReschedule &&
              ["PENDING", "CONFIRMED"].includes(selected.status) && (
                <RescheduleForm
                  key={selected.id + selected.startsAt}
                  businessId={businessId}
                  id={selected.id}
                  startsAt={selected.startsAt}
                  timezone={timezone}
                />
              )}
            {manage && (
              <AppointmentControls
                businessId={businessId}
                timezone={timezone}
                compact
                appointments={[
                  {
                    id: selected.id,
                    status: selected.status,
                    customer: selected.customer,
                    startsAt: selected.startsAt,
                  },
                ]}
              />
            )}
          </>
        )}
      </dialog>
    </section>
  );
}
