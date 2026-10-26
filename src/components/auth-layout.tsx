import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ShieldCheck,
  Sparkles,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "./brand";
import { ThemeSelect } from "./theme-select";
export function AuthLayout({
  children,
  title,
  description,
  compact = false,
}: {
  children: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className="hero-wash min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
        <Brand />
        <ThemeSelect />
      </header>
      <main
        id="main"
        className={`mx-auto grid max-w-6xl items-start gap-10 px-5 pb-14 pt-6 lg:grid-cols-2 lg:gap-12 xl:gap-16 lg:py-12 ${compact ? "lg:py-8" : ""}`}
      >
        <section className="relative hidden min-w-0 lg:block">
          <p className="eyebrow mb-5 flex items-center gap-2">
            <Sparkles size={14} />
            Appointments · Clients · Team
          </p>
          <h2 className="max-w-lg text-[clamp(2.5rem,4vw,3rem)] font-bold leading-[1.12]">
            A clearer way to work.
            <br />
            One business workspace.
            <br />
            <span className="text-primary-ink">Built for your team.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            Keep your appointments, customers, services and staff organized in
            one place.
          </p>
          <div
            aria-hidden="true"
            className="relative mt-10 max-w-md rounded-2xl border border-primary/15 bg-card/70 p-6 shadow-card"
          >
            <div className="absolute -right-4 -top-4 grid size-14 rotate-12 place-items-center rounded-2xl bg-amber-soft text-amber-ink">
              <Sparkles size={26} />
            </div>
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold">
                Your business essentials
              </span>
              <span className="rounded-full bg-green-soft px-3 py-1 text-[10px] font-bold text-green-ink">
                ALL CONNECTED
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                [CalendarDays, "Appointments", "sky"],
                [Users, "Your people", "teal"],
                [Sparkles, "Your services", "pink"],
              ].map(([Icon, label, tone]) => {
                const I = Icon as typeof Users;
                return (
                  <div
                    key={String(label)}
                    className={`tone-${tone} rounded-2xl p-4`}
                  >
                    <I size={21} />
                    <p className="mt-5 text-[11px] font-semibold">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className="grid size-8 place-items-center rounded-full bg-accent text-primary-ink">
                <Check size={17} />
              </span>
              <span className="text-xs font-medium">
                Appointments, customers and staff in one place.
              </span>
            </div>
          </div>
          <p className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={15} className="text-teal-ink" />A separate,
            secure workspace for every business.
          </p>
        </section>
        <section className="surface auth-panel w-full max-w-lg justify-self-center p-6 sm:p-9 lg:max-w-none">
          <div className="mb-7">
            <span className="icon-tile tone-purple mb-5">
              <CalendarDays size={22} />
            </span>
            <h1 className="text-[1.75rem] font-bold">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          {children}
          <p className="mt-8 flex items-center justify-center gap-1.5 border-t border-border pt-5 text-[11px] text-muted-foreground">
            Made for service businesses
            <Link href="/" aria-label="About TrustCore Book">
              <ArrowUpRight size={13} />
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
