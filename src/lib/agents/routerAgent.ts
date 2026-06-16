/**
 * Router Agent
 *
 * The orchestrator of the entire chat system. Given the user's message and
 * the full current context (checkout state, conversation history, classified
 * intent), this agent decides WHAT TO DO — entirely via LLM reasoning,
 * with no regex.
 *
 * Replaces ALL of the following regex intercepts in the old route.ts:
 *   - isCancelQuery
 *   - isAddToCartQuery
 *   - isCheckoutQuery / isCheckoutCommand
 *   - isUserDeviating
 *   - activePhase checks
 */

import { GoogleGenAI } from "@google/genai";
import type { CheckoutState } from "@/lib/checkoutContext";

export type RouterAction =
  | "shop"              // No active checkout — route to product/delivery/service/qa
  | "checkout_start"   // User initiated a new checkout ("order this", "checkout cart")
  | "checkout_continue" // User is directly responding to the current checkout phase
  | "checkout_pause"   // User wants something else while checkout is active (search, Q&A, etc.)
  | "cart_modify"      // User wants to change the cart (remove item, change qty)
  | "checkout_cancel"; // User explicitly wants to cancel and clear

export interface RouterDecision {
  action: RouterAction;
  reason: string;
}

function buildCheckoutStateBlock(checkoutState: CheckoutState | null): string {
  if (!checkoutState) {
    return "NO ACTIVE CHECKOUT — user has not started any checkout process.";
  }

  const cartStr = (checkoutState.cartItems ?? [])
    .map((i) => `  • ${i.quantity}x ${i.name} — Rs. ${i.price.toLocaleString()}`)
    .join("\n") || "  (empty)";

  const phaseDescriptions: Record<string, string> = {
    qty_ask: "Waiting for user to confirm quantities",
    delivery_ask: "Waiting for user to choose delivery address (saved vs. new)",
    address_ask: "Waiting for user to type a rough location or landmark",
    map_open: "Map is open — waiting for user to confirm pin location",
    payment_ask: "Waiting for user to choose payment method (COD or card)",
    confirmed: "Order was just placed",
    cancelled: "Checkout was cancelled",
  };

  return `ACTIVE CHECKOUT:
  Phase: "${checkoutState.phase}" — ${phaseDescriptions[checkoutState.phase] ?? "unknown"}
  Cart:
${cartStr}
  Confirmed Qty: ${checkoutState.confirmedQty ?? "not yet"}
  Saved Address: ${checkoutState.savedAddress ? `${checkoutState.savedAddress.address}, ${checkoutState.savedAddress.city}` : "none"}
  Confirmed Address: ${checkoutState.confirmedAddress ? `${checkoutState.confirmedAddress.address}, ${checkoutState.confirmedAddress.city}` : "not yet set"}
  Payment: ${checkoutState.paymentMethod ?? "not yet chosen"}`;
}

export async function routerAgent(
  message: string,
  historySnippet: string,
  checkoutState: CheckoutState | null,
  intent: string,
  ai: GoogleGenAI,
  fastModel: string
): Promise<RouterDecision> {
  // ── Hardcoded shortcuts (obvious cases, no LLM needed) ─────────────────────
  // These are unambiguous UI-generated messages — always correct.
  if (/^confirm location:/i.test(message.trim())) {
    return { action: "checkout_continue", reason: "UI-generated map pin confirmation" };
  }
  if (/^(checkout cart|order selected)$/i.test(message.trim())) {
    return { action: "checkout_start", reason: "Explicit checkout trigger from UI button" };
  }

  const stateBlock = buildCheckoutStateBlock(checkoutState);
  const hasActiveCheckout = checkoutState !== null;

  const prompt = `You are the orchestrator for Kapuruka, a Sri Lankan e-commerce shopping agent.

Your ONLY job is to decide what action to take for the user's message given the full context below.

═══ CURRENT STATE ═══
${stateBlock}

═══ RECENT CONVERSATION (last messages, newest last) ═══
${historySnippet}

═══ CLASSIFIED INTENT ═══
AI classified intent: "${intent}"
(This is a hint from the keyword/LLM classifier — use it to confirm "shop" decisions)

═══ USER MESSAGE ═══
"${message}"

═══ AVAILABLE ACTIONS ═══

"shop"
→ Use when: NO active checkout AND user wants to search, browse, compare, ask about products, check delivery, use services, or general Q&A.
→ Examples: "show me birthday cakes", "can you deliver to Kandy?", "what's the return policy?", "compare those two phones"

"checkout_start"
→ Use when: User explicitly wants to BEGIN a new checkout process from scratch.
→ Examples: "order this", "I want to buy this", "place the order", "proceed to checkout"
→ Do NOT use if checkout is already active (use cart_modify if they want to add/remove items from the active checkout, or checkout_continue to proceed with checkout)

"checkout_continue"
→ Use ONLY when: An ACTIVE CHECKOUT exists AND the user's message is a DIRECT, sensible answer to the CURRENT PHASE QUESTION.
→ Phase-specific signals:
    qty_ask: User confirms quantities. "looks good", "confirm", "yes proceed", "change to 2" = continue.
    delivery_ask: User chooses between saved address or new. "yes saved", "use my address", "new address", "different place" = continue.
    address_ask: User provides ANY location text at all. The entire message is the address. Always = continue.
    map_open: UI sends "Confirm location: ..." message. Always = continue.
    payment_ask: User says cash/cod or card/online. "cash on delivery", "card please", "cod" = continue.
→ CRITICAL RULE: If the message is a QUESTION, a SEARCH REQUEST, a comparison, or about something DIFFERENT from the current phase — it is NOT checkout_continue.
→ CRITICAL RULE: "yes" or "no" alone are ambiguous. Check if they make sense for the CURRENT PHASE. If not, use checkout_pause.

"checkout_pause"
→ Use when: Active checkout exists BUT the user wants to do something UNRELATED to the current phase (like searching, comparison, platform QA, or asking details about products they want to see first).
→ Examples (REGARDLESS of phase):
    "compare these items" → pause, answer
    "show me some flowers" → pause, search
    "tell me more about the cake" → pause, answer
    "what is the return policy?" → pause, answer Q&A
    "can you deliver to Galle?" → pause, check delivery
    "actually wait, can I see more options?" → pause, search
    "how much is the shipping?" → pause, answer
→ The checkout session stays ALIVE — it is not cancelled.
→ When in doubt between checkout_continue and checkout_pause: ALWAYS choose checkout_pause.

"cart_modify"
→ Use when: User wants to change the cart contents (remove an item, change a quantity, or add products they have selected or just viewed/discussed in the chat).
→ Examples:
    "remove the shoes from cart"
    "delete the second item"
    "change the cake quantity to 2"
    "add the first flower bouquet to my order"
    "please add all of those to the order"
    "add the cake to my cart"

"checkout_cancel"
→ Use when: User EXPLICITLY wants to STOP and CLEAR everything. Clear language required.
→ Examples: "cancel this", "clear the cart", "never mind, start over", "I don't want anything", "empty cart"
→ Do NOT use for "no" alone — that's usually checkout_pause or checkout_continue

═══ DECISION RULES ═══
1. If no active checkout → "shop" or "checkout_start" only
2. If active checkout + message fits current phase question → "checkout_continue"
3. If active checkout + message is about something else → "checkout_pause"
4. If active checkout + user wants cart change → "cart_modify"
5. If active checkout + clear cancellation language → "checkout_cancel"
6. When uncertain between checkout_continue and checkout_pause → ALWAYS use "checkout_pause"

Respond ONLY as valid JSON:
{"action": "<action>", "reason": "<one sentence explanation>"}`;

  try {
    const result = await ai.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING" },
            reason: { type: "STRING" },
          },
          required: ["action", "reason"],
        },
      },
    });

    const raw = (result.text || "{}").trim();
    const parsed = JSON.parse(raw);
    const action = parsed.action as RouterAction;
    const validActions: RouterAction[] = [
      "shop", "checkout_start", "checkout_continue",
      "checkout_pause", "cart_modify", "checkout_cancel",
    ];

    if (!validActions.includes(action)) {
      console.warn(`[RouterAgent] Invalid action "${action}" — defaulting to ${hasActiveCheckout ? "checkout_pause" : "shop"}`);
      return {
        action: hasActiveCheckout ? "checkout_pause" : "shop",
        reason: "Invalid action returned by LLM, safe fallback applied",
      };
    }

    // Safety: checkout_continue requires active checkout
    if (action === "checkout_continue" && !hasActiveCheckout) {
      return { action: "shop", reason: "checkout_continue requested but no active checkout — routed to shop" };
    }

    console.log(`[RouterAgent] "${message.substring(0, 60)}" → ${action} (${parsed.reason})`);
    return { action, reason: parsed.reason };
  } catch (err) {
    console.error("[RouterAgent] LLM call failed:", (err as Error).message);
    // Safe fallback: pause if checkout active, otherwise shop
    return {
      action: hasActiveCheckout ? "checkout_pause" : "shop",
      reason: "LLM error — safe fallback applied",
    };
  }
}
