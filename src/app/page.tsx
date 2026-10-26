import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Users,
  Sparkles,
  Clock3,
  ChartNoAxesCombined,
  CalendarRange,
  ShieldCheck,
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
    title: "Appointments",
    text: "Keep your daily schedule organized.",
    tone: "sky",
  },
  {
    icon: Users,
    title: "Customers",
    text: "Keep customer details and visit history together.",
    tone: "teal",
  },
  {
    icon: Sparkles,
    title: "Services",
    text: "Set prices, durations and staff assignments.",
    tone: "purple",
  },
  {
    icon: Clock3,
    title: "Team",
    text: "Manage staff working hours and availability.",
    tone: "amber",
  },
  {
    icon: CalendarRange,
    title: "Calendar",
    text: "See appointments in day, week and month views.",
    tone: "sky",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Reports",
    text: "Understand appointment activity from your own records.",
    tone: "teal",
  },
];
const faqs = [
  [
    "Who is TrustCore Book for?",
    "Salons, barbers, spas, nail and bridal studios, personal trainers, private tutors, photographers and other appointment-based businesses.",
  ],
  [
    "Can customers book online?",
    "Public booking is feature-gated. It is available only when enabled for the deployment and the business has configured services, staff and availability. Creating an account does not enable online booking automatically.",
  ],
  [
    "Can I use it with a small team?",
    "Yes. You can create a workspace, add services and customer details, then add staff profiles as your business needs them.",
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
          className="flex flex-wrap items-center gap-3 sm:gap-6"
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
            className="hidden text-sm font-medium text-muted-foreground hover:text-primary-ink lg:inline"
            href="#pricing"
          >
            Pricing
          </Link>
          <Link
            className="text-sm font-semibold hover:text-primary-ink"
            href="/login"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/register">Create your workspace</Link>
          </Button>
        </nav>
      </header>
      <main id="main">
        <section className="marketing-shell grid items-center gap-12 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:grid-cols-[.95fr_1.05fr] lg:gap-14 lg:pb-28 lg:pt-20">
          <div>
            <p className="eyebrow">TrustCore Book · Business workspace</p>
            <h1 className="mt-6 max-w-2xl text-[clamp(2.45rem,4.2vw,3.9rem)] font-bold leading-[1.08] tracking-[-.055em]">
              Manage Appointments, Clients &amp; Your Team{" "}
              <span className="text-primary-ink">— All in One Place.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">
              An easier way to run your salon, spa, barbershop or
              appointment-based business.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register">
                  Create your workspace <ArrowRight size={17} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <ShieldCheck
                size={15}
                className="mt-1 shrink-0 text-primary-ink"
              />
              Organize the records your team uses every day in one business
              workspace.
            </p>
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
                <p className="eyebrow mb-3">Built for everyday work</p>
                <h2 className="section-heading max-w-lg">
                  Everything your team needs to stay organized.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-muted-foreground md:justify-self-end">
                Keep appointments, customers, services and staff in a workspace
                that is easy to use on desktop and mobile.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="mt-6 text-xs leading-6 text-muted-foreground">
              Online booking and team membership tools depend on enabled
              features. Your workspace shows what is currently available.
            </p>
          </div>
        </section>
        <section
          id="how-it-works"
          className="marketing-shell scroll-mt-6 py-16 sm:py-24"
        >
          <div className="text-center">
            <p className="eyebrow mb-3">How it works</p>
            <h2 className="section-heading">Start with the essentials.</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-muted-foreground">
              Set up the workspace around the way your business works.
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
                "Add services and staff",
                "Set service durations and prices, then configure staff profiles and working hours.",
              ],
              [
                "03",
                "Manage appointments",
                "Review recorded appointments, customer details and daily activity in one place.",
              ],
            ].map(([n, title, copy]) => (
              <li key={n} className="border-t border-border pt-6">
                <span className="text-sm font-semibold text-primary-ink">
                  {n} /
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
                  {copy}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section className="border-y border-border bg-card/70">
          <div className="marketing-shell grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="eyebrow mb-3">Made for service businesses</p>
              <h2 className="section-heading">
                A practical home for appointments and people.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                From a solo professional to a growing team, keep the details
                behind each visit organized.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                [
                  Scissors,
                  "Salons & barbers",
                  "Keep services, staff and regular customer details close.",
                  "sky",
                ],
                [
                  Flower2,
                  "Spas & wellness studios",
                  "See bookings and staff availability together.",
                  "teal",
                ],
                [
                  HeartHandshake,
                  "Independent professionals",
                  "Run your appointments from one focused workspace.",
                  "purple",
                ],
              ].map(([Icon, title, copy, tone]) => {
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
                        {String(copy)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="trust"
          className="marketing-shell grid gap-7 py-16 sm:py-20 md:grid-cols-[auto_1fr] md:items-start"
        >
          <span className="icon-tile tone-amber">
            <ShieldCheck size={22} />
          </span>
          <div>
            <p className="eyebrow mb-3">Your business workspace</p>
            <h2 className="section-heading">
              Clear access to the right records.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              Workspace access is checked against business membership and role
              permissions. The dashboard reports on recorded appointment
              activity and actual workspace counts. Available features depend on
              deployment configuration.
            </p>
          </div>
        </section>
        <section
          id="pricing"
          className="scroll-mt-6 border-y border-border bg-card/80"
        >
          <div className="marketing-shell grid gap-6 py-14 sm:py-18 md:grid-cols-2 md:items-center">
            <div>
              <p className="eyebrow mb-3">Pricing</p>
              <h2 className="section-heading">
                Pricing information coming soon.
              </h2>
            </div>
            <p className="max-w-lg text-sm leading-7 text-muted-foreground">
              We have not published approved plan prices or trial terms. You can
              explore the workspace setup without relying on an advertised plan
              or trial offer.
            </p>
          </div>
        </section>
        <section
          id="faq"
          className="marketing-shell grid gap-8 py-16 sm:py-24 lg:grid-cols-[.7fr_1.3fr]"
        >
          <div>
            <p className="eyebrow mb-3">FAQ</p>
            <h2 className="section-heading">
              Good questions. Straight answers.
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
              <p className="eyebrow mb-3">Get organized</p>
              <h2 className="section-heading">
                Give your business one place to work.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Create your workspace and add the services and people you work
                with.
              </p>
            </div>
            <Button asChild>
              <Link href="/register">
                Create your workspace <ArrowRight size={17} />
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
                Appointments · Clients · Team
              </p>
            </div>
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-6 text-sm text-muted-foreground"
            >
              <Link href="#features">Features</Link>
              <Link href="#pricing">Pricing</Link>
              <Link href="#faq">FAQ</Link>
              <Link href="/login">Sign in</Link>
              <Link href="/register">Create your workspace</Link>
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
