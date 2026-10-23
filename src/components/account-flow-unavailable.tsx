import Link from "next/link";
import { Brand } from "./brand";

export function AccountFlowUnavailable({ title }: { title: string }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-6 md:px-10">
        <Brand />
      </header>
      <main id="main" className="surface mx-auto my-12 max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          This account operation is temporarily unavailable. No email has been
          sent and no account has been changed.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block text-sm font-semibold text-primary hover:underline"
        >
          Return to sign in
        </Link>
      </main>
    </div>
  );
}
