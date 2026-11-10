/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Scope: single process. For multi-instance deployments swap the Map for Redis
 * (the RATE_LIMIT_DRIVER env var is reserved for that migration).
 *
 * This is intentionally dependency-free and fail-safe: if anything throws, the
 * request is allowed through rather than locking users out.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** Occasionally evict empty buckets so the map cannot grow unbounded. */
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  buckets.forEach((bucket, key) => {
    if (bucket.hits.length === 0) buckets.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * @param key      Stable identity for the caller, e.g. "login:1.2.3.4"
 * @param limit    Max requests allowed inside the window
 * @param windowMs Window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  try {
    const now = Date.now();
    sweep(now);

    const cutoff = now - windowMs;
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((t) => t > cutoff);

    if (bucket.hits.length >= limit) {
      buckets.set(key, bucket);
      const oldest = bucket.hits[0] ?? now;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: Math.max(0, limit - bucket.hits.length),
      retryAfterSeconds: 0,
    };
  } catch (err) {
    console.error("Rate limiter error (failing open):", err);
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 };
  }
}

/** Best-effort client identity. Never trust this for authorization. */
export function clientKey(req: Request, prefix: string): string {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0].trim() : "") ||
    headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}

/** Reads an integer env var with a fallback. */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}