"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useRef, useState } from "react";

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <details
      ref={details}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && details.current) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          details.current
        )
          details.current.open = false;
      }}
    >
      <summary
        aria-label="Account"
        className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:bg-muted [&::-webkit-details-marker]:hidden"
      >
        <UserRound size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Account</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-xl border border-border bg-card p-2 shadow-float">
        <div className="border-b border-border px-3 py-3">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <Link
          href="/account"
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
        >
          <UserRound size={16} aria-hidden="true" />
          Your account
        </Link>
        <button
          type="button"
          onClick={logout}
          disabled={busy}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          <LogOut size={16} aria-hidden="true" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
        {error && (
          <p role="alert" className="px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
