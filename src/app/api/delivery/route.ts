import { NextRequest, NextResponse } from "next/server";
import { pillar2_findCity } from "@/lib/tools";
import { withLogging } from "@/lib/logger";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const GET = withLogging(async function GET(req: NextRequest) {
  try {
    // ── Security: IP Rate Limiting ─────────────────────────────────────────
    const ip = getClientIp(req);
    const rl = rateLimit(`delivery:ip:${ip}`, 30, 60_000); // 30 req/min per IP
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);
    // ── End Security ──────────────────────────────────────────────────────

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    if (!q.trim()) {
      return NextResponse.json([]);
    }

    const cities = await pillar2_findCity(q);
    return NextResponse.json(cities);
  } catch (error: any) {
    console.error("Failed to query cities:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
});

