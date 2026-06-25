import { NextRequest, NextResponse } from "next/server";
import { placeOrderInternally } from "@/lib/orderService";
import { withLogging } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const POST = withLogging(async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
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

