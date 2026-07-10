import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { KAPRUKA_CITIES_SET } from "@/constants/cities";
import { withLogging } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/auth";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rateLimit";


/**
 * GET /api/user/profile
 * Returns the verified user's profile: name, phone, addresses, profileComplete.
 * Authentication required.
 */
export const GET = withLogging(async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const ipLimit = rateLimit(`profile:get:${ip}`, 30, 60_000);
  if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);

  const { userId: verifiedUserId, isGuest } = await getVerifiedUser();

  if (isGuest) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: verifiedUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        addresses: true,
        profileComplete: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("[GET /api/user/profile] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

/**
 * PATCH /api/user/profile
 * Updates the verified user's profile. Only updates provided fields.
 * Body: { name?, phone?, addresses?, profileComplete? }
 * Authentication required.
 */
export const PATCH = withLogging(async function PATCH(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { userId: verifiedUserId, isGuest } = await getVerifiedUser();

    if (isGuest) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const userLimit = rateLimit(`profile:patch:user:${verifiedUserId}`, 10, 60_000);
    if (!userLimit.allowed) return rateLimitResponse(userLimit.retryAfterSeconds);

    const body = await req.json();
    const { name, phone, addresses, profileComplete } = body;
    // Note: userId is intentionally NOT read from body — we use verifiedUserId

    // Build update object with only provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (addresses !== undefined) {
      if (!Array.isArray(addresses)) {
        return NextResponse.json({ error: "addresses must be an array" }, { status: 400 });
      }
      for (const addr of addresses) {
        if (!addr.city || typeof addr.city !== "string") {
          return NextResponse.json({ error: "city is required for all addresses" }, { status: 400 });
        }
        if (!KAPRUKA_CITIES_SET.has(addr.city)) {
          return NextResponse.json({ error: `Invalid city: ${addr.city}` }, { status: 400 });
        }
      }
      updateData.addresses = addresses;
    }
    if (profileComplete !== undefined) updateData.profileComplete = profileComplete;

    const updatedUser = await prisma.user.update({
      where: { id: verifiedUserId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        addresses: true,
        profileComplete: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("[PATCH /api/user/profile] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});



