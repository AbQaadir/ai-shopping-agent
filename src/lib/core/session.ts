/**
 * session.ts
 * ---------------------------------------------------------------------------
 * Phase 1 — Extraction & Cleanup
 *
 * Session and message management extracted from the route.ts monolith.
 * All DB interactions related to ChatSession and ChatMessage live here.
 * ---------------------------------------------------------------------------
 */

import { prisma } from "@/lib/db";
import {
  saveCheckoutState,
  clearCheckoutState,
  type CheckoutState,
} from "@/lib/checkoutContext";
import { parseThoughtProcess, serializeThoughtProcess, type ThoughtProcess } from "@/lib/core/thoughtProcess";
import type { KaprukaProduct } from "@/lib/tools";
import { Prisma } from "@prisma/client";
import type { ChatSession, ChatMessage } from "@prisma/client";
import { updateConversationGoal } from "./context";

// ── Types ──────────────────────────────────────────────────────────────────

/** ProductGroup is used when the assistant saves category-browse results. */
export interface ProductGroup {
  title: string;
  products: KaprukaProduct[];
}

// ── Function 1: ensureSession ──────────────────────────────────────────────

/**
 * Ensure a ChatSession exists for the given sessionId.
 * - Upserts the User if `userId` is set and not "guest".
 * - Creates the ChatSession if it doesn't exist yet.
 * - Throws an error (with `statusCode: 403`) if the session belongs to a
 *   different user (ownership check).
 *
 * Extracted from route.ts lines 107–139.
 */
export async function ensureSession(
  sessionId: string,
  userId: string | undefined,
  firstMessage: string
): Promise<{ session: ChatSession; isNew: boolean }> {
  let session = await prisma.chatSession.findUnique({ where: { id: sessionId } });

  // Strict Ownership Check
  if (session && session.userId && session.userId !== userId) {
    const err = new Error(
      "Forbidden: You do not have permission to send messages to this shared chat."
    );
    (err as any).statusCode = 403;
    throw err;
  }

  if (session) {
    return { session, isNew: false };
  }

  // Upsert user record for non-guest sessions
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
      title: firstMessage.substring(0, 60) || "New Chat",
      status: "active",
      userId: userId && userId !== "guest" ? userId : null,
    },
  });

  return { session, isNew: true };
}

// ── Function 2: saveUserMessage ────────────────────────────────────────────

/**
 * Insert a user ChatMessage into the database.
 *
 * Extracted from route.ts lines 246–253.
 */
export async function saveUserMessage(
  sessionId: string,
  content: string,
  products?: KaprukaProduct[]
): Promise<ChatMessage> {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content,
      products: products && products.length > 0 ? (products as any) : undefined,
    },
  });
}

// ── Function 3: rollbackToMessage ──────────────────────────────────────────

/**
 * Roll the conversation back to a specific user message.
 *
 * Steps:
 *  1. Update the target message content (and optional products).
 *  2. Delete all messages that came after it.
 *  3. Find the last assistant message before the target and read its
 *     `orderFlowStep` from `thoughtProcess` (Phase 0 typed parse).
 *  4. Restore the CheckoutSession from that state, or clear it if none.
 *  5. Re-sync `User.cart[sessionId]` using an atomic $transaction.
 *
 * Returns `{ restored: true, checkoutState }` when a checkout was restored,
 * or `{ restored: false, checkoutState: null }` when cleared.
 *
 * Extracted from route.ts lines 156–243.
 */
export async function rollbackToMessage(
  editMessageId: string,
  sessionId: string,
  userId: string | undefined,
  products?: KaprukaProduct[]
): Promise<{ restored: boolean; checkoutState: CheckoutState | null }> {
  const targetMessage = await prisma.chatMessage.findUnique({
    where: { id: editMessageId },
  });

  if (!targetMessage) {
    const err = new Error("Message to edit not found");
    (err as any).statusCode = 404;
    throw err;
  }

  // Update target user message content
  await prisma.chatMessage.update({
    where: { id: editMessageId },
    data: {
      products: products && products.length > 0 ? (products as any) : Prisma.DbNull,
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

  // Find the last assistant message before the target
  const lastAssistantMsg = await prisma.chatMessage.findFirst({
    where: {
      sessionId,
      role: "assistant",
      createdAt: { lt: targetMessage.createdAt },
    },
    orderBy: { createdAt: "desc" },
  });

  // Phase 0: Use typed parseThoughtProcess instead of raw any-cast
  let orderFlowStep: (ReturnType<typeof parseThoughtProcess> extends infer T
    ? T extends { orderFlowStep?: infer S }
      ? S
      : never
    : never) | null = null as any;

  if (lastAssistantMsg?.thoughtProcess) {
    const parsed = parseThoughtProcess(lastAssistantMsg.thoughtProcess);
    orderFlowStep = parsed?.orderFlowStep ?? null;
  }

  if (
    orderFlowStep &&
    (orderFlowStep as any).phase !== "confirmed" &&
    (orderFlowStep as any).phase !== "cancelled"
  ) {
    const ofs = orderFlowStep as any;

    // Restore CheckoutSession
    await saveCheckoutState(sessionId, {
      phase: ofs.phase,
      cartItems: ofs.cartItems || [],
      product: ofs.product,
      confirmedQty: ofs.confirmedQuantity,
      confirmedAddress: ofs.confirmedAddress,
      savedAddress: ofs.savedAddress,
      geocodedLocation: ofs.geocodedLocation,
      paymentMethod: ofs.paymentMethod,
      deliveryDate: ofs.deliveryDate,
      personalMessage: ofs.personalMessage,
      deliveryFeeLKR: ofs.deliveryCheckResult?.flatRateLKR ?? ofs.deliveryFeeLKR,
    });

    // Synchronize user cart in DB
    // Phase 0: Wrapped in $transaction to prevent concurrent write race conditions
    const currentUserId = userId || "guest";
    try {
      await prisma.$transaction(async (tx) => {
        const userRecord = await (tx.user as any).findUnique({
          where: { id: currentUserId },
        });
        let cartObj: Record<string, any[]> = {};
        if (userRecord?.cart) {
          const parsed =
            typeof userRecord.cart === "string"
              ? JSON.parse(userRecord.cart)
              : userRecord.cart;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            cartObj = parsed as Record<string, any[]>;
          }
        }
        cartObj[sessionId] = ofs.cartItems || [];
        await (tx.user as any).update({
          where: { id: currentUserId },
          data: { cart: cartObj },
        });
      });
    } catch (err) {
      console.warn("Failed to sync cart during rollback:", err);
    }

    return {
      restored: true,
      checkoutState: {
        phase: ofs.phase,
        cartItems: ofs.cartItems || [],
        product: ofs.product,
        confirmedQty: ofs.confirmedQuantity,
        confirmedAddress: ofs.confirmedAddress,
        savedAddress: ofs.savedAddress,
        geocodedLocation: ofs.geocodedLocation,
        paymentMethod: ofs.paymentMethod,
        deliveryDate: ofs.deliveryDate,
        personalMessage: ofs.personalMessage,
        deliveryFeeLKR: ofs.deliveryCheckResult?.flatRateLKR ?? ofs.deliveryFeeLKR,
      },
    };
  } else {
    // No prior checkout or it was finished → clear checkout state
    await clearCheckoutState(sessionId);
    return { restored: false, checkoutState: null };
  }
}

// ── Function 4: getConversationHistory ────────────────────────────────────

/**
 * Fetch all messages for a session, ordered oldest-first.
 *
 * Extracted from route.ts lines 257–260.
 */
export async function getConversationHistory(
  sessionId: string,
  limit?: number
): Promise<ChatMessage[]> {
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
}

// ── Function 5: saveAssistantMessage ──────────────────────────────────────

/**
 * Insert an assistant ChatMessage into the database and update goal tracking.
 *
 * Extracted from route.ts lines ~2350–2424.
 */
export async function saveAssistantMessage(
  sessionId: string,
  content: string,
  thoughtProcess: ThoughtProcess,
  products?: KaprukaProduct[] | ProductGroup[]
): Promise<ChatMessage> {
  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content,
      thoughtProcess: serializeThoughtProcess(thoughtProcess) as any,
      products: products && products.length > 0 ? (products as any) : undefined,
    },
  });

  if (thoughtProcess.intent) {
    await updateConversationGoal(sessionId, {
      primaryIntent: thoughtProcess.intent,
      completedSteps: [
        `Executed intent: ${thoughtProcess.intent}`,
      ],
    });
  }

  return message;
}
