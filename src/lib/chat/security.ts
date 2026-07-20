import { NextRequest } from "next/server";
import { getVerifiedUser } from "@/lib/auth";
import {
  checkGuestMessageLimit,
  getClientIp,
  rateLimit,
  rateLimitResponse,
} from "@/lib/rateLimit";

export interface SecurityCheckResult {
  allowed: boolean;
  response?: Response;
  userId?: string;
  isGuest?: boolean;
}

/**
 * Performs IP rate limiting, user authentication validation via Supabase JWT,
 * and user-specific rate limiting & guest limits.
 */
export async function verifyRequestSecurity(req: NextRequest): Promise<SecurityCheckResult> {
  // Step A: IP-level rate limit (cheap check before any expensive work)
  const ip = getClientIp(req);
  const ipLimit = rateLimit(`chat:ip:${ip}`, 60, 60_000); // 60 req/min per IP (handles bots/scrapers)
  if (!ipLimit.allowed) {
    return { allowed: false, response: rateLimitResponse(ipLimit.retryAfterSeconds) };
  }

  // Step B: Verify the Supabase JWT from the session cookie.
  // getVerifiedUser() calls supabase.auth.getUser() which validates the JWT
  // cryptographically with Supabase servers — NOT just reads the cookie.
  // Returns { userId: "guest", isGuest: true } for unauthenticated requests.
  const { userId: verifiedUserId, isGuest } = await getVerifiedUser();

  // Step C: Per-identity rate limit (tighter for auth users, very tight for guests)
  const userRateLimitKey = isGuest ? `chat:guest:${ip}` : `chat:user:${verifiedUserId}`;
  const userLimit = rateLimit(userRateLimitKey, isGuest ? 30 : 60, 60_000);
  if (!userLimit.allowed) {
    return { allowed: false, response: rateLimitResponse(userLimit.retryAfterSeconds) };
  }

  // Step D: Server-side guest message limit
  if (isGuest) {
    const guestMsgCheck = checkGuestMessageLimit(ip);
    if (!guestMsgCheck.allowed) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: "Message limit reached. Please sign in to continue chatting.",
            code: "GUEST_LIMIT_EXCEEDED",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        ),
      };
    }
  }

  return {
    allowed: true,
    userId: verifiedUserId,
    isGuest,
  };
}
