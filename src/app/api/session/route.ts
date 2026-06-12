import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("id");
    const userId = searchParams.get("userId");
    const cartOnly = searchParams.get("cartOnly") === "true";

    if (cartOnly && userId) {
      const sessions = await (prisma.chatSession as any).findMany({
        where: {
          userId: userId === "guest" ? null : userId,
          cart: { not: null },
        },
        select: {
          id: true,
          title: true,
          cart: true,
          createdAt: true,
        },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json(sessions);
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
    const { sessionId, cart } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const updatedSession = await (prisma.chatSession as any).update({
      where: { id: sessionId },
      data: { cart },
    });

    return NextResponse.json(updatedSession);
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
