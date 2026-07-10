import { NextRequest, NextResponse } from "next/server";
import { placeOrderInternally } from "@/lib/orderService";
import { withLogging } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/auth";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const POST = withLogging(async function POST(req: NextRequest) {
  try {
    // ── Security: Auth & Rate Limiting ────────────────────────────────────
    const { userId: verifiedUserId, isGuest } = await getVerifiedUser();

    // Only authenticated users can place orders
    if (isGuest) {
      return NextResponse.json(
        { error: "Authentication required to place an order. Please sign in." },
        { status: 401 }
      );
    }

    // Rate limit: 10 order-creates per hour per authenticated user
    const ip = getClientIp(req);
    const orderLimit = rateLimit(`order:user:${verifiedUserId}`, 10, 60 * 60_000);
    if (!orderLimit.allowed) {
      return rateLimitResponse(orderLimit.retryAfterSeconds);
    }
    // ── End Security Guards ────────────────────────────────────────────────

    const body = await req.json().catch(() => ({}));

    // Override any userId in the body with the verified identity.
    // This prevents a client from placing orders under another user's account.
    body.userId = verifiedUserId;

    // Defer all validation and execution to the shared service
    const result = await placeOrderInternally(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to process order API request:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: error.message?.includes("Missing") || error.message?.includes("Invalid") ? 400 : 500 }
    );
  }
});

