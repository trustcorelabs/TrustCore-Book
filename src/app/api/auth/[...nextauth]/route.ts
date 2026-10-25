import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { rateLimit, RateLimitExceededError } from "@/server/rate-limit";

export const runtime = "nodejs";

function postAction(request: Request, segments: string[]) {
  const path = new URL(request.url).pathname;
  const canonical = path === `/api/auth/${segments.join("/")}`;

  if (canonical && segments.length === 1 && segments[0] === "signout")
    return "signout";
  if (canonical && segments.length === 2 && segments[0] === "callback")
    return "callback";
  if (
    canonical &&
    segments[0] === "signin" &&
    (segments.length === 1 || segments.length === 2)
  )
    return "signin";
  if (canonical && segments.length === 1 && segments[0] === "session")
    return "session";
  return "other";
}

async function handler(
  request: Request,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  const params = await context.params;
  if (request.method === "POST") {
    try {
      const action = postAction(request, params.nextauth);
      let identity = `auth-post:${action}`;
      let limit = 200;
      if (action === "signout" || action === "session") {
        const options = authOptions();
        if (!options.secret)
          throw new Error("Authentication configuration unavailable");
        const token = await getToken({
          req: request as NextRequest,
          secret: options.secret,
          secureCookie: options.useSecureCookies,
        });
        if (typeof token?.sid === "string" && typeof token.sub === "string") {
          identity = `auth-post:${action}:session:${token.sid}`;
          limit = 30;
        } else {
          identity = `auth-post:${action}:anonymous`;
        }
      }
      await rateLimit(identity, limit, 60);
    } catch (error) {
      const limited = error instanceof RateLimitExceededError;
      return Response.json(
        {
          error: limited
            ? "Too many attempts. Please try again later."
            : "Authentication temporarily unavailable. Try again later.",
        },
        {
          status: limited ? 429 : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  }
  try {
    return await NextAuth(authOptions())(request, { ...context, params });
  } catch {
    // Configuration and storage failures must not become an empty 500 or leak
    // connection details. getEnv and Auth.js log only safe diagnostic labels.
    return Response.json(
      { error: "Authentication temporarily unavailable. Try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export { handler as GET, handler as POST };
