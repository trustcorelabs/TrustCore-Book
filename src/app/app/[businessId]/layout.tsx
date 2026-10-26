import { VocabularyProvider } from "@/features/industries/vocabulary-context";
import { vocabularyFor } from "@/features/industries/presets";
import { getNavigation } from "@/server/queries";
import { WorkspaceNav } from "@/components/workspace-nav";
import { AccountMenu } from "@/components/account-menu";
import { ThemeSelect } from "@/components/theme-select";
import { Badge } from "@/components/ui/badge";
import { hasPermission } from "@/shared/policies/permissions";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { business, user, member, memberships } =
    await getNavigation(businessId);
  return (
    <VocabularyProvider words={vocabularyFor(business)}>
      <div className="min-h-screen lg:flex">
        <WorkspaceNav
          businessId={businessId}
          name={business.name}
          slug={business.slug}
          canManageMembers={hasPermission(member.role, "members.manage")}
          businesses={memberships.map((m) => ({
            id: m.business.id,
            name: m.business.name,
          }))}
        />
        <div className="min-w-0 flex-1">
          <header className="workspace-topbar border-b border-border">
            <div className="workspace-shell flex min-h-20 flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  Your workspace · {member.role.toLowerCase()}
                </p>
                <p className="mt-1 max-w-[14rem] truncate text-sm font-semibold">
                  {business.name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block">
                  <Badge tone="teal">Your business, connected</Badge>
                </div>
                <div className="hidden sm:block">
                  <ThemeSelect />
                </div>
                <AccountMenu name={user.name} email={user.email} />
              </div>
            </div>
          </header>
          <main id="main" className="workspace-shell py-7 sm:py-8 xl:py-10">
            {children}
          </main>
        </div>
      </div>
    </VocabularyProvider>
  );
}
