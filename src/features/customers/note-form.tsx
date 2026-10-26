"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addCustomerNote } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Feedback } from "@/components/ui/feedback";
import { useHydrated } from "@/hooks/use-hydrated";
export function CustomerNoteForm({
  businessId,
  customerId,
}: {
  businessId: string;
  customerId: string;
}) {
  const hydrated = useHydrated(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      const result = await addCustomerNote(businessId, {
        customerId,
        body: new FormData(form).get("body"),
      });
      setMessage(result.error ?? result.success ?? "");
      setSuccess(!!result.success);
      if (result.success) {
        form.reset();
        router.refresh();
      }
    } catch {
      setMessage("Unable to add this note. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      aria-busy={!hydrated || busy}
      className="mt-5 space-y-4"
    >
      <fieldset disabled={!hydrated || busy} className="space-y-3">
        <div>
          <label htmlFor="customer-note">Add a private note</label>
          <textarea
            className="input min-h-28 resize-y"
            id="customer-note"
            name="body"
            required
            maxLength={2000}
            aria-describedby="customer-note-hint"
          />
          <p
            id="customer-note-hint"
            className="mt-2 text-xs leading-6 text-muted-foreground"
          >
            Service preferences and preparation, up to 2,000 characters. Visible
            to business owners and admins.
          </p>
        </div>
        <Button type="submit">{busy ? "Saving…" : "Add note"}</Button>
      </fieldset>
      {message && (
        <Feedback
          message={message}
          success={success}
          onDismiss={() => setMessage("")}
        />
      )}
    </form>
  );
}
