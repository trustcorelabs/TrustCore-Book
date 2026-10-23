import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main
      id="main"
      className="surface mx-auto my-16 max-w-xl px-6 py-16 text-center"
    >
      <p className="eyebrow mb-4">404</p>
      <h1 className="text-3xl font-bold">This page isn’t available.</h1>
      <p className="my-5 text-muted-foreground">
        Check the address or return to your workspace.
      </p>
      <Button asChild>
        <Link href="/app">Go to workspace</Link>
      </Button>
    </main>
  );
}
