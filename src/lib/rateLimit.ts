/**
 * In-memory sliding-window rate limiter.
 *
 * Designed for single-instance Railway deployments. If you later scale to
 * multiple replicas, swap the `store` Map for a Redis client in one place.
 *
 * Strategy: Sliding Window Counter
 * Each bucket stores an array of request timestamps. On every incoming request:
 *  1. Prune timestamps older than `windowMs`.
 *  2. If the remaining count >= maxRequests → reject.
 *  3. Otherwise, push the current timestamp and allow.
 *
 * Usage:
 * ```ts
 * const result = await rateLimit(`chat:user:${userId}`, 30, 60_000);
 * if (!result.allowed) {
 *   return new Response(
 *     JSON.stringify({ error: `Too many requests. Retry after ${result.retryAfterSeconds}s.` }),
 *     { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
 *   );
 * }
 * ```
 */

interface RateLimitResult {
  /** Whether the request is within the allowed rate. */
  allowed: boolean;
  /** Seconds the caller should wait before retrying (0 if allowed). */
  retryAfterSeconds: number;
  /** Current request count in the window. */
  count: number;
}

// Central in-memory store: identifier → array of request timestamps (ms)
const store = new Map<string, number[]>();

// Periodically clean up keys with no recent activity to prevent memory leaks.
// Runs every 5 minutes and removes buckets with zero requests in the last hour.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_MAX_IDLE_MS = 60 * 60 * 1000; // 1 hour idle → evict

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of store.entries()) {
    const recent = timestamps.filter((t) => now - t < CLEANUP_MAX_IDLE_MS);
    if (recent.length === 0) {
      store.delete(key);
    } else {
      store.set(key, recent);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Check and record a rate limit hit for a given identifier.
 *
 * @param identifier - Unique key for this rate limit bucket, e.g. "chat:ip:1.2.3.4"
 * @param maxRequests - Maximum number of requests allowed within the window.
 * @param windowMs    - Length of the sliding window in milliseconds.
 */
export function rateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get existing timestamps for this bucket, pruned to the current window
  const timestamps = (store.get(identifier) ?? []).filter(
    (t) => t > windowStart
  );

  if (timestamps.length >= maxRequests) {
    // The oldest timestamp in the window tells us when a slot will free up
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { allowed: false, retryAfterSeconds, count: timestamps.length };
  }

  // Allow the request — record the new timestamp
  timestamps.push(now);
  store.set(identifier, timestamps);

  return { allowed: true, retryAfterSeconds: 0, count: timestamps.length };
}

// ── Convenience helpers ────────────────────────────────────────────────────

/**
 * Returns a 429 Response with the correct Retry-After header.
 * Use this to keep route handler code concise.
 */
export function rateLimitResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      error: `Too many requests. Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} before trying again.`,
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Extract the real client IP from the incoming request headers.
 * Respects x-forwarded-for (set by Railway / Vercel / load balancers).
 */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Fallback — not available in Edge, but fine in Node runtime
  return "unknown";
}

// ── Guest message counting ─────────────────────────────────────────────────
// Tracks how many chat messages a guest IP has sent in the current server process.
// This is a soft server-side enforcement of the 9-message guest limit that exists
// client-side in useSourcingStore.ts. Prevents API abuse via raw curl/Postman.

const GUEST_MESSAGE_LIMIT = 9;
const GUEST_WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour rolling window

/**
 * Check and record a guest message attempt.
 * Returns `{ allowed: false }` when the guest IP has exceeded 9 messages in 24h.
 */
export function checkGuestMessageLimit(ip: string): RateLimitResult {
  return rateLimit(`guest_msg:ip:${ip}`, GUEST_MESSAGE_LIMIT, GUEST_WINDOW_MS);
}
