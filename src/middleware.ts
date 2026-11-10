import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsign } from "cookie-signature";
import { checkCsrfOrigin } from "@/lib/security/csrf";

const SESSION_COOKIE_NAME = "iitgn_staff_session_v4";

/**
 * Middleware responsibilities:
 *  1. Clean up tampered/invalid session cookies (cookies are writable here).
 *  2. Enforce same-origin for state-changing API requests (CSRF defense).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. CSRF origin check for mutating API requests.
  //    Exempt the internal cron endpoint (server-to-server, no browser Origin)
  //    after confirming it carries the shared secret.
  if (pathname.startsWith("/api/")) {
    const isServerToServer =
      pathname.startsWith("/api/internal/cron/") &&
      hasValidCronSecret(request);
    if (!isServerToServer) {
      const csrf = checkCsrfOrigin(request.headers, request.method);
      if (!csrf.ok) {
        return NextResponse.json(
          { success: false, error: "Request blocked: cross-origin request rejected." },
          { status: 403 }
        );
      }
    }
  }

  const response = NextResponse.next();

  // 2. Clear tampered session cookies.
  const signedCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.COOKIE_SECRET;

  if (signedCookie && secret && secret.length >= 32) {
    const email = unsign(signedCookie, secret);
    if (email === false) {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
  }

  return response;
}

function hasValidCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/calendar/health|public/).*)",
  ],
};