import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Users,
  Sparkles,
  ShieldCheck,
  Clock3,
  ChartNoAxesCombined,
  Check,
  Plus,
  Scissors,
  Flower2,
  HeartHandshake,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeSelect } from "@/components/theme-select";
import { ProductPreview } from "@/components/product-preview";
const features = [
  {
    icon: CalendarDays,
    title: "A clearer appointment book",
    text: "Keep recorded appointments in view, with customer, service and staff details in one place.",
    tone: "sky",
  },
  {
    icon: Users,
    title: "Know the people behind every visit",
    text: "Give your customer directory a home. Keep contact details close and find the person you need.",
    tone: "teal",
  },
  {
    icon: Sparkles,
    title: "Your craft, thoughtfully organized",
    text: "Build a service menu with clear durations and prices, and keep your team profiles together.",
    tone: "purple",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Clarity from your actual records",
    text: "See appointment status breakdowns and workspace counts. No invented revenue or performance estimates.",
    tone: "amber",
  },
];
const faqs = [
  [
    "Who is TrustCore Book for?",
    "Salons, spas, independent professionals and service teams who want one organized place for their customers, services, staff and appointments.",
  ],
  [
    "Can customers book online?",
    "Public booking is feature-gated. It is available only when enabled for the deployment and the business has configured services, staff and availability. Creating an account does not enable online booking automatically.",
  ],
  [
    "Do I need a large team to get started?",
    "No. Create a business workspace, add your services and customer details, and build from there. Your workspace can grow with your team.",
  ],
  [
    "Does the dashboard show revenue or staff utilization?",
    "The current dashboard shows recorded appointment activity and actual workspace counts. Payment-based revenue and staff utilization reporting are not currently calculated.",
  ],
  [
    "How is access to a workspace managed?",
    "Workspace access is checked against business membership and role permissions. Team invitation and membership-management features depend on the enabled deployment features.",
  ],
];
export default function Page() {
  return (
    <div className="hero-wash min-h-screen">
      <header className="marketing-shell flex flex-wrap items-center justify-between gap-4 py-5 sm:py-6">
        <Brand />
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-4 sm:gap-6"
        >
          <Link
            className="hidden text-sm font-medium text-muted-foreground hover:text-primary-ink md:inline"
            href="#features"
          >
            Features
          </Link>
          <Link
            className="hidden text-sm font-medium text-muted-foreground hover:text-primary-ink md:inline"
            href="#how-it-works"
          >
            How it works
          </Link>
          <Link
            className="hidden text-sm font-semibold hover:text-primary-ink sm:inline"
            href="/login"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/register">
              Get started
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </nav>
      </header>
      <main id="main">
        <section className="marketing-shell grid items-center gap-12 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:grid-cols-[.95fr_1.05fr] lg:gap-14 lg:pb-28 lg:pt-20">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-teal" />
              Appointments · Clients · Growth
            </p>
            <h1 className="mt-6 text-[clamp(2.7rem,5vw,4.65rem)] font-bold leading-[1.05] tracking-[-.055em]">
              A calmer day.
              <br />
              <span className="text-primary-ink">A stronger business.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
              Beautiful work deserves a little less busywork. Bring your
              appointments, clients and team into one thoughtful workspace, made
              for modern salons and spas.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register">
                  Get started
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="#features">Explore features</Link>
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs leading-6 text-muted-foreground">
              <ShieldCheck size={15} className="shrink-0 text-teal-ink" />
              Your own workspace. A place for your next chapter.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-[11px] font-medium text-muted-foreground">
              {[
                "Salons & barbers",
                "Spas & wellness",
                "Independent professionals",
              ].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check size={12} className="text-teal-ink" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <ProductPreview />
        </section>
        <section
          id="features"
          className="scroll-mt-6 border-y border-border bg-card/80"
        >
          <div className="marketing-shell py-16 sm:py-24">
            <div className="mb-10 grid items-end gap-5 md:grid-cols-2">
              <div>
                <p className="eyebrow mb-3">
                  The essentials, beautifully connected
                </p>
                <h2 className="section-heading max-w-lg">
                  More time for your craft.
                  <br />
                  Less time keeping up.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-muted-foreground md:justify-self-end">
                One place for the work behind every great visit. Simple to
                navigate, clear to understand, and designed to feel just as good
                on your phone.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, text, tone }) => (
                <Card key={title} className="h-full shadow-none">
                  <span className={`icon-tile tone-${tone} mb-6`}>
                    <Icon size={22} />
                  </span>
                  <h3 className="text-base font-bold leading-6">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {text}
                  </p>
                </Card>
              ))}
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <Clock3 size={15} className="mt-1 shrink-0" />
              Online booking, staff schedules and team membership tools depend
              on enabled features. Your workspace shows what is currently
              available.
            </p>
          </div>
        </section>
        <section
          id="how-it-works"
          className="marketing-shell scroll-mt-6 py-16 sm:py-24"
        >
          <div className="text-center">
            <p className="eyebrow mb-3">A fresh start, without the fuss</p>
            <h2 className="section-heading">Make yourself at home.</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Start with the essentials. Shape a workspace around the way you
              work.
            </p>
          </div>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              [
                "01",
                "Create your workspace",
                "Register, name your business, and choose your country and time zone.",
              ],
              [
                "02",
                "Bring your business together",
                "Add services, staff profiles and customer details using the existing tools.",
              ],
              [
                "03",
                "Find your daily flow",
                "Review recorded appointments and keep your business essentials close at hand.",
              ],
            ].map(([n, title, text]) => (
              <li key={n} className="relative border-t border-border pt-6">
                <span className="text-sm font-semibold text-primary-ink">
                  {n} /
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section className="border-y border-border bg-card/70">
          <div className="marketing-shell grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="eyebrow mb-3">Good work comes in many forms</p>
              <h2 className="section-heading">
                Made for the people
                <br />
                who care for people.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                From the first consultation to the familiar faces who return,
                keep the details of your service business thoughtfully
                organized.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                [
                  Scissors,
                  "Salons & barbers",
                  "Your service menu, your team, your regulars.",
                  "sky",
                ],
                [
                  Flower2,
                  "Spas & wellness studios",
                  "A quieter space for the details behind the care.",
                  "teal",
                ],
                [
                  HeartHandshake,
                  "Independent professionals",
                  "A professional workspace, even when it’s just you.",
                  "purple",
                ],
              ].map(([Icon, title, text, tone]) => {
                const I = Icon as typeof Scissors;
                return (
                  <div
                    className="surface flex items-start gap-4 p-5 shadow-none"
                    key={String(title)}
                  >
                    <span className={`icon-tile tone-${tone}`}>
                      <I size={21} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{String(title)}</h3>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        {String(text)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="faq"
          className="marketing-shell grid gap-8 py-16 sm:py-24 lg:grid-cols-[.7fr_1.3fr]"
        >
          <div>
            <p className="eyebrow mb-3">A little clarity</p>
            <h2 className="section-heading">
              Good questions.
              <br />
              Straight answers.
            </h2>
          </div>
          <div>
            {faqs.map(([q, a]) => (
              <details key={q} className="faq-row border-b border-border">
                <summary>
                  {q}
                  <Plus size={18} className="text-primary-ink" />
                </summary>
                <p className="pb-6 pr-5 text-sm leading-7 text-muted-foreground">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>
        <section className="marketing-shell pb-16">
          <div className="color-panel flex flex-wrap items-center justify-between gap-8 rounded-3xl border border-border p-7 sm:p-12">
            <div>
              <p className="eyebrow mb-3">Your next chapter</p>
              <h2 className="section-heading">
                Make room for a better working day.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Start with your workspace. Make it your own.
              </p>
            </div>
            <Button asChild>
              <Link href="/register">
                Create your workspace
                <ArrowRight size={17} />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-card">
        <div className="marketing-shell py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <Brand />
              <p className="mt-4 text-xs text-muted-foreground">
                Appointments · Clients · Growth
              </p>
            </div>
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-6 text-sm text-muted-foreground"
            >
              <Link href="#features">Features</Link>
              <Link href="#faq">FAQ</Link>
              <Link href="/login">Sign in</Link>
              <Link href="/register">Get started</Link>
            </nav>
            <ThemeSelect />
          </div>
          <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-6 text-[11px] leading-6 text-muted-foreground">
            <p>TrustCore Book by TrustCore Labs</p>
            <p>
              Feature availability depends on deployment and business
              configuration.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
