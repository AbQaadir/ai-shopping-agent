import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = session;
    const body = await req.json().catch(() => ({}));
    const guestId = body.guestId;

    // 1. Upsert User in Prisma to ensure they exist in our DB
    const dbUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email!,
        name: user.user_metadata.full_name || user.email!.split("@")[0],
      },
      create: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata.full_name || user.email!.split("@")[0],
      },
    });

    // 2. If a guestId was provided, migrate their data
    if (guestId && typeof guestId === "string" && guestId !== user.id) {
      // Migrate ChatSessions
      await prisma.chatSession.updateMany({
        where: { userId: guestId },
        data: { userId: user.id },
      });

      // Migrate Orders
      await prisma.order.updateMany({
        where: { userId: guestId },
        data: { userId: user.id },
      });

      console.log(`Migrated data from guest ${guestId} to user ${user.id}`);
    }

    return NextResponse.json({ success: true, user: dbUser, profileComplete: dbUser.profileComplete });
  } catch (error) {
    console.error("Error in /api/auth/sync:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
