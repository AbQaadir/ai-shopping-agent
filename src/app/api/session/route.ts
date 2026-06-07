import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("id");

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
      // Fetch all sessions sorted by creation time descending
      const sessions = await prisma.chatSession.findMany({
        orderBy: { createdAt: "desc" },
      });

      // Sort pinned sessions to the top
      sessions.sort((a: any, b: any) => {
        const aPinned = a.status === "pinned" ? 1 : 0;
        const bPinned = b.status === "pinned" ? 1 : 0;
        return bPinned - aPinned;
      });

      return NextResponse.json(sessions);
    }
  } catch (error: any) {
    console.error("Session GET error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { title } = body;

    const newSession = await prisma.chatSession.create({
      data: {
        title: title || "New Sourcing Task",
        status: "active",
      },
    });

    return NextResponse.json(newSession);
  } catch (error: any) {
    console.error("Session POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, status, title } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    const updated = await prisma.chatSession.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(title !== undefined && { title }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Session PATCH error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    await prisma.chatSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Session DELETE error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
