/**
 * Checkout Context Manager
 *
 * Provides a clean 3-function interface over the CheckoutSession Prisma model.
 * This is the SINGLE SOURCE OF TRUTH for any active checkout in a chat session.
 *
 * Replaces the old pattern of walking backwards through ChatMessage.thoughtProcess
 * JSON blobs to reconstruct order phase state.
 */

import { prisma } from "@/lib/db";
import type { CartItem, InlineProduct, SavedAddress, GeocodedLocation } from "@/types/sourcing";

export type CheckoutPhase =
  | "qty_ask"
  | "delivery_ask"
  | "new_address_form"   // replaces address_ask — combined form rendered by NewAddressFormBubble
  | "address_ask"        // LEGACY: kept for backward compat with old sessions in DB
  | "map_open"           // LEGACY: kept for backward compat with old sessions in DB
  | "delivery_date_ask" // NEW: user picks delivery date + optional personal/gift message
  | "payment_ask"
  | "confirmed"
  | "cancelled";

export interface CheckoutState {
  phase: CheckoutPhase;

  // Cart items — always the live set for this session
  cartItems: CartItem[];

  // Single-product checkout (when user says "order this" on a single product)
  product?: InlineProduct;

  // Accumulated as user progresses through phases
  confirmedQty?: number;
  confirmedAddress?: SavedAddress;
  savedAddress?: SavedAddress;     // user's default saved address
  geocodedLocation?: GeocodedLocation;
  paymentMethod?: "cod" | "card";
  deliveryDate?: string;           // YYYY-MM-DD chosen by user in delivery_date_ask phase
  personalMessage?: string;        // optional gift/personal message passed to kapruka_create_order
  deliveryFeeLKR?: number;         // flat rate delivery fee returned by kapruka_check_delivery
}

/** Load the active checkout state for a chat session. Returns null if none. */
export async function getCheckoutState(chatSessionId: string): Promise<CheckoutState | null> {
  try {
    const row = await (prisma as any).checkoutSession.findUnique({
      where: { chatSessionId },
    });

    if (!row) return null;

    return {
      phase: row.phase as CheckoutPhase,
      cartItems: Array.isArray(row.cartItems) ? row.cartItems : [],
      product: row.product ?? undefined,
      confirmedQty: row.confirmedQty ?? undefined,
      confirmedAddress: row.confirmedAddress ?? undefined,
      savedAddress: row.savedAddress ?? undefined,
      geocodedLocation: row.geocodedLocation ?? undefined,
      paymentMethod: (row.paymentMethod as "cod" | "card") ?? undefined,
      deliveryDate: row.deliveryDate ?? undefined,
      personalMessage: row.personalMessage ?? undefined,
      deliveryFeeLKR: row.deliveryFeeLKR ?? undefined,
    };
  } catch (err) {
    console.error("[CheckoutContext] getCheckoutState failed:", err);
    return null;
  }
}

/** Create or update the checkout state for a chat session. */
export async function saveCheckoutState(
  chatSessionId: string,
  state: CheckoutState
): Promise<void> {
  try {
    await (prisma as any).checkoutSession.upsert({
      where: { chatSessionId },
      update: {
        phase: state.phase,
        cartItems: state.cartItems,
        product: state.product ?? null,
        confirmedQty: state.confirmedQty ?? null,
        confirmedAddress: state.confirmedAddress ?? null,
        savedAddress: state.savedAddress ?? null,
        geocodedLocation: state.geocodedLocation ?? null,
        paymentMethod: state.paymentMethod ?? null,
        deliveryDate: state.deliveryDate ?? null,
        personalMessage: state.personalMessage ?? null,
        deliveryFeeLKR: state.deliveryFeeLKR ?? null,
      },
      create: {
        chatSessionId,
        phase: state.phase,
        cartItems: state.cartItems,
        product: state.product ?? null,
        confirmedQty: state.confirmedQty ?? null,
        confirmedAddress: state.confirmedAddress ?? null,
        savedAddress: state.savedAddress ?? null,
        geocodedLocation: state.geocodedLocation ?? null,
        paymentMethod: state.paymentMethod ?? null,
        deliveryDate: state.deliveryDate ?? null,
        personalMessage: state.personalMessage ?? null,
        deliveryFeeLKR: state.deliveryFeeLKR ?? null,
      },
    });
  } catch (err) {
    console.error("[CheckoutContext] saveCheckoutState failed:", err);
  }
}

/** Delete the checkout session (on order confirmed or checkout cancelled). */
export async function clearCheckoutState(chatSessionId: string): Promise<void> {
  try {
    await (prisma as any).checkoutSession.deleteMany({
      where: { chatSessionId },
    });
  } catch (err) {
    console.error("[CheckoutContext] clearCheckoutState failed:", err);
  }
}
