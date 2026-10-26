import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
