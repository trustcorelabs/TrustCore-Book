"use client";

import { CalendarDays, Clock3, Pencil } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addStaffTimeOff,
  editCatalogRecord,
  removeStaffTimeOff,
  saveStaffSchedule,
} from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Rule = { weekday: number; startMinute: number; endMinute: number };
type Staff = {
  id: string;
  name: string;
  active: boolean;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  serviceIds: string[];
  rules: Rule[];
  timeOff: { id: string; startsAt: string; endsAt: string }[];
};
type Service = { id: string; name: string; active: boolean };
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const minutes = (value: string) => {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
};

function StaffRow({
  businessId,
  staff,
  services,
  timezone,
  today,
  readOnly = false,
}: {
  businessId: string;
  staff: Staff;
  services: Service[];
  timezone: string;
  today: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(staff.name);
  const [before, setBefore] = useState(staff.bufferBeforeMinutes ?? 0),
    [after, setAfter] = useState(staff.bufferAfterMinutes ?? 0);
  const [active, setActive] = useState(staff.active);
  const [assigned, setAssigned] = useState(staff.serviceIds);
  const [rules, setRules] = useState<Rule[]>(staff.rules);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState("");
  const setDay = (weekday: number, rule?: Rule) =>
    setRules((current) => [
      ...current.filter((item) => item.weekday !== weekday),
      ...(rule ? [rule] : []),
    ]);
  async function saveProfile() {
    setBusy(true);
    setMessage("");
    try {
      const result = await editCatalogRecord(businessId, "staff", {
        id: staff.id,
        name,
        active,
        bufferBeforeMinutes: before,
        bufferAfterMinutes: after,
      });
      setMessage(result.error ?? result.success ?? "");
      if (result.success) startRefresh(() => router.refresh());
    } catch {
      setMessage("Unable to save staff details.");
    } finally {
      setBusy(false);
    }
  }
  async function saveSchedule() {
    setBusy(true);
    setMessage("");
    try {
      const result = await saveStaffSchedule(businessId, {
        staffId: staff.id,
        serviceIds: assigned,
        rules,
      });
      setMessage(result.error ?? result.success ?? "");
      if (result.success) startRefresh(() => router.refresh());
    } catch {
      setMessage("Unable to save schedule.");
    } finally {
      setBusy(false);
    }
  }
  async function addTimeOff(form: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const result = await addStaffTimeOff(businessId, {
        staffId: staff.id,
        startDate: form.get("startDate"),
        startTime: form.get("startTime"),
        endDate: form.get("endDate"),
        endTime: form.get("endTime"),
      });
      setMessage(result.error ?? result.success ?? "");
      if (result.success) startRefresh(() => router.refresh());
    } catch {
      setMessage("Unable to save time off.");
    } finally {
      setBusy(false);
    }
  }
  async function removeTimeOff(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const result = await removeStaffTimeOff(businessId, staff.id, id);
      setMessage(result.error ?? result.success ?? "");
      if (result.success) startRefresh(() => router.refresh());
    } catch {
      setMessage("Unable to remove time off.");
    } finally {
      setBusy(false);
    }
  }
  const summary = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="icon-tile tone-teal text-sm font-bold">
          {staff.name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </span>
        <StatusBadge status={staff.active ? "active" : "inactive"} />
      </div>
      <h3 className="mt-5 text-base font-bold">{staff.name}</h3>
      <p className="mt-2 break-words text-xs leading-6 text-muted-foreground">
        {services
          .filter((service) => staff.serviceIds.includes(service.id))
          .map((service) => service.name)
          .join(" · ") || "No services assigned"}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock3 size={14} />
          {staff.rules.length} working days / week
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays size={14} />
          {staff.timeOff.length} time-off periods
        </span>
      </div>
      {staff.rules.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {staff.rules
            .map(
              (r) =>
                `${days[r.weekday]?.slice(0, 3)} ${clock(r.startMinute)}–${clock(r.endMinute)}`,
            )
            .join(" · ")}
        </p>
      )}
      {!readOnly && (
        <span className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs font-semibold text-primary-ink">
          <Pencil size={13} />
          Edit profile, services & hours
        </span>
      )}
    </>
  );
  if (readOnly) return <article className="editor-card">{summary}</article>;
  return (
    <details className="editor-card">
      <summary>{summary}</summary>
      <fieldset
        disabled={busy || refreshing}
        aria-busy={busy || refreshing}
        className="mt-5 grid min-w-0 gap-6 xl:grid-cols-2"
      >
        <section aria-label={`${staff.name} details`}>
          <label htmlFor={`staff-name-${staff.id}`}>Name</label>
          <Input
            id={`staff-name-${staff.id}`}
            value={name}
            minLength={2}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />{" "}
            Active for new bookings
          </label>
          <div className="my-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["before", before, setBefore],
                ["after", after, setAfter],
              ] as const
            ).map(([key, value, set]) => (
              <div key={key}>
                <label htmlFor={`${staff.id}-${key}`}>
                  Buffer {key} (minutes)
                </label>
                <input
                  className="input"
                  id={`${staff.id}-${key}`}
                  type="number"
                  min="0"
                  max="180"
                  required
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                />
              </div>
            ))}
          </div>
          <Button
            className="mt-4"
            type="button"
            disabled={busy}
            onClick={saveProfile}
          >
            Save details
          </Button>
        </section>
        <section aria-label={`${staff.name} schedule`}>
          <h3 className="text-sm font-semibold">Services</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {services
              .filter(
                (service) => service.active || assigned.includes(service.id),
              )
              .map((service) => (
                <label
                  key={service.id}
                  className="mb-0 flex items-start gap-2 text-sm leading-5"
                >
                  <input
                    type="checkbox"
                    checked={assigned.includes(service.id)}
                    disabled={busy}
                    onChange={(event) =>
                      setAssigned((current) =>
                        event.target.checked
                          ? [...current, service.id]
                          : current.filter((id) => id !== service.id),
                      )
                    }
                  />
                  {service.name}
                </label>
              ))}
          </div>
          <h3 className="mt-5 text-sm font-semibold">Weekly hours</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Times use {timezone}. An end time of 00:00 means midnight at the end
            of the day.
          </p>
          <div className="mt-2 space-y-2">
            {days.map((day, weekday) => {
              const rule = rules.find((item) => item.weekday === weekday);
              return (
                <div
                  key={day}
                  className="grid grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-xs sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <label className="mb-0 flex items-center gap-2 leading-4">
                    <input
                      type="checkbox"
                      aria-label={day}
                      checked={!!rule}
                      onChange={(event) =>
                        setDay(
                          weekday,
                          event.target.checked
                            ? { weekday, startMinute: 540, endMinute: 1020 }
                            : undefined,
                        )
                      }
                    />
                    <span className="sm:hidden">{day.slice(0, 3)}</span>
                    <span className="hidden sm:inline">{day}</span>
                  </label>
                  <input
                    aria-label={`${day} start`}
                    type="time"
                    className="h-10 w-full min-w-0 rounded-md border border-border bg-background px-1"
                    disabled={!rule}
                    value={clock(rule?.startMinute ?? 540)}
                    onChange={(event) =>
                      rule &&
                      setDay(weekday, {
                        ...rule,
                        startMinute: minutes(event.target.value),
                      })
                    }
                  />
                  <input
                    aria-label={`${day} end`}
                    type="time"
                    className="h-10 w-full min-w-0 rounded-md border border-border bg-background px-1"
                    disabled={!rule}
                    value={clock((rule?.endMinute ?? 1020) % 1440)}
                    onChange={(event) =>
                      rule &&
                      setDay(weekday, {
                        ...rule,
                        endMinute: minutes(event.target.value) || 1440,
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
          <Button
            className="mt-4"
            type="button"
            disabled={busy}
            onClick={saveSchedule}
          >
            Save schedule
          </Button>
          <div className="mt-7 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Time off ({timezone})</h3>
            <form
              action={addTimeOff}
              className="mt-3 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2"
            >
              <div>
                <label htmlFor={`off-start-date-${staff.id}`}>From date</label>
                <Input
                  id={`off-start-date-${staff.id}`}
                  name="startDate"
                  type="date"
                  min={today}
                  defaultValue={today}
                  required
                />
              </div>
              <div>
                <label htmlFor={`off-start-time-${staff.id}`}>From time</label>
                <Input
                  id={`off-start-time-${staff.id}`}
                  name="startTime"
                  type="time"
                  defaultValue="09:00"
                  required
                />
              </div>
              <div>
                <label htmlFor={`off-end-date-${staff.id}`}>To date</label>
                <Input
                  id={`off-end-date-${staff.id}`}
                  name="endDate"
                  type="date"
                  min={today}
                  defaultValue={today}
                  required
                />
              </div>
              <div>
                <label htmlFor={`off-end-time-${staff.id}`}>To time</label>
                <Input
                  id={`off-end-time-${staff.id}`}
                  name="endTime"
                  type="time"
                  defaultValue="17:00"
                  required
                />
              </div>
              <Button
                className="justify-self-start min-[400px]:col-span-2"
                type="submit"
                disabled={busy}
              >
                Add time off
              </Button>
            </form>
            {staff.timeOff.length > 0 && (
              <ul className="mt-4 divide-y divide-border border-t border-border">
                {staff.timeOff.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-3 text-xs"
                  >
                    <span>
                      {new Intl.DateTimeFormat("en", {
                        timeZone: timezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.startsAt))}{" "}
                      to{" "}
                      {new Intl.DateTimeFormat("en", {
                        timeZone: timezone,
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.endsAt))}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-md border border-border px-2 py-1"
                      onClick={() => removeTimeOff(item.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </fieldset>
      {message && (
        <p role="status" className="notice mt-4">
          {message}
        </p>
      )}
    </details>
  );
}

export function StaffEditor({
  businessId,
  staff,
  services,
  timezone,
  today,
  readOnly = false,
}: {
  businessId: string;
  staff: Staff[];
  services: Service[];
  timezone: string;
  today: string;
  readOnly?: boolean;
}) {
  return (
    <section
      className="grid items-stretch gap-5 xl:grid-cols-2"
      aria-label="Manage staff schedules"
    >
      {staff.map((person) => (
        <StaffRow
          key={person.id}
          businessId={businessId}
          staff={person}
          services={services}
          timezone={timezone}
          today={today}
          readOnly={readOnly}
        />
      ))}
    </section>
  );
}
