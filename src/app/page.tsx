import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Globe2,
  Sparkles,
  Users,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeSelect } from "@/components/theme-select";
export default function Page() {
  return (
    <div className="hero-wash">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-10">
        <Brand />
        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-3 sm:gap-5"
        >
          <div className="hidden sm:block">
            <ThemeSelect />
          </div>
          <Link
            href="/login"
            className="text-sm font-semibold text-muted-foreground hover:text-primary-ink"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/register">
              Get started
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        </nav>
      </header>
      <main id="main">
        <section className="mx-auto grid max-w-7xl items-start gap-10 px-5 pb-20 pt-10 md:px-10 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 xl:gap-16 lg:pb-28">
          <div>
            <Badge tone="purple">
              <Sparkles size={12} />A fresh chapter for your business
            </Badge>
            <h1 className="mt-6 text-[clamp(2.25rem,4.6vw,4rem)] font-bold leading-[1.1]">
              Good business.
              <br />
              Great people.
              <br />
              <span className="text-primary-ink">Beautifully connected.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
              Less time keeping up. More time doing what you love. Bring your
              services, team and customers into one thoughtfully organized
              workspace.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild>
                <Link href="/register">
                  Create your workspace
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="#workspace">Explore the essentials</Link>
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="text-teal-ink" />
              Built for salons, spas and service businesses.
            </p>
          </div>
          <div className="relative min-w-0">
            <div
              aria-hidden="true"
              className="absolute -top-2 right-6 size-32 rounded-full bg-pink-soft blur-2xl"
            />
            <div className="surface relative p-5 shadow-float sm:p-7">
              <div className="mb-6 flex items-center justify-between border-b border-border pb-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="icon-tile tone-purple">
                    <CalendarDays size={22} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Your business, in focus</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      One connected workspace
                    </p>
                  </div>
                </div>
                <Sparkles size={18} className="text-primary-ink" />
              </div>
              <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                {[
                  {
                    icon: CalendarDays,
                    label: "Appointments",
                    note: "A clearer working day",
                    tone: "sky",
                  },
                  {
                    icon: Users,
                    label: "Your people",
                    note: "Every relationship matters",
                    tone: "teal",
                  },
                  {
                    icon: Sparkles,
                    label: "Your services",
                    note: "Make room for your craft",
                    tone: "pink",
                  },
                  {
                    icon: Clock3,
                    label: "Working hours",
                    note: "Find your everyday flow",
                    tone: "amber",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`tone-${item.tone} flex min-h-36 min-w-0 flex-col rounded-2xl p-4 sm:p-5`}
                  >
                    <item.icon size={23} />
                    <p className="mt-5 text-sm font-bold">{item.label}</p>
                    <p className="mt-1 text-[10px] leading-5 opacity-90">
                      {item.note}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green-soft text-green-ink">
                  <Check size={16} />
                </span>
                <p className="text-xs font-semibold">
                  Everything you need. A little more breathing room.
                </p>
              </div>
            </div>
            <p className="relative mt-5 text-center text-[10px] text-muted-foreground">
              Workspace illustration · No sample customer data
            </p>
          </div>
        </section>
        <section id="workspace" className="border-y border-border bg-card/80">
          <div className="mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-20">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="eyebrow mb-3">Designed around your day</p>
                <h2 className="text-3xl font-bold md:text-4xl">
                  A home for the everyday.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-7 text-muted-foreground">
                Thoughtful tools for the work behind the work. So you can focus
                on the people in front of you.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: Users,
                  title: "People, connected",
                  desc: "Customer details, team profiles and working hours, always close at hand.",
                  tone: "teal",
                },
                {
                  icon: Sparkles,
                  title: "Your craft, organized",
                  desc: "Give your services a home with clear prices, durations and availability.",
                  tone: "pink",
                },
                {
                  icon: ShieldCheck,
                  title: "A space of your own",
                  desc: "Separate business workspaces and role-based access keep your team in sync.",
                  tone: "purple",
                },
              ].map((item) => (
                <Card key={item.title} className="h-full">
                  <span className={`icon-tile tone-${item.tone} mb-6`}>
                    <item.icon size={23} />
                  </span>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {item.desc}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-16 md:px-10">
          <div className="color-panel flex flex-wrap items-center justify-between gap-6 rounded-[2rem] border border-border p-7 md:p-10">
            <div>
              <p className="eyebrow mb-3">Make room for what’s next</p>
              <h2 className="text-2xl font-bold sm:text-3xl">
                Your next great working day starts here.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Create your account and make this workspace yours.
              </p>
            </div>
            <Button asChild>
              <Link href="/register">
                Let’s get started
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Globe2 size={16} className="text-teal-ink" />
              Made for local businesses. Ready for a wider world.
            </span>
            <span>Sri Lanka · Maldives · UAE · Australia</span>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-5 py-6 text-center text-[11px] leading-6 text-muted-foreground">
        TrustCore Book by TrustCore Labs · Online booking availability depends
        on the business and enabled features.
      </footer>
    </div>
  );
}
