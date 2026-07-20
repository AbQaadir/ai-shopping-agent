import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logger";
import { getVerifiedUser } from "@/lib/auth";
import { getClientIp, rateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { CartItem } from "@/types/sourcing";


export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const GET = withLogging(async function GET(req: NextRequest) {
  try {
    // ── Security ──────────────────────────────────────────────────────────
    const ip = getClientIp(req);
    const rl = rateLimit(`session:get:${ip}`, 60, 60_000); // 60 req/min per IP
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

    const { userId: verifiedUserId, isGuest } = await getVerifiedUser();
    // ── End Security ──────────────────────────────────────────────────────

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || searchParams.get("id");
    const cartOnly = searchParams.get("cartOnly") === "true";

    // Use verified userId — ignore any userId from query params for data access
    const userId = verifiedUserId;

    if (cartOnly && userId) {
      const globalCart = searchParams.get("global") === "true";
      let user = await (prisma.user as any).findUnique({
        where: { id: userId },
        select: { cart: true },
      });
      if (!user && isGuest && userId === "guest") {
        user = await prisma.user.create({
          data: { id: "guest", email: "guest@kapruka.com", name: "Guest User" },
          select: { cart: true },
        });
      }
      
      let cartObj: Record<string, CartItem[]> = {};
      if (user?.cart) {
        try {
          cartObj = typeof user.cart === "string" ? JSON.parse(user.cart as string) : (user.cart as unknown as Record<string, CartItem[]>);
          if (Array.isArray(cartObj)) {
            cartObj = {};
          }
        } catch (e) {
          console.error(e);
        }
      }

      let cartItems: CartItem[] = [];
      if (globalCart) {
        const sessions = await prisma.chatSession.findMany({
          where: isGuest ? { userId: null } : { userId: userId },
          select: { id: true, title: true },
        });

        const sessionMap = new Map(sessions.map(s => [s.id, s.title]));

        const groupedCart = Object.entries(cartObj).map(([sid, items]) => {
          return {
            sessionId: sid,
            sessionTitle: sessionMap.get(sid) || "Sourcing Query",
            items: items || [],
          };
        }).filter(group => group.items.length > 0);

        return NextResponse.json(groupedCart);
      } else {
        if (sessionId && cartObj && typeof cartObj === "object" && !Array.isArray(cartObj)) {
          cartItems = cartObj[sessionId] || [];
        } else if (!sessionId && Array.isArray(cartObj)) {
          // Migration fallback: return flat array only if no sessionId is specified
          cartItems = cartObj;
        }
      }
      return NextResponse.json(cartItems);
    }

    if (sessionId) {
      // Fetch a specific session with its messages
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Ownership check: only allow access to sessions owned by the verified user
      if (session.userId && session.userId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json(session);
    } else {
      // Fetch sessions for the verified user only
      const limit = Number(searchParams.get("limit")) || 100;
      const offset = Number(searchParams.get("offset")) || 0;

      const sessions = await prisma.chatSession.findMany({
        where: isGuest ? { userId: null } : { userId: userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      return NextResponse.json(sessions);
    }
  } catch (error: any) {
    console.error("Session GET error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
});

export const PATCH = withLogging(async function PATCH(req: NextRequest) {
  try {
    // ── Security ──────────────────────────────────────────────────────────
    const { userId: verifiedUserId, isGuest } = await getVerifiedUser();
    const ip = getClientIp(req);
    const rl = rateLimit(`session:patch:${isGuest ? `ip:${ip}` : `user:${verifiedUserId}`}`, 30, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);
    // ── End Security ──────────────────────────────────────────────────────

    const body = await req.json().catch(() => ({}));
    const { sessionId, cart } = body;
    // Use verified userId — ignore body.userId
    const userId = verifiedUserId;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    let userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists && isGuest) {
      userExists = await prisma.user.create({
        data: { id: userId, email: `guest-${userId}@guest.local`, name: "Guest User" }
      });
    }

    let cartObj: Record<string, CartItem[]> = {};
    if (userExists?.cart) {
      try {
        cartObj = typeof userExists.cart === "string" ? JSON.parse(userExists.cart as string) : (userExists.cart as unknown as Record<string, CartItem[]>);
        if (Array.isArray(cartObj)) {
          cartObj = {};
        }
      } catch (e) {
        cartObj = {};
      }
    }

    if (sessionId) {
      cartObj[sessionId] = cart;

      // Also update the active checkout session if it exists
      try {
        await prisma.checkoutSession.update({
          where: { chatSessionId: sessionId },
          data: { cartItems: cart },
        });
      } catch (err) {
        // Ignored: CheckoutSession might not exist yet
      }
    }

    const updatedUser = await (prisma.user as any).update({
      where: { id: userId },
      data: { cart: cartObj },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("Session PATCH error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
});

export const POST = withLogging(async function POST(req: NextRequest) {
  try {
    // ── Security ──────────────────────────────────────────────────────────
    const { userId: verifiedUserId, isGuest } = await getVerifiedUser();
    const ip = getClientIp(req);
    const rl = rateLimit(`session:post:${isGuest ? `ip:${ip}` : `user:${verifiedUserId}`}`, 20, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);
    // ── End Security ──────────────────────────────────────────────────────

    const body = await req.json().catch(() => ({}));
    const { title } = body;
    // Use verified userId — ignore body.userId
    const userId = verifiedUserId;

    // Ensure user exists (create a dummy guest user if needed)
    if (userId && !isGuest) {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: `guest-${userId}@guest.local`,
          name: "Guest User",
        },
      });
    }

    const newSession = await prisma.chatSession.create({
      data: {
        title: title || "New Sourcing Task",
        status: "active",
        userId: !isGuest ? userId : null,
      },
    });

    return NextResponse.json(newSession);
  } catch (error: any) {
    console.error("Session POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
});

export const DELETE = withLogging(async function DELETE(req: NextRequest) {
  try {
    // ── Security ──────────────────────────────────────────────────────────
    const { userId: verifiedUserId, isGuest } = await getVerifiedUser();
    const ip = getClientIp(req);
    const rl = rateLimit(`session:delete:${isGuest ? `ip:${ip}` : `user:${verifiedUserId}`}`, 20, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);
    // ── End Security ──────────────────────────────────────────────────────

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || searchParams.get("id");
    // Use verified userId — ignore userId from query params
    const userId = verifiedUserId;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Ownership check: verify the session belongs to the requesting user before deletion
    const sessionToDelete = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!sessionToDelete) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // A session with a userId can only be deleted by that user.
    // Null-userId sessions (guest sessions) can be deleted by guest requests.
    if (sessionToDelete.userId && sessionToDelete.userId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this session." }, { status: 403 });
    }

    // 1. Delete the chat session from PostgreSQL (cascades to ChatMessage & CheckoutSession)
    await prisma.chatSession.delete({
      where: { id: sessionId },
    });

    // 2. Clean up the cart object for this session in the User's cart JSON field
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { cart: true },
      });

      if (user?.cart) {
        let cartObj: Record<string, CartItem[]> = {};
        try {
          cartObj = typeof user.cart === "string" ? JSON.parse(user.cart as string) : (user.cart as unknown as Record<string, CartItem[]>);
        } catch {
          cartObj = {};
        }

        if (cartObj && typeof cartObj === "object" && !Array.isArray(cartObj)) {
          if (sessionId in cartObj) {
            delete cartObj[sessionId];
            await (prisma.user as any).update({
              where: { id: userId },
              data: { cart: cartObj },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Session DELETE error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
});


