import Link from "next/link";
import { notFound } from "next/navigation";
import { listBusinessMembersService } from "@/server/member-management";
import { a2Enabled, pendingInvitations } from "@/server/membership";
import { MemberControls } from "@/features/membership/components/member-controls";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ after?: string | string[] }>;
}) {
  const { businessId } = await params;
  const cursor = (await searchParams).after;
  if (Array.isArray(cursor)) notFound();
  const directory = await listBusinessMembersService(businessId, cursor);
  const invitations = a2Enabled() ? await pendingInvitations(businessId) : [];

  return (
    <div className="min-w-0">
      <p className="eyebrow mb-3">{directory.businessName}</p>
      <h1 className="text-3xl font-bold">Members</h1>
      <div className="surface mt-7 min-w-0 p-4">
        <ul
          className="divide-y divide-border sm:hidden"
          aria-label="Business members"
        >
          {directory.members.map((member) => (
            <li
              key={member.id}
              className="space-y-2 py-4 text-sm first:pt-0 last:pb-0"
            >
              <p className="font-semibold">{member.name}</p>
              <p className="break-all text-muted-foreground">{member.email}</p>
              <p className="text-xs capitalize text-primary-ink">
                {member.role.toLowerCase()}
              </p>
            </li>
          ))}
          {!directory.members.length && (
            <li className="py-4 text-sm text-muted-foreground">
              No members found.
            </li>
          )}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-3 pr-5 font-medium">
                  Name
                </th>
                <th scope="col" className="py-3 pr-5 font-medium">
                  Email
                </th>
                <th scope="col" className="py-3 font-medium">
                  Role
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {directory.members.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-muted-foreground">
                    No members found.
                  </td>
                </tr>
              )}
              {directory.members.map((member) => (
                <tr key={member.id}>
                  <td className="py-4 pr-5 font-medium">{member.name}</td>
                  <td className="py-4 pr-5 text-muted-foreground">
                    {member.email}
                  </td>
                  <td className="py-4 capitalize">
                    {member.role.toLowerCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <nav
        aria-label="Member pages"
        className="mt-5 flex items-center gap-5 text-sm"
      >
        {cursor && (
          <Link
            href={`/app/${businessId}/members`}
            className="text-primary hover:underline"
          >
            First page
          </Link>
        )}
        {directory.nextCursor && (
          <Link
            href={{
              pathname: `/app/${businessId}/members`,
              query: { after: directory.nextCursor },
            }}
            className="text-primary hover:underline"
          >
            Next page
          </Link>
        )}
      </nav>
      {a2Enabled() && (
        <MemberControls
          businessId={businessId}
          actorId={directory.actorId}
          actorRole={directory.actorRole}
          members={directory.members}
          invitations={invitations}
        />
      )}
    </div>
  );
}
