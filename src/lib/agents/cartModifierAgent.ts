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

export type CartModificationType = "remove" | "update_qty" | "add";

export interface CartModification {
  type: CartModificationType;
  /** The ID of the item to modify (matched from cart). Null if not found. */
  itemId: string | null;
  /** The display name of the matched item (for logging/response). */
  itemName: string | null;
  /** New quantity (for update_qty). */
  newQty: number | null;
  /** For add, the list of items to add. */
  itemsToAdd?: { id: string; name: string; price: number; quantity: number; imageUrl?: string }[] | null;
  /** Response text to show the user. */
  responseText: string;
  /** The updated cart array after applying the modification. */
  updatedCart: CartItem[];
}

export async function cartModifierAgent(
  message: string,
  currentCart: CartItem[],
  availableProducts: any[],
  ai: GoogleGenAI,
  fastModel: string
): Promise<CartModification> {
  const cartListStr = (currentCart || [])
    .map((item, i) => `  ${i + 1}. ID: "${item.id}", Name: "${item.name}", Qty: ${item.quantity}, Price: Rs. ${item.price.toLocaleString()}`)
    .join("\n") || "  (empty)";

  const availableListStr = (availableProducts || [])
    .map((item, i) => `  ${i + 1}. ID: "${item.id}", Name: "${item.name}", Price: Rs. ${item.price?.toLocaleString()}${item.isExplicitlySelected ? " (SELECTED/CHECKED BY USER)" : ""}`)
    .join("\n") || "  (none)";

  const prompt = `You are a cart manager for a Sri Lankan e-commerce shopping assistant.

═══ CURRENT CART ═══
${cartListStr}

═══ AVAILABLE/REFERENCED PRODUCTS (User has selected or recently viewed these) ═══
${availableListStr}

═══ USER MESSAGE ═══
"${message}"

═══ YOUR TASK ═══
Determine what cart change the user wants and which item(s) they're referring to.

Change types:
- "remove": User wants to DELETE an item from the cart entirely.
  Examples: "remove the shoes", "delete the first item", "I don't want the flowers", "take out the cake"
  
- "update_qty": User wants to CHANGE the quantity of an item currently in the cart.
  Examples: "make it 2 cakes", "change shoes to 3", "I want 4 of those instead", "increase the flowers to 2"

- "add": User wants to ADD one or more products from the AVAILABLE/REFERENCED PRODUCTS list to the cart.
  Examples: "add the first flower bouquet", "please add all of those to the order", "add the cake to my cart"

For "add" action:
- Match the product(s) the user wants to add from the AVAILABLE/REFERENCED PRODUCTS list using name similarity or position reference (e.g., "all of those", "first one").
- Set "itemsToAdd" to the list of matched items. Each item must contain its "id" and the requested "quantity" (default to 1 if not specified).
- Set "itemId", "itemName", and "newQty" to null.
- CRITICAL RULE: If the user's message is "add these", "add selected", "add to cart", etc., and there are products marked as "(SELECTED/CHECKED BY USER)", you should match and add ONLY those explicitly selected products. Do not add all available products.

For "remove" and "update_qty" actions:
- Match the item from the CURRENT CART. If you cannot match an item, set itemId to null.
- Set "itemsToAdd" to null.

For the responseText:
- 1 sentence, casual and friendly — like a buddy confirming what they did
- If remove: "Gone! Took [item name] out of your cart."
- If update_qty: "Done! Changed [item name] to [qty]."
- If add: "Added [item name(s)] to your order — nice pick!"
- If item not found: "Hmm, I couldn't find that one in your cart. Which product did you mean?"

Respond ONLY as valid JSON:
{
  "type": "remove" | "update_qty" | "add",
  "itemId": "<matched item id or null>",
  "itemName": "<matched item name or null>",
  "newQty": <number or null>,
  "itemsToAdd": [{"id": "<id>", "quantity": <number>}] or null,
  "responseText": "<1 sentence>"
}`;

  // LLM-determined modification + result
  let modification: {
    type: CartModificationType;
    itemId: string | null;
    itemName: string | null;
    newQty: number | null;
    itemsToAdd?: { id: string; quantity: number }[] | null;
    responseText: string;
  };

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
            itemsToAdd: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  quantity: { type: "NUMBER" },
                },
                required: ["id", "quantity"],
              },
              nullable: true,
            },
            responseText: { type: "STRING" },
          },
          required: ["type", "itemId", "itemName", "newQty", "responseText"],
        },
      },
    });

    const raw = (result.text || "{}").trim();
    modification = JSON.parse(raw);
    console.log(`[CartModifierAgent] type="${modification.type}" item="${modification.itemName}" itemsToAddCount=${modification.itemsToAdd?.length ?? 0}`);
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
  const { type, itemId, newQty, itemsToAdd } = modification;

  if (type === "add" && Array.isArray(itemsToAdd) && itemsToAdd.length > 0) {
    for (const addReq of itemsToAdd) {
      const productDetail = (availableProducts || []).find((p) => String(p.id).trim().toLowerCase() === String(addReq.id).trim().toLowerCase());
      if (productDetail) {
        const existingIdx = updatedCart.findIndex((item) => String(item.id).trim().toLowerCase() === String(addReq.id).trim().toLowerCase());
        if (existingIdx > -1) {
          updatedCart[existingIdx].quantity += addReq.quantity;
        } else {
          updatedCart.push({
            id: productDetail.id,
            name: productDetail.name || productDetail.title || "Kapruka Product",
            price: productDetail.price || 0,
            quantity: addReq.quantity || 1,
            imageUrl: productDetail.imageUrl || productDetail.image,
            inStock: productDetail.inStock !== false,
            stockQty: productDetail.stockCount ?? undefined,
          });
        }
      }
    }
  } else if (itemId) {
    const lowerItemId = String(itemId).trim().toLowerCase();
    if (type === "remove") {
      updatedCart = updatedCart.filter((item) => String(item.id).trim().toLowerCase() !== lowerItemId);
    } else if (type === "update_qty" && typeof newQty === "number" && newQty > 0) {
      updatedCart = updatedCart.map((item) =>
        String(item.id).trim().toLowerCase() === lowerItemId ? { ...item, quantity: newQty } : item
      );
    }
  }

  // Construct itemsToAdd response metadata if type is add
  const mappedItemsToAdd = type === "add" && Array.isArray(itemsToAdd)
    ? itemsToAdd.map((addReq) => {
        const prod = (availableProducts || []).find((p) => String(p.id).trim().toLowerCase() === String(addReq.id).trim().toLowerCase());
        return {
          id: addReq.id,
          name: prod?.name || prod?.title || "Product",
          price: prod?.price || 0,
          quantity: addReq.quantity,
          imageUrl: prod?.imageUrl || prod?.image,
        };
      })
    : null;

  return {
    type: modification.type,
    itemId: modification.itemId,
    itemName: modification.itemName,
    newQty: modification.newQty,
    itemsToAdd: mappedItemsToAdd,
    responseText: modification.responseText,
    updatedCart,
  };
}
