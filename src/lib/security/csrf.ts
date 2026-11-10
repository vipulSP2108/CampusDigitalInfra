/**
 * Lightweight CSRF origin defense.
 *
 * Strategy: for state-changing methods, if the browser supplies an Origin
 * (or Referer), it must match the request host or the configured APP_BASE_URL.
 * Requests without either header are allowed so non-browser clients and
 * same-origin navigations keep working; modern browsers always attach Origin
 * to cross-site form posts and fetches, which is the vector we care about.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function firstHost(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0].trim();
  return first || null;
}

/** Extract the origin ("scheme://host[:port]") from a URL string, or null. */
function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export interface CsrfCheckResult {
  ok: boolean;
  reason?: string;
}

export function checkCsrfOrigin(headers: Headers, method: string): CsrfCheckResult {
  if (!MUTATING_METHODS.has(method.toUpperCase())) {
    return { ok: true };
  }

  // Reconstruct this request's own origin.
  const proto = firstHost(headers.get("x-forwarded-proto")) ?? "http";
  const host = firstHost(headers.get("x-forwarded-host")) ?? firstHost(headers.get("host"));
  const selfOrigin = host ? `${proto}://${host}` : null;

  const allowed = new Set<string>();
  if (selfOrigin) allowed.add(selfOrigin);
  const configured = originOf(process.env.APP_BASE_URL);
  if (configured) allowed.add(configured);

  // Prefer Origin; fall back to Referer's origin.
  const supplied = originOf(headers.get("origin")) ?? originOf(headers.get("referer"));

  // No origin information => allow (non-browser client / same-origin navigation).
  if (!supplied) {
    return { ok: true };
  }

  if (allowed.has(supplied)) {
    return { ok: true };
  }

  return { ok: false, reason: `Cross-origin ${method} blocked (origin: ${supplied})` };
}