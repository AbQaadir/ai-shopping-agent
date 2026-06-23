import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pillar1_createOrderLink } from "@/lib/tools";
import { KAPRUKA_CITIES_SET } from "@/constants/cities";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      productId,
      quantity,
      items, // Array of { productId, productName, quantity, priceLKR, imageUrl }
      recipient,
      sessionId,
      userId,
      productTitle,
      priceLKR,
      imageUrl,
      paymentMethod, // "cod" | "card"
    } = body;

    if (!recipient || !sessionId || (!items && (!productId || !quantity))) {
      return NextResponse.json(
        { error: "Missing required fields: items/productId, quantity, recipient, sessionId" },
        { status: 400 }
      );
    }

    const { name, phone, address, city } = recipient;
    if (!name || !phone || !address || !city) {
      return NextResponse.json(
        { error: "Recipient details must include name, phone, address, and city" },
        { status: 400 }
      );
    }

    if (!KAPRUKA_CITIES_SET.has(city)) {
      return NextResponse.json(
        { error: `Invalid delivery city: ${city}. Must be a valid Kapruka city.` },
        { status: 400 }
      );
    }

    // Call MCP tool to create order link
    const orderResult = await pillar1_createOrderLink(
      items && items.length > 0
        ? items.map((i: any) => ({ productId: i.productId, quantity: i.quantity }))
        : productId,
      items && items.length > 0 ? recipient : quantity,
      items && items.length > 0 ? undefined : recipient
    );

    if (!orderResult) {
      return NextResponse.json(
        { error: "Failed to create order link via Kapruka MCP" },
        { status: 500 }
      );
    }

    // Prepare checkout link structure
    const checkoutLink = {
      productId: items && items.length > 0 ? items[0].productId : productId,
      productTitle: items && items.length > 0 
        ? (items.length === 1 ? items[0].productName : `${items.length} items`)
        : (productTitle || "Kapruka Product"),
      priceLKR: orderResult.totalLKR || (items && items.length > 0
        ? items.reduce((sum: number, i: any) => sum + (i.priceLKR * i.quantity), 0)
        : (priceLKR || 0) * quantity),
      checkoutUrl: orderResult.checkoutUrl,
      expiresAt: orderResult.expiresAt,
    };

    // Save checkoutLink card message in ChatMessage database
    const isCOD = paymentMethod === "cod";
    let confirmContent = "";
    if (items && items.length > 0) {
      const itemsListStr = items.map((i: any) => `${i.quantity}x **${i.productName}**`).join(", ");
      confirmContent = isCOD
        ? `Your **Cash on Delivery** order for ${itemsListStr} has been placed! 🎉 Our courier will deliver it to ${recipient?.city || "your address"}. Please have Rs. ${checkoutLink.priceLKR.toLocaleString()} ready upon delivery.`
        : `I've generated a secure checkout link for your items (${itemsListStr}). Please complete the payment within 60 minutes.`;
    } else {
      confirmContent = isCOD
        ? `Your **Cash on Delivery** order for **${checkoutLink.productTitle}** has been placed! 🎉 Our courier will deliver it to ${recipient?.city || "your address"}. Please have Rs. ${checkoutLink.priceLKR.toLocaleString()} ready upon delivery.`
        : `I've generated a secure checkout link for **${checkoutLink.productTitle}**. Please complete the payment within 60 minutes.`;
    }

    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: confirmContent,
        thoughtProcess: JSON.stringify({
          intent: "product",
          steps: [{ step: "create_order", status: "completed", content: `Created ${isCOD ? "COD" : "card"} payment order.`, durationMs: 0 }],
          checkoutLinks: isCOD ? undefined : [checkoutLink],
        }),
      },
    });

    // Optionally save the order in database for registered users
    if (userId && userId !== "guest") {
      try {
        const userExists = await prisma.user.findUnique({ where: { id: userId } });
        if (userExists) {
          const orderItemsData = items && items.length > 0
            ? items.map((i: any) => ({
                productId: i.productId,
                productName: i.productName || "Kapruka Product",
                quantity: i.quantity,
                priceLKR: i.priceLKR || 0,
                imageUrl: i.imageUrl || null,
              }))
            : [
                {
                  productId,
                  productName: checkoutLink.productTitle,
                  quantity,
                  priceLKR: priceLKR || 0,
                  imageUrl: imageUrl || null,
                },
              ];

          await prisma.order.create({
            data: {
              id: orderResult.orderId || `ord-${Date.now()}`,
              userId,
              status: "pending",
              totalLKR: orderResult.totalLKR || checkoutLink.priceLKR,
              items: {
                create: orderItemsData,
              },
            },
          });

          // Sync address to user profile if it's a new delivery address
          const currentAddresses = userExists.addresses && Array.isArray(userExists.addresses)
            ? (userExists.addresses as any[])
            : [];

          const alreadySaved = currentAddresses.some((addrObj: any) => {
            const line = (addrObj.addressLine || addrObj.address || "").trim().toLowerCase();
            const c = (addrObj.city || "").trim().toLowerCase();
            return line === address.trim().toLowerCase() && c === city.trim().toLowerCase();
          });

          if (!alreadySaved) {
            const newSavedAddress = {
              id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              type: "custom",
              label: `Checkout ${city.trim()}`,
              recipientName: name.trim(),
              phone: phone.trim(),
              addressLine: address.trim(),
              city: city.trim(),
              isDefault: currentAddresses.length === 0,
            };

            await prisma.user.update({
              where: { id: userId },
              data: {
                addresses: [...currentAddresses, newSavedAddress],
              },
            });
          }
        }
      } catch (dbErr) {
        console.warn("Failed to log order or sync address in local database:", dbErr);
      }
    }

    // Clear user global cart on successful checkout completion
    if (userId) {
      try {
        await (prisma.user as any).update({
          where: { id: userId },
          data: { cart: [] }
        }).catch(() => {});
      } catch {}
    }

    return NextResponse.json({
      success: true,
      orderResult,
      checkoutLink,
    });
  } catch (error: any) {
    console.error("Failed to process order API request:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
