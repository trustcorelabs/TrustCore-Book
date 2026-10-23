import { AuthLayout } from "@/components/auth-layout";
import { AccountFlowForm } from "@/components/account-flow-form";
export const metadata = { referrer: "no-referrer" };
export default function Page() {
  return (
    <AuthLayout
      compact
      title="Verify your email"
      description="Keep your account secure. We’ll guide you through the next step."
    >
      <AccountFlowForm mode="verify" />
      <AccountFlowForm mode="resend" />
    </AuthLayout>
  );
}
