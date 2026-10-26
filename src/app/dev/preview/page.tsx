import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BusinessForm } from "@/components/business-form";
import { DashboardView } from "@/components/dashboard-view";
import { Brand } from "@/components/brand";
import { ThemeSelect } from "@/components/theme-select";
import {
  businessTypes,
  industryPreset,
  vocabularyFor,
} from "@/features/industries/presets";
import { VocabularyProvider } from "@/features/industries/vocabulary-context";
import { SetupGuidance } from "@/features/industries/setup-guidance";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Local design preview",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; industry?: string }>;
}) {
  // This route has no database dependency and cannot render on a hosted build.
  if (process.env.NODE_ENV !== "development") notFound();
  const host = (await headers()).get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) notFound();
  const query = await searchParams;
  const businessType =
    businessTypes.find((id) => id === query.industry) ?? "SALON";
  const business = {
    name: "Workspace preview",
    timezone: "Asia/Colombo",
    currency: "LKR",
    businessType,
    terminologyMode: "INDUSTRY" as const,
  };
  const workspace = query.view === "workspace";
  return (
    <VocabularyProvider words={vocabularyFor(business)}>
      <div className="min-h-screen">
        <header className="border-b border-border bg-card">
          <div className="marketing-shell flex flex-wrap items-center justify-between gap-4 py-5">
            <Brand />
            <ThemeSelect />
          </div>
        </header>
        <main id="main" className="marketing-shell py-8 sm:py-12">
          <div className="mb-8 rounded-xl border border-border bg-card p-5">
            <p className="eyebrow">Illustrative demo · local design preview</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Explore the actual setup and dashboard components. This empty
              workspace contains no business records. Finishing setup here saves
              nothing. Dashboard actions require a real signed-in workspace.
            </p>
            <nav
              aria-label="Preview views"
              className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"
            >
              <Link
                aria-current={!workspace ? "page" : undefined}
                className="rounded-lg border border-border px-4 py-3 aria-[current=page]:bg-accent aria-[current=page]:text-primary-ink"
                href={`/dev/preview?industry=${businessType}`}
              >
                Business setup
              </Link>
              <Link
                aria-current={workspace ? "page" : undefined}
                className="rounded-lg border border-border px-4 py-3 aria-[current=page]:bg-accent aria-[current=page]:text-primary-ink"
                href={`/dev/preview?view=workspace&industry=${businessType}`}
              >
                Workspace
              </Link>
              <Link className="px-4 py-3 text-primary-ink" href="/">
                Marketing page
              </Link>
            </nav>
          </div>
          {workspace ? (
            <>
              <div
                className="mb-6 flex flex-wrap gap-2"
                aria-label="Industry previews"
              >
                {businessTypes.map((id) => (
                  <Link
                    key={id}
                    aria-current={businessType === id ? "page" : undefined}
                    className="rounded-full border border-border bg-card px-3 py-2 text-xs aria-[current=page]:bg-accent aria-[current=page]:text-primary-ink"
                    href={`/dev/preview?view=workspace&industry=${id}`}
                  >
                    {industryPreset(id).label}
                  </Link>
                ))}
              </div>
              <DashboardView
                businessId="design-preview"
                business={business}
                userName="there"
                manage
                counts={{
                  appointments: 0,
                  services: 0,
                  staff: 0,
                  customers: 0,
                }}
                appointments={[]}
              />
              <div className="mt-6">
                <SetupGuidance business={business} />
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-2xl">
              <h1 className="mb-3 text-3xl font-bold">
                A workspace for your business
              </h1>
              <p className="mb-7 text-sm leading-7 text-muted-foreground">
                Choose a business type, then make it your own.
              </p>
              <div className="surface p-5 sm:p-8">
                <BusinessForm
                  key={businessType}
                  previewOnly
                  initial={{
                    name: "",
                    slug: "",
                    country: "LK",
                    timezone: "Asia/Colombo",
                    businessType,
                    terminologyMode: "INDUSTRY",
                  }}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </VocabularyProvider>
  );
}
