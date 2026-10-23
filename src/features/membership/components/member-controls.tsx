"use client";
import { Button } from "@/components/ui/button";
import { utcTimestamp } from "@/lib/utils";
import { useState, useTransition } from "react";
import {
  deleteMember,
  handOffOwnership,
  revokeMemberInvitation,
  sendMemberInvitation,
  updateMemberRole,
} from "@/server/actions";

type Role = "OWNER" | "ADMIN" | "MEMBER";
type Member = { id: string; name: string; email: string; role: Role };
type Invite = { id: string; invitedEmail: string; role: Role; expiresAt: Date };

export function MemberControls({
  businessId,
  actorId,
  actorRole,
  members,
  invitations,
}: {
  businessId: string;
  actorId: string;
  actorRole: Role;
  members: Member[];
  invitations: Invite[];
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  function run(action: () => Promise<{ error?: string; success?: string }>) {
    setMessage("");
    start(async () => {
      try {
        const result = await action();
        setMessage(result.error ?? result.success ?? "Request failed.");
      } catch {
        setMessage("Request failed. Please try again.");
      }
    });
  }
  return (
    <div className="mt-8 space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          run(async () => {
            const result = await sendMemberInvitation(businessId, {
              email: data.get("email"),
              role: data.get("role"),
            });
            if (result.success) form.reset();
            return result;
          });
        }}
        className="flex flex-wrap items-end gap-3 border-t border-border pt-6"
      >
        <label className="mb-0 grid min-w-0 flex-1 gap-2 text-sm">
          Invite by email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            className="input"
          />
        </label>
        <label className="mb-0 grid min-w-0 flex-1 gap-2 text-sm">
          Role
          <select name="role" className="input">
            <option value="MEMBER">Member</option>
            {actorRole === "OWNER" && <option value="ADMIN">Admin</option>}
          </select>
        </label>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          Send invitation
        </Button>
      </form>
      <section aria-labelledby="pending-invites">
        <h2 id="pending-invites" className="text-lg font-semibold">
          Pending invitations
        </h2>
        {invitations.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No pending invitations.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  {invite.invitedEmail} · {invite.role.toLowerCase()} · Expires{" "}
                  {utcTimestamp(invite.expiresAt)}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => revokeMemberInvitation(businessId, invite.id))
                  }
                  className="text-primary underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="manage-members">
        <h2 id="manage-members" className="text-lg font-semibold">
          Manage members
        </h2>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {members.map((member) => {
            const canEdit =
              member.id !== actorId &&
              member.role !== "OWNER" &&
              (actorRole === "OWNER" || member.role === "MEMBER");
            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  {member.name} · {member.email} · {member.role.toLowerCase()}
                </span>
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                      Role
                      <select
                        aria-label={`Role for ${member.name}`}
                        value={member.role}
                        disabled={pending}
                        onChange={(event) =>
                          run(() =>
                            updateMemberRole(businessId, {
                              targetId: member.id,
                              role: event.target.value,
                            }),
                          )
                        }
                        className="rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="MEMBER">Member</option>
                        {actorRole === "OWNER" && (
                          <option value="ADMIN">Admin</option>
                        )}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${member.name} from this business?`,
                          )
                        )
                          run(() => deleteMember(businessId, member.id));
                      }}
                      className="text-destructive underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                    {actorRole === "OWNER" && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Transfer ownership to ${member.name}? You will become an admin.`,
                            )
                          )
                            run(() => handOffOwnership(businessId, member.id));
                        }}
                        className="text-primary underline disabled:opacity-50"
                      >
                        Transfer ownership
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
