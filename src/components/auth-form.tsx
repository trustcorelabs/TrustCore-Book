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
  async function submit(values: z.infer<typeof schema>) {
    setMessage("");
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
      onSubmit={handleSubmit(submit)}
      className="space-y-5"
    >
      {isRegister && (
        <div>
          <label htmlFor="name">Full name</label>
          <Input
            id="name"
            autoComplete="name"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-destructive">
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
          {...register("email")}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <PasswordInput
          id="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          {...register("password")}
          aria-invalid={!!errors.password}
          aria-describedby={isRegister ? "password-hint" : undefined}
        />
        {isRegister && (
          <p id="password-hint" className="mt-2 text-xs text-muted-foreground">
            At least 12 characters. Up to 72 UTF-8 bytes.
          </p>
        )}
        {errors.password && (
          <p className="mt-1 text-xs text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      {message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm ${success ? "bg-accent text-primary" : "bg-muted text-destructive"}`}
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
        disabled={isSubmitting || success}
        className="w-full"
      >
        {isSubmitting
          ? "Please wait…"
          : isRegister
            ? "Create account"
            : "Sign in"}
      </Button>
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
