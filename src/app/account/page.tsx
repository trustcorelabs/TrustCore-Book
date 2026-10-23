export const dynamic = "force-dynamic";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { AccountSettings } from "@/components/account-settings";
import { getOwnAccountService } from "@/server/services";

export default async function Page() {
  const account = await getOwnAccountService();
  return (
    <>
      <header className="border-b border-border bg-card py-5">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 md:px-9">
          <Brand />
          <Link href="/app" className="text-sm text-primary hover:underline">
            Workspace
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl space-y-8 px-5 py-8 md:px-9">
        <div>
          <h1 className="text-3xl font-bold">Your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {account.profile.email}
          </p>
        </div>
        <div className="surface p-5 md:p-8">
          <AccountSettings account={account} />
        </div>
      </main>
    </>
  );
}
