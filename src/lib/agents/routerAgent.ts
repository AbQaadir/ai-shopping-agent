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
  | "shop"                        // No active checkout — route to product/delivery/service/qa
  | "checkout_start"              // User initiated a new checkout ("order this", "checkout cart")
  | "checkout_start_with_address" // Fast-checkout: order + address label in same message
  | "checkout_continue"           // User is directly responding to the current checkout phase
  | "checkout_pause"              // User wants something else while checkout is active (search, Q&A, etc.)
  | "cart_modify"                 // User wants to change the cart (remove item, change qty)
  | "checkout_cancel";            // User explicitly wants to cancel and clear

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
    delivery_ask: "Waiting for user to choose delivery address (from saved addresses or new)",
    new_address_form: "New address form is open — user is filling in name, phone, and location",
    address_ask: "LEGACY: Waiting for user to type a rough location or landmark",
    map_open: "LEGACY: Map is open — waiting for user to confirm pin location",
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
  fastModel: string,
  savedAddressLabels?: string[], // e.g. ["Home", "Work", "Parents Place"]
  availableProducts?: any[]
): Promise<RouterDecision> {
  // ── Hardcoded shortcuts (obvious cases, no LLM needed) ─────────────────────
  // These are unambiguous UI-generated messages — always correct.
  if (/^confirm location:/i.test(message.trim())) {
    return { action: "checkout_continue", reason: "UI-generated map pin confirmation" };
  }
  // "Use address: <id>" is sent when user clicks a saved address card in the delivery_ask bubble.
  if (/^use address:/i.test(message.trim())) {
    return { action: "checkout_continue", reason: "UI-generated saved address selection" };
  }
  // "New address confirmed: ..." is sent when user confirms the new address form.
  if (/^new address confirmed:/i.test(message.trim())) {
    return { action: "checkout_continue", reason: "UI-generated new address confirmation" };
  }
  // "checkout cart" is sent by handleBuyProduct and handleOrderCart (after silently adding to cart).
  if (/^checkout cart$/i.test(message.trim())) {
    return { action: "checkout_start", reason: "Explicit checkout trigger from Order button" };
  }
  // "continue checkout" is sent by the Resume Checkout UI button.
  if (/^continue checkout$/i.test(message.trim())) {
    return { action: "checkout_continue", reason: "UI-generated resume checkout confirmation" };
  }
  // "Confirm quantities" is sent by the cart checkout UI.
  if (/^confirm quantities$/i.test(message.trim())) {
    return { action: "checkout_continue", reason: "UI-generated cart quantity confirmation" };
  }
  // "I'd like to order X units" is sent by the single product checkout UI.
  if (/^I'd like to order \d+ unit/i.test(message.trim())) {
    return { action: "checkout_continue", reason: "UI-generated single item quantity confirmation" };
  }

  const stateBlock = buildCheckoutStateBlock(checkoutState);
  const hasActiveCheckout = checkoutState !== null;
  const addressLabelsBlock = savedAddressLabels && savedAddressLabels.length > 0
    ? `Saved Address Labels: [${savedAddressLabels.map(l => `"${l}"`).join(", ")}]`
    : "Saved Address Labels: (none — user has no saved addresses)";

  const availableListStr = availableProducts && availableProducts.length > 0
    ? (availableProducts || [])
        .map((item, i) => `  ${i + 1}. ID: "${item.id}", Name: "${item.name}", Price: Rs. ${item.price?.toLocaleString()}`)
        .join("\n")
    : "  (none)";

  const prompt = `You are the orchestrator for Kapruka, a Sri Lankan e-commerce shopping agent.

Your ONLY job is to decide what action to take for the user's message given the full context below.

═══ CURRENT STATE ═══
${stateBlock}
${addressLabelsBlock}
AVAILABLE/REFERENCED PRODUCTS (recently viewed/selected in the chat):
${availableListStr}

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
→ Use when: User explicitly wants to BEGIN a new checkout process from scratch, with NO address mention.
→ Examples: "order this", "I want to buy this", "place the order", "proceed to checkout", "place this"
→ Do NOT use if checkout is already active.
→ CRITICAL RULE: If there are MULTIPLE available/referenced products and the user says "order this", "place this", or similar (even using singular "this"), ASSUME they want to order ALL of them. Do NOT use "shop" to ask them to pick one. Route to "checkout_start".

"checkout_start_with_address"
→ Use when: User explicitly wants to order AND mentions a delivery destination by name IN THE SAME MESSAGE. Verbs like "place", "send", "ship", or "deliver" to a destination ARE strong order intents.
→ The destination must match or closely resemble one of the Saved Address Labels shown above.
→ Examples: "order this and deliver to my home", "buy this and send to work", "order to my parents place", "place this to my home", "send this to work"
→ Do NOT use if no saved addresses exist. Do NOT use if the destination is unclear or generic ("my house", "my place" without a matching label).
→ CRITICAL RULE: If there are MULTIPLE available/referenced products and the user says "deliver this to my home", "place this to my home", or similar (even using singular "this"), ASSUME they want to order ALL of them. Do NOT use "shop" to ask them to pick one. Even if the hint says "product", override it. Route to "checkout_start_with_address".

"checkout_continue"
→ Use ONLY when: An ACTIVE CHECKOUT exists AND the user's message is a DIRECT, sensible answer to the CURRENT PHASE QUESTION.
→ Phase-specific signals:
    qty_ask: User confirms quantities. "looks good", "confirm", "yes proceed" = continue. (DO NOT use for quantity changes).
    delivery_ask: User chooses between saved address or new. "yes saved", "use my address", "new address", "different place" = continue.
    new_address_form: User fills in the new address form. Any response = continue.
    payment_ask: User says cash/cod or card/online. "cash on delivery", "card please", "cod" = continue.
→ GLOBAL EXCEPTION: If the user explicitly asks to "change my address", "use a different address", or "deliver somewhere else" from ANY phase, this IS a valid checkout_continue.
→ GLOBAL EXCEPTION: If the user explicitly asks to "change my delivery date", "use a different date", or specifies a date (e.g. "deliver tomorrow instead", "send it on Saturday") from ANY phase, this IS a valid checkout_continue.
→ CRITICAL RULE: If the message is a QUESTION, a SEARCH REQUEST, a comparison, or about something DIFFERENT from the current phase (except address/date changes) — it is NOT checkout_continue.
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
    "I want to buy another shoe as well for me" (when shoe is not in cart/available products) → pause, search for shoe
→ The checkout session stays ALIVE — it is not cancelled.
→ When in doubt between checkout_continue and checkout_pause: ALWAYS choose checkout_pause.

"cart_modify"
→ Use when: User wants to change the cart contents (remove an item, change a quantity, or add products they have selected or just viewed/discussed in the chat).
→ CRITICAL RULE: ONLY choose "cart_modify" to add an item if the item to add is present in the CURRENT CART or the AVAILABLE/REFERENCED PRODUCTS list above. If the user wants to buy, search for, or add a NEW product that is not in either list (for example, "I want to buy another shoe as well" when there is no shoe in the lists), you MUST choose "checkout_pause" so they can search for it first.
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
1. If no active checkout + message has order intent + references a SAVED address label → "checkout_start_with_address"
2. If no active checkout + order intent but NO address label → "checkout_start"
3. If no active checkout + no order intent → "shop"
4. If active checkout + message fits current phase question → "checkout_continue"
5. If active checkout + message is about something else → "checkout_pause"
6. If active checkout + user wants cart change → "cart_modify"
7. If active checkout + clear cancellation language → "checkout_cancel"
8. When uncertain between checkout_continue and checkout_pause → ALWAYS use "checkout_pause"

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
      "shop", "checkout_start", "checkout_start_with_address", "checkout_continue",
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

    // ── Phase 5: Search-pattern safety guard ────────────────────────────────
    // If the LLM decided checkout_continue or cart_modify but the message looks like a search/browse
    // or new product request, override to checkout_pause.
    if ((action === "checkout_continue" || action === "cart_modify") && hasActiveCheckout) {
      const searchOrBuyPatterns = /\b(show me|find|search|look for|browse|what about|any other|other options|different|compare|recommend|suggest|available|see more|more options|something else|instead|actually|never mind|wait|hold on|buy\s+(another|a|an|some|more|the\s+other|new)|add\s+(another|a|an|some|more|the\s+other|new)|order\s+(another|a|an|some|more|the\s+other|new))\b/i;
      const questionWords = /^(what|which|how|where|when|why|is there|are there|can you|do you|could you)/i;
      if (searchOrBuyPatterns.test(message) || questionWords.test(message.trim())) {
        let isMatched = false;
        
        // Bypass safety override for address, location, or delivery date modification requests
        const isAddressOrDateChange = /\b(address|location|place|destination|date|tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday|weekday|deliver|send|ship)\b/i.test(message);
        if (isAddressOrDateChange) {
          isMatched = true;
        }

        if (action === "cart_modify" && !isMatched) {
          const lowerMsg = message.toLowerCase();
          const allItems = [...(checkoutState?.cartItems || []), ...(availableProducts || [])];
          for (const item of allItems) {
            const nameWords = item.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
            if (nameWords.some((word: string) => lowerMsg.includes(word))) {
              isMatched = true;
              break;
            }
          }
        }
        if (!isMatched) {
          console.log(`[RouterAgent] Safety override: ${action} → checkout_pause (search/buy pattern detected in: "${message.substring(0, 60)}")`);
          return {
            action: "checkout_pause",
            reason: `Safety override: message looks like a search/browse/buy query for a new product, not a checkout/cart modification answer`,
          };
        }
      }
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
