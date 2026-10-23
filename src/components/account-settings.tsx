"use client";
import { utcTimestamp } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { PasswordInput } from "./ui/password-input";
import { Input } from "./ui/input";
import {
  changeOwnPassword,
  revokeAllOwnSessions,
  revokeOwnSession,
  updateOwnProfile,
} from "@/server/actions";

type Account = {
  profile: { name: string; email: string; createdAt: string };
  sessions: {
    id: string;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    current: boolean;
  }[];
};

export function AccountSettings({ account }: { account: Account }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(
    operation: () => Promise<{
      error?: string;
      success?: string;
      signedOut?: boolean;
    }>,
  ) {
    setBusy(true);
    setNotice("");
    try {
      const result = await operation();
      setNotice(
        result.error ?? result.success ?? "Unable to complete request.",
      );
      if (result.signedOut) {
        try {
          await signOut({ redirect: false, callbackUrl: "/login" });
        } catch {
          // Server-side revocation already succeeded; navigation still ends this UI session.
        } finally {
          router.replace("/login");
          router.refresh();
        }
      } else if (result.success) {
        router.refresh();
      }
    } catch {
      setNotice("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <div className="space-y-8">
        <section aria-labelledby="profile-heading" className="space-y-4">
          <h2 id="profile-heading" className="text-xl font-semibold">
            Profile
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const name = new FormData(form).get("name");
              void run(() => updateOwnProfile({ name }));
            }}
            className="grid gap-2"
          >
            <label htmlFor="account-name" className="mb-0 block text-sm">
              Full name
            </label>
            <Input
              id="account-name"
              name="name"
              defaultValue={account.profile.name}
              minLength={2}
              maxLength={100}
              required
              autoComplete="name"
            />
            <Button
              className="mt-2 justify-self-start"
              type="submit"
              disabled={busy}
            >
              Save profile
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Email address: {account.profile.email}
          </p>
        </section>
        <section
          aria-labelledby="password-heading"
          className="space-y-4 border-t border-border pt-7"
        >
          <h2 id="password-heading" className="text-xl font-semibold">
            Change password
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void run(() =>
                changeOwnPassword({
                  currentPassword: data.get("currentPassword"),
                  newPassword: data.get("newPassword"),
                }),
              );
              form.reset();
            }}
            className="grid gap-2"
          >
            <label htmlFor="current-password" className="mb-0 block text-sm">
              Current password
            </label>
            <PasswordInput
              id="current-password"
              name="currentPassword"
              autoComplete="current-password"
              required
            />
            <label htmlFor="new-password" className="mb-0 block text-sm">
              New password
            </label>
            <PasswordInput
              id="new-password"
              name="newPassword"
              autoComplete="new-password"
              minLength={12}
              required
            />
            <p className="text-xs text-muted-foreground">
              12 to 72 characters, at most 72 UTF-8 bytes.
            </p>
            <Button
              className="mt-2 justify-self-start"
              type="submit"
              disabled={busy}
            >
              Change password
            </Button>
          </form>
        </section>
      </div>
      <section aria-labelledby="sessions-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sessions-heading" className="text-xl font-semibold">
            Sessions
          </h2>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void run(revokeAllOwnSessions)}
          >
            Sign out everywhere
          </Button>
        </div>
        <ul className="divide-y divide-border border-y border-border">
          {account.sessions
            .filter((session) => !session.revokedAt)
            .map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {session.current ? "This session" : "Other session"}
                  </p>
                  <p className="text-muted-foreground">
                    Started {utcTimestamp(session.createdAt)}
                  </p>
                  <p className="text-muted-foreground">
                    Expires {utcTimestamp(session.expiresAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => revokeOwnSession(session.id))}
                >
                  Revoke
                </Button>
              </li>
            ))}
        </ul>
        <p role="status" aria-live="polite" className="text-sm">
          {notice}
        </p>
      </section>
    </div>
  );
}
