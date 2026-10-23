"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeAppointmentStatus } from "@/server/actions";

type Appointment = {
  id: string;
  customer: string;
  startsAt: string;
  status: string;
};
export function AppointmentControls({
  businessId,
  appointments,
  timezone,
  compact = false,
}: {
  businessId: string;
  appointments: Appointment[];
  timezone: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function change(
    id: string,
    status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
  ) {
    setBusy(id);
    setMessage("");
    try {
      const result = await changeAppointmentStatus(businessId, id, status);
      setMessage(result.error ?? result.success ?? "");
      if (result.success) router.refresh();
    } catch {
      setMessage("Unable to update appointment.");
    } finally {
      setBusy(null);
    }
  }
  const open = appointments.filter(
    (appointment) =>
      appointment.status === "PENDING" || appointment.status === "CONFIRMED",
  );
  if (!open.length) return null;
  return (
    <section
      className={
        compact ? "mt-4 border-t border-border pt-4" : "surface mt-6 p-5"
      }
      aria-label="Manage appointments"
    >
      {!compact && (
        <h2 className="text-lg font-semibold">Manage appointments</h2>
      )}
      <div className={compact ? "" : "mt-4 divide-y divide-border"}>
        {open.map((appointment) => (
          <div
            key={appointment.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
          >
            <div className={compact ? "sr-only" : undefined}>
              <strong>{appointment.customer}</strong>
              <span className="ml-2 text-muted-foreground">
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: timezone,
                }).format(new Date(appointment.startsAt))}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {appointment.status === "PENDING" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
                  onClick={() => change(appointment.id, "CONFIRMED")}
                >
                  Confirm
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-50"
                onClick={() => change(appointment.id, "COMPLETED")}
              >
                Complete
              </button>
              <button
                type="button"
                disabled={busy !== null}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-50"
                onClick={() => change(appointment.id, "NO_SHOW")}
              >
                No-show
              </button>
              <button
                type="button"
                disabled={busy !== null}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-50"
                onClick={() => change(appointment.id, "CANCELLED")}
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
