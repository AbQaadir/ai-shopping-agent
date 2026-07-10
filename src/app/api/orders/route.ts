import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/auth";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rateLimit";


export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/orders
 *
 * Returns all orders for the authenticated user, including order items.
 * Ordered by most recent first.
 *
 * Used by the OrdersPanel sidebar component to display the user's order history.
 * Authentication required — guests receive 401.
 */
export const GET = withLogging(async function GET(req: NextRequest) {
  try {
    // ── Security ──────────────────────────────────────────────────────────
    const ip = getClientIp(req);
    const ipLimit = rateLimit(`orders:ip:${ip}`, 30, 60_000);
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);

    const { userId: verifiedUserId, isGuest } = await getVerifiedUser();

    // Order history is only available for authenticated users
    if (isGuest) {
      return NextResponse.json(
        { error: "Authentication required to view orders." },
        { status: 401 }
      );
    }

    const userLimit = rateLimit(`orders:user:${verifiedUserId}`, 20, 60_000);
    if (!userLimit.allowed) return rateLimitResponse(userLimit.retryAfterSeconds);
    // ── End Security ──────────────────────────────────────────────────────

    // Use verifiedUserId — ignore any userId from query params
    const orders = await prisma.order.findMany({
      where: { userId: verifiedUserId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error("[GET /api/orders] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
});
