"use client";
import { useState } from "react";
import { CalendarDays, Search, Clock3, UserRound, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { StatusBadge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { AppointmentControls } from "@/features/appointments/appointment-controls";
import { businessLocalDate } from "@/features/booking-engine/slots";
export type AppointmentView = {
  id: string;
  customer: string;
  service: string;
  staff: string;
  startsAt: string;
  endsAt: string;
  status: string;
};
export function AppointmentList({
  appointments,
  businessId,
  timezone,
  manage = false,
}: {
  appointments: AppointmentView[];
  businessId: string;
  timezone: string;
  manage?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const filtered = appointments.filter(
    (a) =>
      (!query ||
        `${a.customer} ${a.service} ${a.staff}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!date || businessLocalDate(new Date(a.startsAt), timezone) === date) &&
      (!status || a.status === status),
  );
  const clock = (value: string) =>
    new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  return (
    <section aria-label="Appointment list">
      <div className="surface mb-5 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 basis-full sm:basis-56 sm:flex-1">
          <label htmlFor="appointment-search">Find an appointment</label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              id="appointment-search"
              className="pl-9"
              placeholder="Customer, service or staff…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 basis-32 sm:max-w-48">
          <label htmlFor="appointment-date">Date</label>
          <Input
            id="appointment-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="min-w-0 flex-1 basis-32 sm:max-w-44">
          <label htmlFor="appointment-status">Status</label>
          <select
            id="appointment-status"
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
        {(query || date || status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setDate("");
              setStatus("");
            }}
          >
            <X size={14} />
            Clear
          </Button>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {filtered.length} appointment{filtered.length === 1 ? "" : "s"} · All
        times in {timezone}
      </p>
      {filtered.length ? (
        <div className="space-y-3">
          {filtered.map((a) => (
            <article key={a.id} className="surface p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="tone-sky flex w-16 shrink-0 flex-col items-center rounded-xl py-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {new Intl.DateTimeFormat("en", {
                      timeZone: timezone,
                      month: "short",
                    }).format(new Date(a.startsAt))}
                  </span>
                  <span className="text-2xl font-bold">
                    {new Intl.DateTimeFormat("en", {
                      timeZone: timezone,
                      day: "2-digit",
                    }).format(new Date(a.startsAt))}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-base font-bold">
                    {a.customer}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {a.service}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={14} />
                      {clock(a.startsAt)} – {clock(a.endsAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UserRound size={14} />
                      {a.staff}
                    </span>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
              {manage && (
                <AppointmentControls
                  compact
                  businessId={businessId}
                  timezone={timezone}
                  appointments={[a]}
                />
              )}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            appointments.length
              ? "No appointments match"
              : "A clear calendar, a fresh start"
          }
          description={
            appointments.length
              ? "Try a different date, status or search term."
              : "Customer bookings will appear here. Assign services and working hours to your staff, then share your booking link."
          }
        >
          <CalendarDays size={24} className="text-sky-ink" />
        </EmptyState>
      )}
    </section>
  );
}
