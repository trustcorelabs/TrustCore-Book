"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBookingPolicy, updateServiceCategory } from "@/server/actions";
import type { BookingPolicy } from "@/features/booking-engine/policy";
import { Button } from "./ui/button";
export function BookingPolicyForm({
  businessId,
  policy,
}: {
  businessId: string;
  policy: BookingPolicy;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="surface mt-6 grid gap-4 p-6 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setBusy(true);
        try {
          const r = await updateBookingPolicy(businessId, data);
          setMessage(r.error ?? r.success ?? "");
        } catch {
          setMessage("Unable to save. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold sm:col-span-2">Booking policy</h2>
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Notice periods use elapsed minutes. Dates and working hours use your
        business timezone. Policies apply to new requests; existing appointment
        prices and durations remain fixed.
      </p>
      {(
        [
          ["bookingLeadMinutes", "Booking lead time (minutes)"],
          ["cancellationNoticeMinutes", "Cancellation notice (minutes)"],
          ["rescheduleNoticeMinutes", "Rescheduling notice (minutes)"],
          ["bookingHorizonDays", "Booking horizon (days)"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={key}>{label}</label>
          <input
            id={key}
            className="input"
            name={key}
            type="number"
            min={key === "bookingHorizonDays" ? 1 : 0}
            max={key === "bookingHorizonDays" ? 180 : 10080}
            defaultValue={policy[key]}
            required
            disabled={busy}
          />
        </div>
      ))}
      <Button disabled={busy} type="submit">
        {busy ? "Saving…" : "Save booking policy"}
      </Button>
      {message && (
        <p role="status" className="notice sm:col-span-2">
          {message}
        </p>
      )}
    </form>
  );
}
export function CategoryManager({
  businessId,
  categories,
}: {
  businessId: string;
  categories: { id: string; name: string }[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function save(form: HTMLFormElement, id?: string) {
    setBusy(true);
    try {
      const r = await updateServiceCategory(businessId, {
        id,
        name: new FormData(form).get("name"),
      });
      setMessage(r.error ?? r.success ?? "");
      if (r.success) {
        if (!id) form.reset();
        router.refresh();
      }
    } catch {
      setMessage("Unable to save category.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="surface mb-6 p-5">
      <summary className="cursor-pointer py-2 font-semibold">
        Service categories
      </summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[...categories, { id: "", name: "" }].map((c) => (
          <form
            key={c.id}
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save(e.currentTarget, c.id || undefined);
            }}
          >
            <label className="sr-only" htmlFor={`category-${c.id}`}>
              {c.id ? `Rename ${c.name}` : "New category"}
            </label>
            <input
              className="input min-w-0 flex-1"
              id={`category-${c.id}`}
              name="name"
              defaultValue={c.name}
              placeholder="New category"
              minLength={2}
              maxLength={60}
              required
              disabled={busy}
            />
            <Button type="submit" disabled={busy} variant="outline">
              {c.id ? "Rename" : "Add category"}
            </Button>
          </form>
        ))}
      </div>
      {message && (
        <p role="status" className="notice mt-4">
          {message}
        </p>
      )}
    </details>
  );
}
