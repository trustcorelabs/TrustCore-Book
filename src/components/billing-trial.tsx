"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeBillingTrial } from "@/server/actions";
import { Button } from "./ui/button";
export function BillingTrial({ businessId, active, used }: { businessId: string; active: boolean; used: boolean }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""); const router = useRouter();
  return <div className="mt-6"><Button type="button" disabled={busy || (used && !active)} variant="outline" onClick={async () => { setBusy(true); try { const r = await changeBillingTrial(businessId, active); setMessage(r.error ?? r.success ?? ""); if (r.success) router.refresh(); } catch { setMessage("Unable to update trial. Please retry."); } finally { setBusy(false); } }}>{busy ? "Updating…" : active ? "Cancel sandbox trial" : used ? "Sandbox trial already used" : "Start 14-day sandbox trial"}</Button>{message && <p role="status" className="notice mt-4">{message}</p>}</div>;
}
