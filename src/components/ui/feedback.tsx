"use client";
import { CircleCheck, CircleAlert, X } from "lucide-react";
export function Feedback({
  message,
  success = false,
  onDismiss,
}: {
  message: string;
  success?: boolean;
  onDismiss: () => void;
}) {
  const Icon = success ? CircleCheck : CircleAlert;
  return (
    <div
      role={success ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${success ? "border-teal-ink/15 bg-teal-soft text-teal-ink" : "border-pink-ink/15 bg-pink-soft text-pink-ink"}`}
    >
      <Icon size={18} aria-hidden="true" className="mt-1 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-m-2 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-card/40"
      >
        <X size={16} />
      </button>
    </div>
  );
}
