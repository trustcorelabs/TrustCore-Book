import "server-only";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import {
  findCredentialsUser,
  createSession,
  findActiveSession,
  revokeSession,
} from "@/server/repositories/identity";
import { getEnv } from "./env";
import { loginSchema } from "./validation";
import { rateLimit, RateLimitExceededError } from "@/server/rate-limit";
const MAX_AGE = 8 * 60 * 60;
// A valid dummy hash makes unknown accounts follow the same password-verification path.
const DUMMY = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
export function authOptions(): NextAuthOptions {
  return {
    secret: getEnv().NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: MAX_AGE },
    jwt: { maxAge: MAX_AGE },
    useSecureCookies: process.env.NODE_ENV === "production",
    pages: { signIn: "/login", error: "/login" },
    providers: [
      Credentials({
        name: "Email and password",
        credentials: {
          email: { type: "email" },
          password: { type: "password" },
        },
        async authorize(credentials) {
          const input = loginSchema.safeParse(credentials);
          if (!input.success) return null;
          try {
            await rateLimit(`login:${input.data.email}`, 10);
            const user = await findCredentialsUser(input.data.email);
            const valid = await compare(
              input.data.password,
              user?.passwordHash ?? DUMMY,
            );
            if (
              !user ||
              !valid ||
              (user.emailVerificationRequired && !user.emailVerifiedAt)
            )
              return null;
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              credentialVersion: user.credentialVersion,
            };
          } catch (error) {
            throw new Error(
              error instanceof RateLimitExceededError
                ? "Too many attempts. Please try again later."
                : "Authentication temporarily unavailable. Try again later.",
            );
          }
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          const record = await createSession(
            user.id,
            user.credentialVersion ?? 0,
            new Date(Date.now() + MAX_AGE * 1000),
          );
          if (!record)
            throw new Error("Authentication state changed. Sign in again.");
          token.sid = record.id;
        }
        return token;
      },
      async session({ session, token }) {
        const record =
          typeof token.sid === "string" && token.sub
            ? await findActiveSession(token.sid, token.sub)
            : null;
        if (!record)
          return {
            ...session,
            user: { id: "", name: null, email: null },
            sessionId: "",
            expires: new Date(0).toISOString(),
          };
        if (session.user) {
          session.user.id = token.sub ?? "";
          session.sessionId = record.id;
        }
        session.expires = record.expiresAt.toISOString();
        return session;
      },
      async redirect({ url, baseUrl }) {
        try {
          const destination = new URL(url, baseUrl);
          return destination.origin === new URL(baseUrl).origin &&
            !destination.username &&
            !destination.password
            ? destination.toString()
            : baseUrl;
        } catch {
          return baseUrl;
        }
      },
    },
    events: {
      async signOut({ token }) {
        if (typeof token?.sid === "string") await revokeSession(token.sid);
      },
    },
    logger: {
      error(code) {
        console.error("Authentication error:", code);
      },
      warn(code) {
        console.warn("Authentication warning:", code);
      },
      debug() {},
    },
  };
}
