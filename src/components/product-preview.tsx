import {
  CalendarDays,
  Users,
  Sparkles,
  ArrowUpRight,
  Check,
  LayoutDashboard,
  Clock3,
  Settings2,
} from "lucide-react";

/** A labelled product illustration, never a source of live business metrics. */
export function ProductPreview() {
  return (
    <div className="relative min-w-0">
      <div className="surface relative overflow-hidden shadow-float">
        <div className="flex items-center gap-1.5 border-b border-border bg-background/60 px-4 py-3">
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
          <span className="size-2 rounded-full bg-border" />
          <span className="ml-auto text-[10px] font-medium text-muted-foreground">
            Workspace preview · illustrative empty state
          </span>
        </div>
        <div className="flex min-h-[355px] sm:min-h-[425px]">
          <div
            aria-hidden="true"
            className="hidden w-14 shrink-0 flex-col items-center gap-5 border-r border-border py-5 sm:flex"
          >
            {[LayoutDashboard, CalendarDays, Users, Sparkles, Settings2].map(
              (Icon, i) => (
                <span
                  key={i}
                  className={`grid size-8 place-items-center rounded-lg ${i === 0 ? "bg-accent text-primary-ink" : "text-muted-foreground"}`}
                >
                  <Icon size={16} />
                </span>
              ),
            )}
          </div>
          <div className="min-w-0 flex-1 bg-background/50 p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">
                  A fresh start for your business
                </p>
                <h2 className="mt-1 text-lg font-bold sm:text-xl">
                  Your day, in focus.
                </h2>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary-ink">
                <CalendarDays size={17} />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                [CalendarDays, "Appointments", "sky"],
                [Users, "Clients", "teal"],
                [Sparkles, "Services", "purple"],
              ].map(([Icon, label, tone]) => {
                const I = Icon as typeof Users;
                return (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-border bg-card p-3"
                  >
                    <span
                      className={`tone-${tone} mb-3 grid size-7 place-items-center rounded-lg`}
                    >
                      <I size={14} />
                    </span>
                    <p className="text-xl font-bold">0</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="flex justify-between gap-2">
                <p className="text-xs font-semibold">Upcoming appointments</p>
                <ArrowUpRight size={14} className="text-muted-foreground" />
              </div>
              <div className="preview-grid mt-4 grid min-h-28 place-items-center rounded-lg">
                <div className="rounded-xl border border-dashed border-border bg-card px-5 py-4 text-center">
                  <CalendarDays
                    className="mx-auto mb-2 text-primary-ink"
                    size={21}
                  />
                  <p className="text-xs font-semibold">
                    A little space for what’s next.
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Real appointments will appear here.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
              <Check size={13} className="text-teal-ink" />
              Your services, people and appointments. Together.
            </div>
          </div>
        </div>
      </div>
      <div className="relative mx-5 -mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card sm:absolute sm:-bottom-6 sm:-left-5 sm:mx-0 sm:mt-0">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-soft text-teal-ink">
          <Clock3 size={17} />
        </span>
        <div>
          <p className="text-xs font-semibold">Less admin. More presence.</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Make time for the people in front of you.
          </p>
        </div>
      </div>
    </div>
  );
}
