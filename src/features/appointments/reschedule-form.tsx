"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rescheduleRecordedAppointment } from "@/server/actions";
import { businessLocalDate } from "@/features/booking-engine/slots";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "@/components/ui/button";
export function RescheduleForm({
  businessId,
  id,
  startsAt,
  timezone,
}: {
  businessId: string;
  id: string;
  startsAt: string;
  timezone: string;
}) {
  const ready = useHydrated(),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
  return (
    <details className="mt-5 rounded-xl border border-border p-4">
      <summary className="min-h-11 py-2 text-sm font-semibold">
        Reschedule with the same professional
      </summary>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">
        Original booked duration and price are preserved. Working hours, time
        off and conflicts are checked again under a staff lock.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setMessage("");
          try {
            const r = await rescheduleRecordedAppointment(businessId, {
              id,
              date: f.get("date"),
              time: f.get("time"),
            });
            setMessage(r.error ?? r.success ?? "Unable to move.");
            if (r.success) router.refresh();
          } catch {
            setMessage("Unable to reschedule. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset
          disabled={!ready || busy}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="move-date">New date · {timezone}</label>
            <input
              id="move-date"
              className="input"
              type="date"
              name="date"
              defaultValue={businessLocalDate(new Date(startsAt), timezone)}
              required
            />
          </div>
          <div>
            <label htmlFor="move-time">New time</label>
            <input
              id="move-time"
              className="input"
              type="time"
              name="time"
              defaultValue={clock}
              required
            />
          </div>
          <Button className="sm:col-span-2" type="submit">
            {busy ? "Checking…" : "Confirm new time"}
          </Button>
        </fieldset>
      </form>
      {message && (
        <p className="notice mt-4" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
