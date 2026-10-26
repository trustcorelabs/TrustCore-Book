import { Brand } from "@/components/brand";
export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-5 py-12">
      <Brand />
      <div className="surface mt-8 p-7">
        <h1 className="text-2xl font-bold">Payment return</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Payments are not enabled for this application. Returning from a
          checkout page never confirms payment or unlocks a subscription.
          Sandbox reconciliation and a verified provider are required.
        </p>
      </div>
    </main>
  );
}
