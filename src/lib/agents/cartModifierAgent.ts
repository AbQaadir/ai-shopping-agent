/**
 * Cart Modifier Agent
 *
 * Called when the Router Agent decides "cart_modify".
 * Uses LLM reasoning to understand what the user wants to change in their cart
 * (remove an item, update a quantity) and returns a structured modification.
 *
 * Handles free-form requests like:
 *   "remove the shoes"
 *   "delete the second item"
 *   "change the cake quantity to 2"
 *   "I don't want the flowers anymore"
 *   "make it 3 cakes instead of 1"
 */

import { GoogleGenAI } from "@google/genai";
import type { CartItem } from "@/types/sourcing";

export type CartModificationType = "remove" | "update_qty";

export interface CartModification {
  type: CartModificationType;
  /** The ID of the item to modify (matched from cart). Null if not found. */
  itemId: string | null;
  /** The display name of the matched item (for logging/response). */
  itemName: string | null;
  /** New quantity (for update_qty). */
  newQty: number | null;
  /** Response text to show the user. */
  responseText: string;
  /** The updated cart array after applying the modification. */
  updatedCart: CartItem[];
}

export async function cartModifierAgent(
  message: string,
  currentCart: CartItem[],
  ai: GoogleGenAI,
  fastModel: string
): Promise<CartModification> {
  if (!currentCart || currentCart.length === 0) {
    return {
      type: "remove",
      itemId: null,
      itemName: null,
      newQty: null,
      responseText: "Your cart is already empty — there's nothing to remove.",
      updatedCart: [],
    };
  }

  const cartListStr = currentCart
    .map((item, i) => `  ${i + 1}. ID: "${item.id}", Name: "${item.name}", Qty: ${item.quantity}, Price: Rs. ${item.price.toLocaleString()}`)
    .join("\n");

  const prompt = `You are a cart manager for a Sri Lankan e-commerce shopping assistant.

═══ CURRENT CART ═══
${cartListStr}

═══ USER MESSAGE ═══
"${message}"

═══ YOUR TASK ═══
Determine what cart change the user wants and which item they're referring to.

Change types:
- "remove": User wants to DELETE an item from the cart entirely.
  Examples: "remove the shoes", "delete the first item", "I don't want the flowers", "take out the cake"
  
- "update_qty": User wants to CHANGE the quantity of an item.
  Examples: "make it 2 cakes", "change shoes to 3", "I want 4 of those instead", "increase the flowers to 2"

Match the item using:
- Name similarity (e.g., "shoes" matches "Nike Running Shoes")
- Position reference (e.g., "first item", "item 1", "second one")
- Fuzzy matching (partial name, synonym)

If you cannot match an item, set itemId to null.

For the responseText:
- 1 sentence, warm and confirming
- If remove: "I've removed [item name] from your cart."
- If update_qty: "Updated [item name] to [qty] unit(s)."
- If item not found: "I couldn't find that item in your cart. Could you clarify which product you'd like to change?"

Respond ONLY as valid JSON:
{
  "type": "remove" | "update_qty",
  "itemId": "<matched item id or null>",
  "itemName": "<matched item name or null>",
  "newQty": <number or null>,
  "responseText": "<1 sentence>"
}`;

  // LLM-determined modification + result
  let modification: { type: CartModificationType; itemId: string | null; itemName: string | null; newQty: number | null; responseText: string };

  try {
    const result = await ai.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING" },
            itemId: { type: "STRING", nullable: true },
            itemName: { type: "STRING", nullable: true },
            newQty: { type: "NUMBER", nullable: true },
            responseText: { type: "STRING" },
          },
          required: ["type", "itemId", "itemName", "newQty", "responseText"],
        },
      },
    });

    const raw = (result.text || "{}").trim();
    modification = JSON.parse(raw);
    console.log(`[CartModifierAgent] type="${modification.type}" item="${modification.itemName}" newQty=${modification.newQty}`);
  } catch (err) {
    console.error("[CartModifierAgent] LLM call failed:", (err as Error).message);
    return {
      type: "remove",
      itemId: null,
      itemName: null,
      newQty: null,
      responseText: "I had trouble understanding that. Could you clarify which item you'd like to change?",
      updatedCart: currentCart,
    };
  }

  // Apply the modification to produce the updated cart
  let updatedCart = [...currentCart];
  const { type, itemId, newQty } = modification;

  if (itemId) {
    if (type === "remove") {
      updatedCart = updatedCart.filter((item) => item.id !== itemId);
    } else if (type === "update_qty" && typeof newQty === "number" && newQty > 0) {
      updatedCart = updatedCart.map((item) =>
        item.id === itemId ? { ...item, quantity: newQty } : item
      );
    }
  }

  return {
    type: modification.type,
    itemId: modification.itemId,
    itemName: modification.itemName,
    newQty: modification.newQty,
    responseText: modification.responseText,
    updatedCart,
  };
}
