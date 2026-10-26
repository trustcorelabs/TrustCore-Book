import { createHash } from "node:crypto";
import { sandboxBillingEnabled } from "@/features/billing/policy";
import { verifyStripeSandboxEvent } from "@/server/payments/stripe-sandbox";
import { applySandboxPaymentEvent } from "@/server/repositories/billing";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sandboxBillingEnabled() || !process.env.STRIPE_TEST_WEBHOOK_SECRET)
    return new Response(null, { status: 404 });
  // Stream with a hard cap; Content-Length is advisory, never the only size check.
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: "Invalid test event." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks);
    const event = verifyStripeSandboxEvent(
      raw,
      request.headers.get("stripe-signature") ?? "",
      process.env.STRIPE_TEST_WEBHOOK_SECRET,
    );
    const result = await applySandboxPaymentEvent(
      event,
      createHash("sha256").update(raw).digest("hex"),
    );
    return Response.json(
      { received: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Test event could not be authenticated or reconciled." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
