export const dynamic = "force-dynamic";
import { getPlatformOverview } from "@/server/queries";
import { Brand } from "@/components/brand";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
export default async function Page() {
  const { businessCount, userCount, businesses } = await getPlatformOverview();
  return (
    <>
      <header className="border-b border-border bg-card py-6">
        <div className="mx-auto max-w-6xl px-5">
          <Brand />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 py-10">
        <p className="eyebrow mb-3">Platform administration</p>
        <h1 className="text-3xl font-bold">Platform overview</h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Restricted to explicitly provisioned platform administrators.
        </p>
        <div className="mb-8 grid gap-5 sm:grid-cols-2">
          <Card className="color-panel">
            <p className="text-sm text-muted-foreground">Businesses</p>
            <p className="mt-3 text-3xl font-semibold">{businessCount}</p>
          </Card>
          <Card className="color-panel">
            <p className="text-sm text-muted-foreground">Accounts</p>
            <p className="mt-3 text-3xl font-semibold">{userCount}</p>
          </Card>
        </div>
        <DataTable
          columns={[
            { key: "name", label: "Business" },
            { key: "country", label: "Country" },
            { key: "timezone", label: "Timezone" },
            { key: "slug", label: "Public address" },
          ]}
          rows={businesses}
          emptyTitle="No businesses yet"
          emptyDescription="Businesses appear here after onboarding."
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Up to 100 most recent businesses. Read-only platform administration.
        </p>
      </main>
    </>
  );
}
