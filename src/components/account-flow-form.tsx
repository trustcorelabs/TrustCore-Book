"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { PasswordInput } from "./ui/password-input";
import { Input } from "./ui/input";
import {
  forgotPassword,
  resendVerification,
  resetPassword,
  verifyEmail,
} from "@/server/actions";

type Mode = "forgot" | "resend" | "verify" | "reset";
export function AccountFlowForm({ mode }: { mode: Mode }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const token = useRef("");
  useEffect(() => {
    if (mode === "verify" || mode === "reset") {
      token.current =
        new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [mode]);
  const needsEmail = mode === "forgot" || mode === "resend";
  const needsPassword = mode === "reset";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result =
        mode === "forgot"
          ? await forgotPassword({ email: data.get("email") })
          : mode === "resend"
            ? await resendVerification({ email: data.get("email") })
            : mode === "verify"
              ? await verifyEmail(token.current)
              : await resetPassword({
                  token: token.current,
                  password: data.get("password"),
                });
      setMessage(
        result.error ?? result.success ?? "Unable to complete request.",
      );
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {needsEmail && (
        <div className="space-y-2">
          <label htmlFor="account-email" className="text-sm">
            Email address
          </label>
          <Input
            id="account-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </div>
      )}
      {needsPassword && (
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm">
            New password
          </label>
          <PasswordInput
            id="new-password"
            name="password"
            autoComplete="new-password"
            required
            minLength={12}
          />
        </div>
      )}
      <Button type="submit" disabled={busy}>
        {busy
          ? "Please wait…"
          : mode === "forgot"
            ? "Request reset link"
            : mode === "resend"
              ? "Resend verification"
              : mode === "verify"
                ? "Verify email"
                : "Reset password"}
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <p className="text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Return to sign in
        </Link>
      </p>
    </form>
  );
}
