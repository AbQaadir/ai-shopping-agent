import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || searchParams.get("id");
    const userId = searchParams.get("userId");
    const cartOnly = searchParams.get("cartOnly") === "true";

    if (cartOnly && userId) {
      let user = await (prisma.user as any).findUnique({
        where: { id: userId },
        select: { cart: true },
      });
      if (!user && userId === "guest") {
        user = await (prisma.user as any).create({
          data: { id: "guest", email: "guest@kapuruka.com", name: "Guest User" },
          select: { cart: true },
        });
      }
      
      let cartItems: any[] = [];
      if (user?.cart) {
        try {
          const cartObj = typeof user.cart === "string" ? JSON.parse(user.cart as string) : (user.cart as Record<string, any[]>);
          if (sessionId && cartObj && typeof cartObj === "object" && !Array.isArray(cartObj)) {
            cartItems = cartObj[sessionId] || [];
          } else if (!sessionId && Array.isArray(cartObj)) {
            // Migration fallback: return flat array only if no sessionId is specified
            cartItems = cartObj;
          }
        } catch (e) {
          console.error(e);
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

      return NextResponse.json(session);
    } else {
      // Fetch sessions filtered by userId if provided, sorted by creation time descending
      const sessions = await prisma.chatSession.findMany({
        where: userId ? { userId: userId === "guest" ? null : userId } : undefined,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(sessions);
    }
  } catch (error: any) {
    console.error("Session GET error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, sessionId, cart } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    let userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists && userId === "guest") {
      userExists = await prisma.user.create({
        data: { id: "guest", email: "guest@kapuruka.com", name: "Guest User" }
      });
    }

    let cartObj: Record<string, any[]> = {};
    if (userExists?.cart) {
      try {
        cartObj = typeof userExists.cart === "string" ? JSON.parse(userExists.cart as string) : (userExists.cart as Record<string, any[]>);
        if (Array.isArray(cartObj)) {
          cartObj = {};
        }
      } catch (e) {
        cartObj = {};
      }
    }

    if (sessionId) {
      cartObj[sessionId] = cart;
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title, userId } = body;

    const newSession = await prisma.chatSession.create({
      data: {
        title: title || "New Sourcing Task",
        status: "active",
        userId: userId && userId !== "guest" ? userId : null,
      },
    });

    return NextResponse.json(newSession);
  } catch (error: any) {
    console.error("Session POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
