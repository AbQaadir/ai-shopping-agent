import { NextRequest, NextResponse } from "next/server";
import { pillar2_findCity } from "@/lib/tools";
import { withLogging } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const GET = withLogging(async function GET(req: NextRequest) {
  try {
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

