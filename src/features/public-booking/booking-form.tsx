"use client";

import { useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  UserRound,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { loadPublicSlots, submitPublicBooking } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, requestId } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { businessLocalDate } from "@/features/booking-engine/slots";

type Slot = { id: string; startsAt: string; endsAt: string; staffName: string };
type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
};

export function BookingForm({
  slug,
  timezone,
  services,
  minDate,
  maxDate,
  currency,
}: {
  slug: string;
  timezone: string;
  services: Service[];
  minDate: string;
  maxDate: string;
  currency: string;
}) {
  const mounted = useHydrated();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffPreference, setStaffPreference] = useState("");
  const [date, setDate] = useState(minDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [key, setKey] = useState(() => requestId());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function findSlots() {
    if (!serviceId || !date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < minDate || date > maxDate) {
      setMessage("Choose a date within the available booking range.");
      return;
    }
    setBusy(true);
    setMessage("");
    setSelected(null);
    setSlots([]);
    const day = Date.parse(`${date}T00:00:00Z`);
    try {
      const result = await loadPublicSlots({
        slug,
        serviceId,
        from: new Date(Math.max(day - 86400_000, Date.now())).toISOString(),
        to: new Date(day + 2 * 86400_000).toISOString(),
        localDate: date,
      });
      if ("error" in result)
        setMessage(result.error ?? "Availability is unavailable.");
      else {
        const available = result.slots.filter(
          (slot) =>
            businessLocalDate(new Date(slot.startsAt), timezone) === date,
        );
        setSlots(available);
        if (!available.length)
          setMessage("No times are available on this date.");
      }
    } catch {
      setMessage("Availability is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function book(form: FormData) {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await submitPublicBooking({
        slug,
        serviceId,
        slotId: selected.id,
        startsAt: selected.startsAt,
        idempotencyKey: key,
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
      });
      if (result.success) {
        setConfirmed(true);
        setMessage(`Booking confirmed. Reference: ${result.bookingId}`);
      } else {
        setMessage(result.error ?? "Booking is temporarily unavailable.");
        if (result.error?.includes("no longer available")) {
          setSelected(null);
          setSlots([]);
        }
      }
    } catch {
      setMessage(
        "Booking is temporarily unavailable. Retry with the same details.",
      );
    } finally {
      setBusy(false);
    }
  }

  const chosenService = services.find((service) => service.id === serviceId);
  const visibleSlots = slots.filter(
    (slot) => !staffPreference || slot.staffName === staffPreference,
  );
  const phase = confirmed ? 5 : selected ? 4 : slots.length ? 3 : 2;
  const time = (value: string) =>
    new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "shortOffset",
    }).format(new Date(value));
  return (
    <section className="my-8" aria-label="Book an appointment">
      <div className="surface mb-6 p-4 sm:p-6">
        <ol
          aria-label="Booking steps"
          className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6"
        >
          {[
            "Service",
            "Staff",
            "Date",
            "Time",
            "Your details",
            "Confirmation",
          ].map((label, index) => (
            <li
              key={label}
              aria-current={phase === index ? "step" : undefined}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span
                className={`step-dot ${index < phase ? "bg-teal-soft text-teal-ink" : index === phase ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {index < phase ? <Check size={14} /> : index + 1}
              </span>
              <span
                className={`text-[10px] font-semibold ${index === phase ? "text-primary-ink" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {confirmed ? (
        <div className="surface px-6 py-12 text-center">
          <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-green-soft text-green-ink">
            <CheckCircle2 size={34} />
          </span>
          <Badge tone="green">All set</Badge>
          <h2 className="mt-4 text-2xl font-bold">
            A little time, just for you.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {chosenService?.name} · {selected?.staffName}
          </p>
          {selected && (
            <p className="mt-2 text-sm font-semibold">
              {new Intl.DateTimeFormat("en", {
                timeZone: timezone,
                dateStyle: "full",
              }).format(new Date(selected.startsAt))}{" "}
              · {time(selected.startsAt)}
            </p>
          )}
          <p role="status" className="notice mx-auto mt-6 max-w-lg break-all">
            {message}
          </p>
          <p className="mt-5 text-xs text-muted-foreground">
            Keep your booking reference for your records.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <fieldset disabled={busy || !mounted} className="surface p-5 sm:p-7">
            <legend className="sr-only">Service, staff and date</legend>
            <h2 className="mb-5 text-lg font-bold">
              Make time for something good
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="booking-service"
                  className="flex items-center gap-2"
                >
                  <Sparkles size={15} className="text-pink-ink" />
                  Service
                </label>
                <select
                  id="booking-service"
                  className="input"
                  value={serviceId}
                  onChange={(event) => {
                    setServiceId(event.target.value);
                    setSlots([]);
                    setSelected(null);
                    setStaffPreference("");
                    setMessage("");
                    setKey(requestId());
                  }}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="booking-staff"
                  className="flex items-center gap-2"
                >
                  <UserRound size={15} className="text-teal-ink" />
                  Staff preference
                </label>
                <select
                  id="booking-staff"
                  className="input"
                  value={staffPreference}
                  onChange={(event) => {
                    setStaffPreference(event.target.value);
                    setSelected(null);
                    setKey(requestId());
                  }}
                >
                  <option value="">Any available professional</option>
                  {[...new Set(slots.map((slot) => slot.staffName))].map(
                    (name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ),
                  )}
                </select>
                <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                  Available staff choices appear after checking your date.
                </p>
              </div>
            </div>
            {chosenService && (
              <div className="tone-purple mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
                <span className="text-sm font-semibold">
                  {chosenService.name}
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <Clock3 size={13} />
                    {chosenService.durationMinutes} min
                  </span>
                  <strong>{money(chosenService.price, currency)}</strong>
                </span>
              </div>
            )}
            <div className="mt-6 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label
                  htmlFor="booking-date"
                  className="flex items-center gap-2"
                >
                  <CalendarDays size={15} className="text-sky-ink" />
                  Date
                </label>
                <Input
                  id="booking-date"
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSlots([]);
                    setSelected(null);
                    setStaffPreference("");
                    setMessage("");
                    setKey(requestId());
                  }}
                />
              </div>
              <Button
                type="button"
                disabled={busy || !serviceId || !date}
                onClick={findSlots}
              >
                {busy ? "Checking…" : "Find times"}
                <ArrowRight size={15} />
              </Button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              All appointment times are shown in {timezone}.
            </p>
          </fieldset>
          {slots.length > 0 && (
            <div className="surface p-5 sm:p-7">
              <h2 className="text-lg font-bold">Choose your moment</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Select an available time and professional to continue.
              </p>
              <div
                className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
                aria-label="Available times"
              >
                {visibleSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected?.id === slot.id}
                    className={`rounded-xl border p-4 text-left transition-colors ${selected?.id === slot.id ? "border-primary bg-accent ring-1 ring-primary" : "border-border bg-card hover:border-primary/50 hover:bg-background"}`}
                    onClick={() => {
                      setSelected(slot);
                      setKey(requestId());
                      setMessage("");
                    }}
                  >
                    <span className="block text-sm font-bold">
                      {time(slot.startsAt)}
                    </span>
                    <span className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <UserRound size={12} />
                      {slot.staffName}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {selected && (
            <div className="surface p-5 sm:p-7">
              <Badge tone="teal">Your selected time</Badge>
              <p className="mt-3 text-sm font-semibold">
                {chosenService?.name} · {time(selected.startsAt)} ·{" "}
                {selected.staffName}
              </p>
              <h2 className="mt-7 text-lg font-bold">
                A few details, then you’re done
              </h2>
              <form
                className="mt-5 grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void book(new FormData(event.currentTarget));
                }}
              >
                <fieldset disabled={busy} className="contents">
                  <div>
                    <label htmlFor="booking-name">Name</label>
                    <Input
                      id="booking-name"
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={100}
                      onChange={() => setKey(requestId())}
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-email">Email</label>
                    <Input
                      id="booking-email"
                      name="email"
                      autoComplete="email"
                      type="email"
                      required
                      maxLength={254}
                      onChange={() => setKey(requestId())}
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-phone">Phone (optional)</label>
                    <Input
                      id="booking-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      maxLength={30}
                      onChange={() => setKey(requestId())}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" disabled={busy} type="submit">
                      {busy ? "Booking…" : "Confirm booking"}
                      <Check size={16} />
                    </Button>
                  </div>
                </fieldset>
              </form>
              <p className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck size={14} />
                Availability is checked again when you confirm.
              </p>
            </div>
          )}
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
