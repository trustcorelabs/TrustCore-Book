"use client";
import Link from "next/link";
import { RefreshCw, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-20">
      <div className="surface p-7 text-center sm:p-10">
        <span className="icon-tile tone-amber mx-auto mb-6">
          <CloudOff size={23} />
        </span>
        <p className="eyebrow mb-3">A small interruption</p>
        <h1 className="text-3xl font-bold">Let’s try that again.</h1>
        <p className="my-5 text-sm leading-7 text-muted-foreground">
          We couldn’t load this page. Refresh it to try again, or head back to
          the home page.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>
            <RefreshCw size={16} />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
