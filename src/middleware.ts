import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsign } from "cookie-signature";

const SESSION_COOKIE_NAME = "iitgn_staff_session_v4";

/**
 * Middleware to clean up tampered/invalid session cookies.
 * Runs on every request where cookies are writable.
 * Invalid cookies are deleted here instead of in Server Components.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const signedCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.COOKIE_SECRET;

  // If we have a signed cookie but no secret (dev fallback or misconfig), skip verification
  if (signedCookie && secret && secret.length >= 32) {
    const email = unsign(signedCookie, secret);

    // If unsign returns false (tampered/invalid signature), delete the cookie
    if (email === false) {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
  }

  return response;
}

/**
 * Apply middleware to all routes except static assets and API health checks.
 * Adjust paths as needed for your deployment.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - api/calendar/health (health check endpoint)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/calendar/health|public/).*)",
  ],
};