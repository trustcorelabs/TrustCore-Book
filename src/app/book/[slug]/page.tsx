import { vocabularyFor } from "@/features/industries/presets";
import { VocabularyProvider } from "@/features/industries/vocabulary-context";
import { notFound } from "next/navigation";
import { getPublicBusiness } from "@/server/queries";
import { ThemeSelect } from "@/components/theme-select";
import { Badge } from "@/components/ui/badge";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui/card";
import { CalendarDays, MapPin, Sparkles, Clock3 } from "lucide-react";
import { money } from "@/lib/utils";
import { BookingForm } from "@/features/public-booking/booking-form";
import { businessLocalDate } from "@/features/booking-engine/slots";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) notFound();
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  const words = vocabularyFor(business);
  const now = new Date();
  return (
    <VocabularyProvider words={words}>
      <div className="hero-wash min-h-screen">
        <header className="border-b border-border bg-card py-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <Brand />
            <ThemeSelect />
          </div>
        </header>
        <main
          id="main"
          className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14"
        >
          <Badge tone="teal">Your next good moment</Badge>
          <p className="eyebrow mb-4 mt-6">
            Appointments · Services · Your time
          </p>
          <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-bold">
            {business.name}
          </h1>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin size={16} />
            {business.timezone} · {business.currency}
          </p>
          {process.env.BOOKING_MVP_ENABLED === "true" &&
          business.services.some((s) => s.kind !== "ADDON") ? (
            <BookingForm
              slug={slug}
              currency={business.currency}
              timezone={business.timezone}
              minDate={businessLocalDate(now, business.timezone)}
              maxDate={businessLocalDate(
                new Date(
                  now.getTime() + business.bookingHorizonDays * 86400_000,
                ),
                business.timezone,
              )}
              policy={{
                bookingLeadMinutes: business.bookingLeadMinutes,
                bookingHorizonDays: business.bookingHorizonDays,
                cancellationNoticeMinutes: business.cancellationNoticeMinutes,
                rescheduleNoticeMinutes: business.rescheduleNoticeMinutes,
              }}
              addons={business.services
                .filter((s) => s.kind === "ADDON")
                .map((s) => ({ ...s, price: s.price.toString() }))}
              services={business.services
                .filter((s) => s.kind !== "ADDON")
                .map((service) => ({
                  ...service,
                  price: service.price.toString(),
                }))}
            />
          ) : (
            <div className="surface my-8 bg-sky-soft p-6">
              <span className="icon-tile tone-sky mb-4">
                <CalendarDays size={22} />
              </span>
              <p className="text-sm text-muted-foreground">
                Online booking is not available yet. Please contact the business
                directly.
              </p>
            </div>
          )}
          <div className="mb-5 mt-10 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold">
              Explore the {words.service.toLowerCase()} menu
            </h2>
            <p className="text-xs text-muted-foreground">
              Prices in {business.currency} · {business.services.length}{" "}
              {words.services.toLowerCase()}
            </p>
          </div>
          {business.services.length ? (
            <div className="space-y-3">
              {business.services.map((s, i) => (
                <Card
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="icon-tile tone-pink">
                      <Sparkles size={20} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{s.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <Clock3 size={13} className="mr-1 inline" />
                        {s.durationMinutes} minutes ·{" "}
                        {s.kind === "PACKAGE"
                          ? "Package"
                          : s.kind === "ADDON"
                            ? "Optional add-on"
                            : (s.category?.name ?? "Service")}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold">
                    {money(s.price.toString(), business.currency)}
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              The service menu is being prepared.
            </p>
          )}
          <p className="mt-10 text-center text-xs text-muted-foreground">
            Powered by TrustCore Book · TrustCore Labs
          </p>
        </main>
      </div>
    </VocabularyProvider>
  );
}
