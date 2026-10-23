import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center px-5 py-14 text-center">
      <span className="icon-tile tone-purple mb-5">
        <Sparkles size={22} aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
