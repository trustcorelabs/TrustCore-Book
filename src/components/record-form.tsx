"use client";
import { CatalogFields, type CatalogOption } from "./catalog-fields";
import { Plus, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRecord } from "@/server/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Feedback } from "./ui/feedback";
import { useHydrated } from "@/hooks/use-hydrated";
export function RecordForm({
  businessId,
  kind,
  currency,
  categories = [],
  catalog = [],
}: {
  businessId: string;
  kind: "services" | "staff" | "customers";
  currency: string;
  categories?: { id: string; name: string }[];
  catalog?: CatalogOption[];
}) {
  const hydrated = useHydrated();
  const [offerKind, setOfferKind] = useState("SERVICE");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    const form = e.currentTarget;
    try {
      const result = await createRecord(
        businessId,
        kind,
        Object.fromEntries(new FormData(form)),
      );
      setMessage(result.error ?? result.success ?? "");
      setSuccess(!!result.success && !result.error);
      if (result.success) {
        form.reset();
        router.refresh();
      }
    } catch {
      setMessage("Unable to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      id="add-record"
      className="surface group mb-7 p-5 open:border-primary/30"
    >
      <summary className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-primary-ink">
        <span className="grid size-9 place-items-center rounded-xl bg-accent">
          <Plus size={18} />
        </span>
        Add{" "}
        {kind === "services"
          ? "a service"
          : kind === "staff"
            ? "a staff member"
            : "a customer"}
        <ChevronDown
          size={16}
          className="ml-auto transition-transform group-open:rotate-180"
        />
      </summary>
      <form
        onSubmit={submit}
        aria-busy={!hydrated || busy}
        className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <fieldset disabled={!hydrated || busy} className="contents">
          <div>
            <label htmlFor="record-name">Name</label>
            <Input
              id="record-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          {kind === "services" && (
            <>
              <div>
                <label htmlFor="duration">Duration (minutes)</label>
                <Input
                  disabled={offerKind === "PACKAGE"}
                  id="duration"
                  name="durationMinutes"
                  type="number"
                  min="5"
                  max="720"
                  required
                />
              </div>
              <div>
                <label htmlFor="price">Price ({currency})</label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  required
                />
              </div>
            </>
          )}
          {kind === "services" && (
            <CatalogFields
              id="new-service"
              categories={categories}
              options={catalog}
              onChange={(v) => setOfferKind(v.kind)}
            />
          )}
          {kind === "customers" && (
            <>
              <div>
                <label htmlFor="customer-email">Email (optional)</label>
                <Input
                  id="customer-email"
                  name="email"
                  type="email"
                  maxLength={254}
                />
              </div>
              <div>
                <label htmlFor="phone">Phone (optional)</label>
                <Input id="phone" name="phone" type="tel" maxLength={30} />
              </div>
            </>
          )}
          <Button disabled={busy} type="submit">
            {busy ? "Saving…" : "Save"}
          </Button>
          {message && (
            <div className="sm:col-span-2 lg:col-span-4">
              <Feedback
                message={message}
                success={success}
                onDismiss={() => setMessage("")}
              />
            </div>
          )}
        </fieldset>
      </form>
    </details>
  );
}
