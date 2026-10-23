import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { AuthForm } from "@/components/auth-form";
export default function Page() {
  return (
    <AuthLayout
      title="Your next chapter starts here"
      description="Create an account, then make a workspace your own."
    >
      <AuthForm mode="register" />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary-ink hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
