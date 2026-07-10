import { NextRequest, NextResponse } from "next/server";
import { pillar2_trackOrder } from "@/lib/tools";
import { withLogging } from "@/lib/logger";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * GET /api/track?kaprukaRef=<ref>
 *
 * Server-side proxy for kapruka_track_order MCP tool.
 * Called by the OrdersPanel "Track Order" button without going through chat.
 *
 * Returns the tracking result (current status, steps, estimated delivery).
 */
export const GET = withLogging(async function GET(req: NextRequest) {
  try {
    // ── Security: IP Rate Limiting ─────────────────────────────────────────
    const ip = getClientIp(req);
    const rl = rateLimit(`track:ip:${ip}`, 30, 60_000); // 30 req/min per IP
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);
    // ── End Security ──────────────────────────────────────────────────────

    const kaprukaRef = req.nextUrl.searchParams.get("kaprukaRef");

    if (!kaprukaRef) {
      return NextResponse.json(
        { error: "Missing kaprukaRef parameter" },
        { status: 400 }
      );
    }

    const result = await pillar2_trackOrder(kaprukaRef);

    if (!result) {
      return NextResponse.json(
        { error: "Tracking information not available for this order" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/track] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch tracking information" },
      { status: 500 }
    );
  }
});

