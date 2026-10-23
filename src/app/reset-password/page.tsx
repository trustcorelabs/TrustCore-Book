import { AuthLayout } from "@/components/auth-layout";
import { AccountFlowForm } from "@/components/account-flow-form";
export const metadata = { referrer: "no-referrer" };
export default function Page() {
  return (
    <AuthLayout
      compact
      title="Choose a new password"
      description="Keep your account secure. We’ll guide you through the next step."
    >
      <AccountFlowForm mode="reset" />
    </AuthLayout>
  );
}
