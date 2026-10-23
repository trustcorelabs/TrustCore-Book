import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { AuthForm } from "@/components/auth-form";
export default function Page() {
  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to your workspace. Your day is waiting."
    >
      <AuthForm mode="login" />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to TrustCore Book?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary-ink hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
