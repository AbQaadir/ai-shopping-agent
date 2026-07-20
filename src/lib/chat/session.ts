import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { clearCheckoutState, saveCheckoutState } from "@/lib/checkoutContext";
import { CartItem, UserAddress, InlineProduct } from "@/types/sourcing";
import { KaprukaProduct } from "@/lib/tools";

export async function getOrCreateSession(sessionId: string, userId: string | undefined, messageTitle: string) {
  let session = await prisma.chatSession.findUnique({ where: { id: sessionId } });

  if (session && session.userId && session.userId !== userId) {
    throw new Error("Forbidden: You do not have permission to send messages to this shared chat.");
  }

  if (!session) {
    if (userId && userId !== "guest") {
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

    session = await prisma.chatSession.create({
      data: {
        id: sessionId,
        title: messageTitle.substring(0, 60) || "New Chat",
        status: "active",
        userId: userId && userId !== "guest" ? userId : null,
      },
    });
  }

  return session;
}

export async function handleEditMessageRollback(
  editMessageId: string,
  message: string,
  sessionId: string,
  userId: string | undefined,
  fetchedSelectedProducts: KaprukaProduct[]
) {
  const targetMessage = await prisma.chatMessage.findUnique({
    where: { id: editMessageId },
  });
  if (!targetMessage) {
    throw new Error("Message to edit not found");
  }

  // Update target user message content
  await prisma.chatMessage.update({
    where: { id: editMessageId },
    data: {
      content: message,
      products: fetchedSelectedProducts.length > 0 ? (fetchedSelectedProducts as any) : Prisma.DbNull,
      thoughtProcess: Prisma.DbNull,
    },
  });

  // Delete subsequent messages
  await prisma.chatMessage.deleteMany({
    where: {
      sessionId,
      createdAt: { gt: targetMessage.createdAt },
    },
  });

  // Rollback CheckoutSession and user cart to the last remaining assistant message's state
  const lastAssistantMsg = await prisma.chatMessage.findFirst({
    where: {
      sessionId,
      role: "assistant",
      createdAt: { lt: targetMessage.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  let orderFlowStep: any = null;
  if (lastAssistantMsg?.thoughtProcess) {
    try {
      const parsed = typeof lastAssistantMsg.thoughtProcess === "string"
        ? JSON.parse(lastAssistantMsg.thoughtProcess)
        : lastAssistantMsg.thoughtProcess;
      orderFlowStep = (parsed as any)?.orderFlowStep;
    } catch (e) {
      console.error("Error parsing thoughtProcess for rollback:", e);
    }
  }

  if (orderFlowStep && orderFlowStep.phase !== "confirmed" && orderFlowStep.phase !== "cancelled") {
    // Restore CheckoutSession
    await saveCheckoutState(sessionId, {
      phase: orderFlowStep.phase,
      cartItems: orderFlowStep.cartItems || [],
      product: orderFlowStep.product,
      confirmedQty: orderFlowStep.confirmedQuantity,
      confirmedAddress: orderFlowStep.confirmedAddress,
      savedAddress: orderFlowStep.savedAddress,
      geocodedLocation: orderFlowStep.geocodedLocation,
      paymentMethod: orderFlowStep.paymentMethod,
      deliveryDate: orderFlowStep.deliveryDate,
      personalMessage: orderFlowStep.personalMessage,
      deliveryFeeLKR: orderFlowStep.deliveryCheckResult?.flatRateLKR ?? orderFlowStep.deliveryFeeLKR,
    });

    // Synchronize user cart in DB
    const currentUserId = userId || "guest";
    try {
      const userRecord = await prisma.user.findUnique({ where: { id: currentUserId } });
      let cartObj: Record<string, CartItem[]> = {};
      if (userRecord?.cart) {
        const parsed = typeof userRecord.cart === "string" ? JSON.parse(userRecord.cart) : userRecord.cart;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          cartObj = parsed as Record<string, CartItem[]>;
        }
      }
      cartObj[sessionId] = orderFlowStep.cartItems || [];
      await prisma.user.update({
        where: { id: currentUserId },
        data: { cart: JSON.parse(JSON.stringify(cartObj)) },
      });
    } catch (err) {
      console.warn("Failed to sync cart during rollback:", err);
    }
  } else {
    // No prior checkout or it was finished -> clear checkout state
    await clearCheckoutState(sessionId);
  }
}

export async function saveUserMessage(
  sessionId: string,
  message: string,
  fetchedSelectedProducts: KaprukaProduct[]
) {
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: message,
      products: fetchedSelectedProducts.length > 0 ? (fetchedSelectedProducts as any) : undefined,
    },
  });
}

export async function loadUserCart(sessionId: string, userId: string | undefined): Promise<CartItem[]> {
  const currentUserId = userId || "guest";
  try {
    const userWithCart = await prisma.user.findUnique({
      where: { id: currentUserId },
    });
    if (!userWithCart?.cart) return [];
    const cartObj =
      typeof userWithCart.cart === "string"
        ? JSON.parse(userWithCart.cart as string)
        : (userWithCart.cart as unknown as Record<string, CartItem[]>);
    if (cartObj && typeof cartObj === "object" && !Array.isArray(cartObj)) {
      return cartObj[sessionId] || [];
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveUserCart(sessionId: string, userId: string | undefined, cartItems: CartItem[]) {
  const currentUserId = userId || "guest";
  try {
    const userWithCart = await prisma.user.findUnique({
      where: { id: currentUserId },
    });
    let cartObj: Record<string, CartItem[]> = {};
    if (userWithCart?.cart) {
      const parsed =
        typeof userWithCart.cart === "string"
          ? JSON.parse(userWithCart.cart as string)
          : userWithCart.cart;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        cartObj = parsed as Record<string, CartItem[]>;
      }
    }
    cartObj[sessionId] = cartItems;
    await (prisma.user as any).update({
      where: { id: currentUserId },
      data: { cart: JSON.parse(JSON.stringify(cartObj)) },
    });
  } catch (err) {
    console.error("[saveUserCart] failed:", err);
  }
}

export async function fetchUserAddresses(userId: string | undefined): Promise<UserAddress[]> {
  let allUserAddresses: UserAddress[] = [];
  if (userId && userId !== "guest") {
    try {
      const userWithAddresses = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (userWithAddresses?.addresses && Array.isArray(userWithAddresses.addresses)) {
        allUserAddresses = userWithAddresses.addresses as unknown as UserAddress[];
      }
    } catch (err) {
      console.warn("Failed to load user addresses for context:", err);
    }
  }
  return allUserAddresses;
}

export async function getAvailableProducts(sessionId: string, fetchedSelectedProducts: KaprukaProduct[]): Promise<InlineProduct[]> {
  let availableProducts: InlineProduct[] = [];
  try {
    const msgs = await prisma.chatMessage.findMany({
      where: {
        sessionId,
        role: "assistant",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const lastAssistantMsg = msgs.find((m) => m.products !== null && m.products !== undefined);
    if (lastAssistantMsg?.products) {
      const parsed = typeof lastAssistantMsg.products === "string"
        ? JSON.parse(lastAssistantMsg.products)
        : lastAssistantMsg.products;
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && "products" in parsed[0]) {
          // Product groups structure
          availableProducts = parsed.flatMap((g: any) => g.products || []);
        } else {
          // Flat products array structure
          availableProducts = parsed;
        }
      }
    }
  } catch (err) {
    console.error("[route.ts] failed to fetch last assistant products:", err);
  }

  // Combine with any fetched selected products from request body
  if (fetchedSelectedProducts.length > 0) {
    for (const fp of fetchedSelectedProducts) {
      (fp as any).isExplicitlySelected = true;
      const existing = availableProducts.find(
        (ap) => String(ap.id).trim().toLowerCase() === String(fp.id).trim().toLowerCase()
      );
      if (existing) {
        existing.isExplicitlySelected = true;
      } else {
        availableProducts.push(fp as unknown as InlineProduct);
      }
    }
  }
  return availableProducts;
}
