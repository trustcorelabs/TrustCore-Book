"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema, registerSchema } from "@/lib/validation";
import { register as registerAccount } from "@/server/actions";
import { Button } from "./ui/button";
import { PasswordInput } from "./ui/password-input";
import { Input } from "./ui/input";
import { useHydrated } from "@/hooks/use-hydrated";
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const schema = isRegister
    ? registerSchema
    : loginSchema.extend({ name: z.string().optional() });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const hydrated = useHydrated();
  async function submit(values: z.infer<typeof schema>) {
    setMessage("");
    setSuccess(false);
    try {
      if (isRegister) {
        const result = await registerAccount(values);
        if (result.error) {
          setMessage(result.error);
          return;
        }
        setSuccess(true);
        try {
          const session = await signIn("credentials", {
            email: values.email,
            password: values.password,
            redirect: false,
            callbackUrl: "/app",
          });
          if (session?.ok) {
            router.push("/app");
            router.refresh();
            return;
          }
        } catch {
          // Registration may have succeeded even if immediate sign-in is unavailable.
        }
        setMessage(
          result.success ??
            "If this address is available, sign in with your password.",
        );
      } else {
        const result = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
          callbackUrl: "/app",
        });
        if (result?.ok) {
          router.push("/app");
          router.refresh();
        } else
          setMessage(
            "Unable to sign in. Check your details or try again later.",
          );
      }
    } catch {
      setMessage("Unable to connect. Please try again.");
    }
  }
  return (
    <form
      action={isRegister ? "/register" : "/login"}
      method="post"
      noValidate
      aria-busy={isSubmitting}
      onSubmit={handleSubmit(submit)}
      className="space-y-5"
    >
      {isRegister && (
        <div>
          <label htmlFor="name">Full name</label>
          <Input
            id="name"
            autoComplete="name"
            className="text-base sm:text-sm"
            disabled={!hydrated || isSubmitting || success}
            {...register("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
      )}
      <div>
        <label htmlFor="email">Email address</label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="text-base sm:text-sm"
          autoCapitalize="none"
          spellCheck={false}
          disabled={!hydrated || isSubmitting || success}
          {...register("email")}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <PasswordInput
          id="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          className="text-base sm:text-sm"
          disabled={!hydrated || isSubmitting || success}
          {...register("password")}
          aria-invalid={!!errors.password}
          aria-describedby={
            [isRegister && "password-hint", errors.password && "password-error"]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {isRegister && (
          <p id="password-hint" className="mt-2 text-xs text-muted-foreground">
            At least 12 characters. Up to 72 UTF-8 bytes.
          </p>
        )}
        {errors.password && (
          <p id="password-error" className="mt-1 text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      {message && (
        <p
          role={success ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm leading-6 ${success ? "border-teal-ink/15 bg-teal-soft text-teal-ink" : "border-pink-ink/15 bg-pink-soft text-pink-ink"}`}
        >
          {message}
          {success && isRegister && (
            <>
              {" "}
              <Link className="underline" href="/login">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}
      <Button
        type="submit"
        disabled={!hydrated || isSubmitting || success}
        className="w-full"
      >
        {isSubmitting
          ? "Please wait…"
          : isRegister
            ? "Create account"
            : "Sign in"}
      </Button>
      <noscript>
        <p className="notice">Enable JavaScript to securely use this form.</p>
      </noscript>
      {!isRegister && (
        <div className="text-sm">
          <Link
            href="/forgot-password"
            className="text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      )}
    </form>
  );
}
