import { NextResponse } from "next/server";

/**
 * Lightweight in-memory fixed-window limiter.
 *
 * Serverless functions are ephemeral, so this is a best-effort guard that
 * protects a single instance from a hot loop or abusive client. It is layered
 * with database-backed caps (see the assignments route) for the limits that
 * must hold across instances.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_ENTRIES = 20_000;

function sweep(now: number) {
  if (buckets.size < MAX_ENTRIES) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfter: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

/** Best-effort client IP for anonymous endpoints (register, login). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyRequests(retryAfter: number, message = "RATE_LIMITED") {
  return NextResponse.json(
    { error: message, retryAfter },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(retryAfter, 1)) },
    },
  );
}
