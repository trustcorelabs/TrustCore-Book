"use client";
import { CustomerReschedule } from "./customer-reschedule";
import { useState, useSyncExternalStore } from "react";
import { lookupBooking, cancelBookingByLink } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { money } from "@/lib/utils";
const subscribe = () => () => {};
export function ManageBooking() {
  const token = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(location.hash.slice(1)).get("token") ?? "",
    () => "",
  );
  const [result, setResult] = useState<Awaited<
      ReturnType<typeof lookupBooking>
    > | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      setResult(await lookupBooking(token));
    } catch {
      setMessage("Unable to load the booking. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      const r = await cancelBookingByLink(token);
      setMessage(r.error ?? r.success ?? "Unable to cancel.");
      if (r.success) setResult(await lookupBooking(token));
    } catch {
      setMessage("Unable to cancel. Please contact the business.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Your appointment</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        This private link can view or cancel one booking. Keep it private. Links
        expire seven days after issue. Changes follow the business notice
        policy.
      </p>
      {(!result || result.error) && (
        <Button className="mt-6" disabled={!token || busy} onClick={load}>
          {busy ? "Loading…" : "View booking"}
        </Button>
      )}
      {!token && (
        <p className="notice mt-5">
          Open the complete private link from your booking confirmation.
        </p>
      )}
      {result?.error && (
        <p role="alert" className="notice mt-5">
          {result.error}
        </p>
      )}
      {result && "booking" in result && result.booking && (
        <div className="mt-6 space-y-4">
          <StatusBadge status={result.booking.status} />
          <h2 className="text-lg font-semibold">
            {result.booking.service} · {result.booking.businessName}
          </h2>
          <p className="text-sm">
            {new Intl.DateTimeFormat("en", {
              timeZone: result.booking.timezone,
              dateStyle: "full",
              timeStyle: "short",
            }).format(new Date(result.booking.startsAt))}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.booking.timezone} · {result.booking.staff}
          </p>
          <p className="text-sm font-semibold">
            {money(result.booking.price, result.booking.currency)} · no online
            payment collected
          </p>
          <p className="break-all text-xs text-muted-foreground">
            Reference: {result.booking.reference}
          </p>
          {result.booking.canReschedule && (
            <CustomerReschedule
              token={token}
              timezone={result.booking.timezone}
              onComplete={load}
            />
          )}
          {result.booking.canCancel && (
            <details className="rounded-xl border border-border p-4">
              <summary className="min-h-11 py-2 text-sm font-semibold">
                Cancel this appointment
              </summary>
              <p className="my-3 text-sm leading-6 text-muted-foreground">
                Cancellation releases this time for other customers. Required
                notice: {result.booking.cancellationNoticeMinutes} minutes.
              </p>
              <Button disabled={busy} variant="outline" onClick={cancel}>
                Confirm cancellation
              </Button>
            </details>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="notice mt-5">
          {message}
        </p>
      )}
    </section>
  );
}
