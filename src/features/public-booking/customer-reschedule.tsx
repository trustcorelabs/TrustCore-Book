"use client";
import { useState } from "react";
import {
  loadCustomerRescheduleSlots,
  moveCustomerBooking,
} from "@/server/actions";
import { Button } from "@/components/ui/button";
export function CustomerReschedule({
  token,
  timezone,
  onComplete,
}: {
  token: string;
  timezone: string;
  onComplete: () => Promise<void>;
}) {
  const [date, setDate] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [slots, setSlots] = useState<{ startsAt: string; endsAt: string }[]>(
      [],
    ),
    [selected, setSelected] = useState("");
  const [authorization, setAuthorization] = useState("");
  async function find() {
    setBusy(true);
    setMessage("");
    setSelected("");
    setSlots([]);
    setAuthorization("");
    try {
      const r = await loadCustomerRescheduleSlots(token, date);
      if (r.error) setMessage(r.error);
      else {
        setSlots(r.slots ?? []);
        setAuthorization(r.authorization ?? "");
        if (!r.slots?.length) setMessage("No available times on this date.");
      }
    } catch {
      setMessage("Unable to load times. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function move() {
    setBusy(true);
    setMessage("");
    try {
      const r = await moveCustomerBooking(token, {
        startsAt: selected,
        authorization,
      });
      setMessage(r.error ?? r.success ?? "Unable to move.");
      if (r.success) {
        setSlots([]);
        setSelected("");
        await onComplete();
      }
    } catch {
      setMessage(
        "The response was interrupted. Retry the same request; do not select a different time until you refresh the booking.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="min-h-11 py-2 text-sm font-semibold">
        Reschedule this appointment
      </summary>
      <p className="my-3 text-sm leading-6 text-muted-foreground">
        Choose a new time with the same professional. Your booked price,
        services and duration stay fixed. Availability is checked again before
        saving. Times are authorized for 15 minutes; refresh them if your
        session expires.
      </p>
      <fieldset disabled={busy} className="space-y-4">
        <div>
          <label htmlFor="reschedule-date">New appointment date</label>
          <input
            className="input"
            id="reschedule-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSlots([]);
              setSelected("");
              setAuthorization("");
            }}
          />
        </div>
        <Button
          variant="outline"
          type="button"
          disabled={!date || busy}
          onClick={find}
        >
          {busy ? "Working…" : "Find reschedule times"}
        </Button>
        {slots.length > 0 && (
          <>
            <label htmlFor="reschedule-slot">New time ({timezone})</label>
            <select
              className="input"
              id="reschedule-slot"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
              }}
            >
              <option value="">Select a time</option>
              {slots.map((s) => (
                <option key={s.startsAt} value={s.startsAt}>
                  {new Intl.DateTimeFormat("en", {
                    timeZone: timezone,
                    hour: "numeric",
                    minute: "2-digit",
                    timeZoneName: "shortOffset",
                  }).format(new Date(s.startsAt))}
                </option>
              ))}
            </select>
            <Button type="button" disabled={!selected || busy} onClick={move}>
              Confirm new time
            </Button>
          </>
        )}
      </fieldset>
      {message && (
        <p role="status" className="notice mt-4">
          {message}
        </p>
      )}
    </details>
  );
}
