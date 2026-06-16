/**
 * Order Agent
 *
 * Called when the Router Agent decides "checkout_continue".
 * Uses a single LLM reasoning call to understand the user's message in
 * the context of the current checkout phase, extract structured data,
 * and determine the next phase transition.
 *
 * Replaces ~400 lines of hard-coded if-else phase handlers in the old route.ts.
 */

import { GoogleGenAI } from "@google/genai";
import type { CheckoutState } from "@/lib/checkoutContext";
import type { CartItem } from "@/types/sourcing";

export interface OrderAgentOutput {
  /** The phase to move to after this turn. */
  nextPhase:
    | "qty_ask"
    | "delivery_ask"
    | "address_ask"
    | "map_open"
    | "payment_ask"
    | "confirmed"
    | "stay";

  /** If true, repeat the current phase question (user was unclear). */
  stay: boolean;

  /** Structured data extracted from the user's message. */
  extractedData: {
    /** Confirmed quantity (from qty_ask when single product). */
    quantity?: number;
    /** Updated cart items (from qty_ask when modifying quantities). */
    updatedCartItems?: CartItem[];
    /** True if user chose to use their saved address (delivery_ask). */
    usesSavedAddress?: boolean;
    /** Raw address text from user (address_ask → needs geocoding). */
    addressText?: string;
    /** Payment method chosen (payment_ask). */
    paymentMethod?: "cod" | "card";
  };

  /** The response text to stream to the user (1–2 warm sentences). */
  responseText: string;

  /** True if geocoding is needed before the next phase (address_ask → map_open). */
  requiresGeocode: boolean;

  /** True if an order should be placed (payment_ask → confirmed). */
  requiresOrderPlace: boolean;
}

function cartToStr(cartItems: CartItem[]): string {
  if (!cartItems || cartItems.length === 0) return "(empty)";
  return cartItems
    .map((i) => `  • ${i.quantity}x "${i.name}" — Rs. ${i.price.toLocaleString()}`)
    .join("\n");
}

export async function orderAgent(
  message: string,
  checkoutState: CheckoutState,
  ai: GoogleGenAI,
  reasoningModel: string
): Promise<OrderAgentOutput> {
  const { phase, cartItems, product, confirmedQty, confirmedAddress, savedAddress, paymentMethod } = checkoutState;
  const firstName = savedAddress?.name?.split(" ")[0] ?? "";
  const isCartFlow = cartItems && cartItems.length > 0;

  const prompt = `You are Kapuruka's Order Processing Agent — professional, warm, and concise.

═══ CURRENT CHECKOUT STATE ═══
Phase: "${phase}"
${isCartFlow
    ? `Cart:\n${cartToStr(cartItems)}`
    : `Single Product: "${product?.name ?? "Unknown"}" — Rs. ${product?.price?.toLocaleString() ?? "N/A"}`}
Confirmed Qty: ${confirmedQty ?? "not yet set"}
Saved Address: ${savedAddress ? `${savedAddress.address}, ${savedAddress.city} (Name: ${savedAddress.name}, Phone: ${savedAddress.phone})` : "none"}
Confirmed Address: ${confirmedAddress ? `${confirmedAddress.address}, ${confirmedAddress.city}` : "not yet set"}
Payment: ${paymentMethod ?? "not yet chosen"}
Customer First Name: "${firstName}"

═══ USER MESSAGE ═══
"${message}"

═══ YOUR TASK ═══
Reason about what the user said and determine:

1. nextPhase — Where to go next?
   Based on current phase:
   
   "qty_ask" phase:
     → "delivery_ask" if user confirms quantities (e.g. "looks good", "confirm", "proceed", "yes")
     → "qty_ask" + stay=true if user is unclear or asks a question
     Note: If user changes quantity (e.g. "make it 2"), update extractedData.quantity or updatedCartItems
   
   "delivery_ask" phase:
     → "payment_ask" if user chose saved address ("yes use saved", "saved address", "confirm my address")
     → "address_ask" if user wants a new/different address ("new address", "different location", "other place")
     → "delivery_ask" + stay=true if unclear
   
   "address_ask" phase:
     → "map_open" always (any text they type IS the address, set requiresGeocode=true)
   
   "map_open" phase:
     → "payment_ask" ONLY if the user confirmed their location (typically the message starts with "Confirm location:").
     → "map_open" (with stay=false and requiresGeocode=true) if they type a new address/location text or ask to open/pin/change the map location. Set addressText: "<the new location text>".
     → "map_open" + stay=true if they just send other text or questions, reminding them to drag the pin and tap confirm.
   
   "payment_ask" phase:
     → "confirmed" if user chose a payment method (set requiresOrderPlace=true)
     → "payment_ask" + stay=true if unclear

   GENERAL NAVIGATION (Phase regression/correction):
   - If the user explicitly asks to change their address, use a different location, go back to the map, or pin the location (e.g. "change my address", "deliver to Colombo", "open map", "pin location again"), transition to "map_open" (if they type/provide a rough location, set requiresGeocode=true and addressText: "<location>") or "address_ask" (if they didn't specify where).
   - If the user wants to adjust quantities or change the items at any point, transition back to "qty_ask".

2. stay — Is the response staying at the current phase?
   Set true only if the user was unclear and you're repeating the phase question, or they typed text in "map_open" without confirming.

3. extractedData — Extract structured values:
   qty_ask (single product): Did they mention a quantity? → quantity: <number>
   qty_ask (cart): Did they change any item quantity? → updatedCartItems: [updated cart array]
   delivery_ask: usesSavedAddress: true or false
   address_ask / navigation: addressText: "<the address or location text provided>"
   map_open: The message starts with "Confirm location: <address>, <city>" → parse confirmedAddress implicitly (just set nextPhase: "payment_ask")
   payment_ask: paymentMethod: "cod" or "card"
   
   COD signals: cash, cod, cash on delivery, on delivery, pay on arrival
   Card signals: card, credit, debit, online, pay online, card payment

4. responseText — 1-2 warm sentences to say to the user.
   Rules:
   - NEVER start with Hello / Hi / Hey
   - Use first name sparingly (max once)
   - Be warm and natural
   - qty_ask → delivery_ask: Acknowledge confirmed. Ask about delivery address.
     If savedAddress exists: "Great! Should I deliver to your saved address at ${savedAddress ? `${savedAddress.address}, ${savedAddress.city}` : "[address]"}, or would you prefer a different location?"
     If no savedAddress: "Perfect! Where should I deliver your order? Please type a location or landmark."
   - delivery_ask → payment_ask: Acknowledge saved address. Ask how to pay.
   - delivery_ask → address_ask: Ask them to type a rough location/landmark.
   - address_ask → map_open: "I've opened the map near [label you'd geocode to]. Drag the pin to your exact door and tap Confirm when ready."
   - map_open (when they type text instead of confirming): "I have launched the map interface for you to easily pin your exact location near [addressText]. Please use the map on your screen to drag and confirm."
   - map_open → payment_ask: Acknowledge address confirmed. Ask payment method (COD or card).
   - payment_ask → confirmed: This is just a placeholder.
   - Going back to map/address: "No problem, let's update your location. I've opened the map near [location]. Please pin your location."
   - Going back to quantities: "Certainly. Let's adjust your quantities. Please check your items below and confirm when ready."
   - stay=true: Politely re-ask the same phase question.

Respond ONLY as valid JSON matching exactly this schema:
{
  "nextPhase": "<phase or stay>",
  "stay": <boolean>,
  "extractedData": {
    "quantity": <number or null>,
    "updatedCartItems": <array or null>,
    "usesSavedAddress": <boolean or null>,
    "addressText": <string or null>,
    "paymentMethod": <"cod" | "card" | null>
  },
  "responseText": "<1-2 sentences>",
  "requiresGeocode": <boolean>,
  "requiresOrderPlace": <boolean>
}`;

  const fallbackOutput = (stayPhase = true): OrderAgentOutput => ({
    nextPhase: stayPhase ? "stay" : phase as OrderAgentOutput["nextPhase"],
    stay: stayPhase,
    extractedData: {},
    responseText: getPhaseRepeatText(phase, savedAddress, cartItems),
    requiresGeocode: false,
    requiresOrderPlace: false,
  });

  try {
    const result = await ai.models.generateContent({
      model: reasoningModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            nextPhase: { type: "STRING" },
            stay: { type: "BOOLEAN" },
            extractedData: {
              type: "OBJECT",
              properties: {
                quantity: { type: "NUMBER", nullable: true },
                updatedCartItems: { type: "ARRAY", items: { type: "OBJECT" }, nullable: true },
                usesSavedAddress: { type: "BOOLEAN", nullable: true },
                addressText: { type: "STRING", nullable: true },
                paymentMethod: { type: "STRING", nullable: true },
              },
            },
            responseText: { type: "STRING" },
            requiresGeocode: { type: "BOOLEAN" },
            requiresOrderPlace: { type: "BOOLEAN" },
          },
          required: ["nextPhase", "stay", "extractedData", "responseText", "requiresGeocode", "requiresOrderPlace"],
        },
      },
    });

    const raw = (result.text || "{}").trim();
    const parsed = JSON.parse(raw) as OrderAgentOutput;

    console.log(`[OrderAgent] phase="${phase}" → nextPhase="${parsed.nextPhase}" stay=${parsed.stay}`);
    return parsed;
  } catch (err) {
    console.error("[OrderAgent] LLM call failed:", (err as Error).message);
    return fallbackOutput(true);
  }
}

/** Generates a fallback "repeat this phase question" text. */
function getPhaseRepeatText(
  phase: string,
  savedAddress?: { address: string; city: string } | null,
  cartItems?: CartItem[]
): string {
  switch (phase) {
    case "qty_ask":
      if (cartItems && cartItems.length > 0) {
        return "Please confirm the quantities for your cart items, or remove any you don't need.";
      }
      return "How many units would you like to order?";
    case "delivery_ask":
      return savedAddress
        ? `Should I deliver to your saved address at **${savedAddress.address}, ${savedAddress.city}**, or would you like a different location?`
        : "Where should I deliver your order? Please type a location or nearby landmark.";
    case "address_ask":
      return "Please type your delivery address or a nearby landmark so I can open the map for you.";
    case "map_open":
      return "Please drag the pin to your exact door on the map and tap **Confirm this location** when ready.";
    case "payment_ask":
      return "How would you like to pay? Please choose **Cash on Delivery** or **Card Payment**.";
    default:
      return "I didn't quite understand that. Could you please clarify?";
  }
}
