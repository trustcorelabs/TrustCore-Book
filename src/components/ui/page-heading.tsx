import type { ReactNode } from "react";
export function PageHeading({
  eyebrow = "Your business workspace",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-[1.8rem] font-bold md:text-[2rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:pt-6">
          {action}
        </div>
      )}
    </div>
  );
}
