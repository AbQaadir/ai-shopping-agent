import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pillar1_createOrderLink } from "@/lib/tools";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      productId,
      quantity,
      recipient,
      sessionId,
      userId,
      productTitle,
      priceLKR,
      imageUrl,
      paymentMethod, // "cod" | "card"
    } = body;

    if (!productId || !quantity || !recipient || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: productId, quantity, recipient, sessionId" },
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

    // Call MCP tool to create order link
    const orderResult = await pillar1_createOrderLink(productId, quantity, {
      name,
      phone,
      address,
      city,
    });

    if (!orderResult) {
      return NextResponse.json(
        { error: "Failed to create order link via Kapruka MCP" },
        { status: 500 }
      );
    }

    // Prepare checkout link structure
    const checkoutLink = {
      productId,
      productTitle: productTitle || "Kapruka Product",
      priceLKR: priceLKR || orderResult.totalLKR || 0,
      checkoutUrl: orderResult.checkoutUrl,
      expiresAt: orderResult.expiresAt,
    };

    // Save checkoutLink card message in ChatMessage database
    const isCOD = paymentMethod === "cod";
    const confirmContent = isCOD
      ? `Your **Cash on Delivery** order for **${checkoutLink.productTitle}** has been placed! 🎉 Our courier will deliver it to ${recipient?.city || "your address"}. Please have Rs. ${checkoutLink.priceLKR.toLocaleString()} ready upon delivery.`
      : `I've generated a secure checkout link for **${checkoutLink.productTitle}**. Please complete the payment within 60 minutes.`;

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
          await prisma.order.create({
            data: {
              id: orderResult.orderId || `ord-${Date.now()}`,
              userId,
              status: "pending",
              totalLKR: orderResult.totalLKR || (priceLKR || 0) * quantity,
              items: {
                create: {
                  productId,
                  productName: checkoutLink.productTitle,
                  quantity,
                  priceLKR: priceLKR || 0,
                  imageUrl: imageUrl || null,
                },
              },
            },
          });
        }
      } catch (dbErr) {
        console.warn("Failed to log order in local database:", dbErr);
      }
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
