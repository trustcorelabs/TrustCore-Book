import { InvitationResponse } from "@/features/membership/components/invitation-response";
import { AuthLayout } from "@/components/auth-layout";
export default function Page() {
  return (
    <AuthLayout
      compact
      title="You’re invited"
      description="A new workspace could be waiting for you."
    >
      <InvitationResponse />
    </AuthLayout>
  );
}
