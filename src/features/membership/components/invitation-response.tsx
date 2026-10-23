"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { answerMemberInvitation } from "@/server/actions";

export function InvitationResponse() {
  const token = useRef("");
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    token.current =
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  function respond(accept: boolean) {
    start(async () => {
      try {
        const result = await answerMemberInvitation(token.current, accept);
        setMessage(result.error ?? result.success ?? "Request failed.");
        if (result.businessId) setBusinessId(result.businessId);
        if (result.success) {
          token.current = "";
          setComplete(true);
        }
      } catch {
        setMessage("Sign in and try again.");
      }
    });
  }
  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Sign in with the invited, verified email address before responding.
      </p>
      {!complete && (
        <div className="flex gap-3">
          <Button
            type="button"
            disabled={pending}
            onClick={() => respond(true)}
          >
            Accept
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => respond(false)}
            variant="outline"
          >
            Decline
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {businessId && (
        <Link href={`/app/${businessId}`} className="text-primary underline">
          Open workspace
        </Link>
      )}
      <Link
        href="/login"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm text-primary underline"
      >
        Sign in in a new tab
      </Link>
      <Link
        href="/register"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm text-primary underline"
      >
        Create an account in a new tab
      </Link>
    </div>
  );
}
