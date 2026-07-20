import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { CartItem, UserAddress } from "@/types/sourcing";

import { withLogging } from "@/lib/logger";

export const POST = withLogging(async function POST(req: Request) {
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
      // Fetch guest data to merge cart and addresses
      const guestUser = await prisma.user.findUnique({
        where: { id: guestId },
        select: { cart: true, addresses: true }
      });

      if (guestUser) {
        let guestCartObj: Record<string, CartItem[]> = {};
        try {
          guestCartObj = typeof guestUser.cart === "string" ? JSON.parse(guestUser.cart as string) : (guestUser.cart as unknown as Record<string, CartItem[]>);
          if (Array.isArray(guestCartObj)) guestCartObj = {};
          if (!guestCartObj) guestCartObj = {};
        } catch {
          guestCartObj = {};
        }

        let guestAddressesArr: UserAddress[] = [];
        try {
          guestAddressesArr = typeof guestUser.addresses === "string" ? JSON.parse(guestUser.addresses as string) : (guestUser.addresses as unknown as UserAddress[]);
          if (!Array.isArray(guestAddressesArr)) guestAddressesArr = [];
        } catch {
          guestAddressesArr = [];
        }

        let authCartObj: Record<string, CartItem[]> = {};
        try {
          const dbUserCart = dbUser.cart;
          authCartObj = typeof dbUserCart === "string" ? JSON.parse(dbUserCart as string) : (dbUserCart as unknown as Record<string, CartItem[]>);
          if (Array.isArray(authCartObj)) authCartObj = {};
          if (!authCartObj) authCartObj = {};
        } catch {
          authCartObj = {};
        }

        let authAddressesArr: UserAddress[] = [];
        try {
          const dbUserAddresses = dbUser.addresses;
          authAddressesArr = typeof dbUserAddresses === "string" ? JSON.parse(dbUserAddresses as string) : (dbUserAddresses as unknown as UserAddress[]);
          if (!Array.isArray(authAddressesArr)) authAddressesArr = [];
        } catch {
          authAddressesArr = [];
        }

        // Merge carts (guest wins on conflict for same session ID)
        const mergedCart = { ...authCartObj, ...guestCartObj };

        // Merge addresses (deduplicate by addressLine and city)
        const mergedAddresses = [...authAddressesArr];
        for (const gAddr of guestAddressesArr) {
          if (!gAddr) continue;
          const exists = mergedAddresses.some(
            (a) => a?.addressLine?.trim().toLowerCase() === gAddr?.addressLine?.trim().toLowerCase() && 
                   a?.city?.trim().toLowerCase() === gAddr?.city?.trim().toLowerCase()
          );
          if (!exists) {
            mergedAddresses.push(gAddr);
          }
        }

        // Update the authenticated user's cart and addresses
        await prisma.user.update({
          where: { id: user.id },
          data: {
            cart: JSON.parse(JSON.stringify(mergedCart)),
            addresses: JSON.parse(JSON.stringify(mergedAddresses)),
          },
        });
      }

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
});
