/**
 * Order Agent
 *
 * Called when the Router Agent decides "checkout_continue".
 * Uses a single LLM reasoning call to understand the user's message in
 * the context of the current checkout phase, extract structured data,
 * and determine the next phase transition.
 *
 * Phase flow:
 *   qty_ask → delivery_ask → [new_address_form?] → delivery_date_ask → payment_ask → confirmed
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
    | "new_address_form"
    | "delivery_date_ask"
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
    /** ID of the specific saved address chosen (from "Use address: <id>" message). */
    selectedAddressId?: string;
    /** Payment method chosen (payment_ask). */
    paymentMethod?: "cod" | "card";
    /** Delivery date in YYYY-MM-DD format (from delivery_date_ask). */
    deliveryDate?: string;
    /** Optional personal/gift message (from delivery_date_ask). */
    personalMessage?: string;
  };

  /** The response text to stream to the user (1–2 warm sentences). */
  responseText: string;

  /** True if geocoding is needed before the next phase (address_ask → map_open). */
  requiresGeocode: boolean;

  /** True if an order should be placed (payment_ask → confirmed). */
  requiresOrderPlace: boolean;

  /** True if kapruka_check_delivery must be called before advancing to payment_ask. */
  requiresDeliveryCheck: boolean;
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
  const { phase, cartItems, product, confirmedQty, confirmedAddress, savedAddress, paymentMethod, deliveryDate, personalMessage } = checkoutState;
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
Delivery Date: ${deliveryDate ?? "not yet set"}
Personal Message: ${personalMessage ?? "none"}
Payment: ${paymentMethod ?? "not yet chosen"}
Customer First Name: "${firstName}"

═══ USER MESSAGE ═══
"${message}"

═══ YOUR TASK ═══
Reason about what the user said and determine:

1. nextPhase — Where to go next?
   GLOBAL OVERRIDE: If the user explicitly asks to "change my address", "use a different address", or "new address", ALWAYS set nextPhase to "new_address_form", REGARDLESS of the current phase.
   
   Phase flow: qty_ask → delivery_ask → [new_address_form?] → delivery_date_ask → payment_ask → confirmed
   
   "qty_ask" phase:
     -> "delivery_ask" if user confirms quantities (e.g. "looks good", "confirm", "proceed", "yes")
     -> "qty_ask" + stay=true if user is unclear or asks a question
   
   "delivery_ask" phase:
     The user may have clicked a saved address card (message = "Use address: <id>") or asked for new address.
     -> "delivery_date_ask" if user chose a saved address (message starts with "Use address:", or says yes/saved/confirm)
       Set extractedData.usesSavedAddress=true and extract selectedAddressId from "Use address: <id>" if present.
     -> "new_address_form" if user wants a new/different address ("new address", "different location", "other place")
     -> "delivery_ask" + stay=true if unclear
   
   "new_address_form" phase:
     Message will be "New address confirmed: <name>|<phone>|<formattedAddress>|<city>" from the UI form.
     -> "delivery_date_ask" always (go to date selection after address is confirmed)
   
   "delivery_date_ask" phase:
     The UI sends a structured message: "Delivery date confirmed: YYYY-MM-DD|Personal message: <text or empty>"
     Parse this message to extract:
     - deliveryDate: the YYYY-MM-DD part after "Delivery date confirmed: "
     - personalMessage: the text after "Personal message: " (may be empty string — that is fine)
     -> "payment_ask" always when this structured message is received (set requiresDeliveryCheck=true)
     -> "delivery_date_ask" + stay=true if message is NOT the structured format (user typed something unclear)
     
     If user types a date naturally (not via the UI button), parse it:
     - "tomorrow" → compute tomorrow's date as YYYY-MM-DD
     - "Saturday", "next Friday" etc → compute nearest upcoming weekday as YYYY-MM-DD
     - "25th", "June 25", "25/06" → parse as YYYY-MM-DD for current month/year
     - If date is in the past → stay=true with an error message
     In this case also set requiresDeliveryCheck=true when advancing.
   
   "payment_ask" phase:
     -> "confirmed" if user chose a payment method (set requiresOrderPlace=true)
     -> "payment_ask" + stay=true if unclear

2. stay — Is the response staying at the current phase?
   Set true only if the user was unclear and you're repeating the phase question.

3. extractedData — Extract structured values:
   qty_ask (single product): Did they mention a quantity? -> quantity: <number>
   qty_ask (cart): Did they change any item quantity? -> updatedCartItems: [updated cart array]
   delivery_ask: usesSavedAddress: true or false; if message is "Use address: <id>" also extract selectedAddressId: "<the-id>"
   new_address_form: message is structured "New address confirmed: ...", just set nextPhase=delivery_date_ask, no extractedData needed
   delivery_date_ask: deliveryDate: "YYYY-MM-DD"; personalMessage: "<text or empty string>"
   payment_ask: paymentMethod: "cod" or "card"
   
   COD signals: cash, cod, cash on delivery, on delivery, pay on arrival
   Card signals: card, credit, debit, online, pay online, card payment

4. responseText - 1-2 warm sentences to say to the user.
   Rules:
   - NEVER start with Hello / Hi / Hey
   - Use first name sparingly (max once)
   - Be warm and natural
   - ANY phase -> new_address_form (due to address change request): "Sure, let's update your delivery address. Please fill in the details and pin your new location below."
   - qty_ask -> delivery_ask: Acknowledge confirmed. Say "Please select a delivery address below."
   - delivery_ask -> delivery_date_ask: Acknowledge saved address chosen. Say "When would you like your order delivered? Pick a date below, and feel free to add a personal message!"
   - delivery_ask -> new_address_form: "Please fill in your delivery details and pin your exact location on the map below."
   - new_address_form -> delivery_date_ask: "Address confirmed! Now, when would you like your order delivered? Pick a date below."
   - delivery_date_ask -> payment_ask: This is just a placeholder — actual confirmation message is generated by the route after checking delivery.
   - delivery_date_ask + stay=true (date not given): "When would you like your order delivered? Please pick a date from the options below, and feel free to add a personal message for the recipient!"
   - payment_ask -> confirmed: This is just a placeholder — actual confirmation message is generated later.
   - stay=true: Politely re-ask the same phase question.

5. requiresDeliveryCheck — Set true ONLY when transitioning delivery_date_ask → payment_ask.
   This tells the route to call kapruka_check_delivery before advancing.

6. requiresOrderPlace — Set true ONLY when transitioning payment_ask → confirmed.

Respond ONLY as valid JSON matching exactly this schema:
{
  "nextPhase": "<phase or stay>",
  "stay": <boolean>,
  "extractedData": {
    "quantity": <number or null>,
    "updatedCartItems": <array or null>,
    "usesSavedAddress": <boolean or null>,
    "selectedAddressId": <string or null>,
    "paymentMethod": <"cod" | "card" | null>,
    "deliveryDate": <"YYYY-MM-DD" or null>,
    "personalMessage": <string or null>
  },
  "responseText": "<1-2 sentences>",
  "requiresGeocode": <boolean>,
  "requiresOrderPlace": <boolean>,
  "requiresDeliveryCheck": <boolean>
}`;

  const fallbackOutput = (stayPhase = true): OrderAgentOutput => ({
    nextPhase: stayPhase ? "stay" : phase as OrderAgentOutput["nextPhase"],
    stay: stayPhase,
    extractedData: {},
    responseText: getPhaseRepeatText(phase, savedAddress, cartItems),
    requiresGeocode: false,
    requiresOrderPlace: false,
    requiresDeliveryCheck: false,
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
                selectedAddressId: { type: "STRING", nullable: true },
                paymentMethod: { type: "STRING", nullable: true },
                deliveryDate: { type: "STRING", nullable: true },
                personalMessage: { type: "STRING", nullable: true },
              },
            },
            responseText: { type: "STRING" },
            requiresGeocode: { type: "BOOLEAN" },
            requiresOrderPlace: { type: "BOOLEAN" },
            requiresDeliveryCheck: { type: "BOOLEAN" },
          },
          required: ["nextPhase", "stay", "extractedData", "responseText", "requiresGeocode", "requiresOrderPlace", "requiresDeliveryCheck"],
        },
      },
    });

    const raw = (result.text || "{}").trim();
    const parsed = JSON.parse(raw) as OrderAgentOutput;

    console.log(`[OrderAgent] phase="${phase}" → nextPhase="${parsed.nextPhase}" stay=${parsed.stay} requiresDeliveryCheck=${parsed.requiresDeliveryCheck}`);
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
        : "Please select a delivery address below, or add a new one.";
    case "new_address_form":
      return "Please fill in your name, phone, and location in the form below, then pin your exact address on the map.";
    case "delivery_date_ask":
      return "When would you like your order delivered? Please pick a date from the options below, and feel free to add a personal message for the recipient!";
    case "payment_ask":
      return "How would you like to pay? Please choose **Cash on Delivery** or **Card Payment**.";
    default:
      return "I didn't quite understand that. Could you please clarify?";
  }
}
