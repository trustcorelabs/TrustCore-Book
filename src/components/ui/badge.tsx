import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export type Tone = "purple" | "sky" | "teal" | "amber" | "pink" | "green";
export function Badge({
  tone = "purple",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-4",
        `tone-${tone}`,
        className,
      )}
      {...props}
    />
  );
}
export function StatusBadge({ status }: { status: string }) {
  const value = status.toLowerCase().replaceAll("_", " ");
  const tones: Record<string, Tone> = {
    confirmed: "sky",
    pending: "amber",
    completed: "green",
    cancelled: "pink",
    "no show": "pink",
    active: "green",
    inactive: "amber",
    archived: "amber",
  };
  return (
    <Badge tone={tones[value] ?? "purple"}>
      <span className="size-1.5 rounded-full bg-current" />
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </Badge>
  );
}
