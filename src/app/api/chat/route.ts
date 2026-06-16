import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  extractCityFromMessage,
  extractDate,
  extractOrderId,
  Intent,
  ruleBasedIntent,
} from "@/lib/nlp";
import {
  parseRequirements,
  pillar1_getProductDetails,
  pillar1_searchProducts,
  pillar2_checkDelivery,
  pillar2_findCity,
  pillar2_trackOrder,
  pillar3_searchSMEProducts,
  pillar5_detectServiceCategory,
  pillar5_searchServiceProviders,
  type KaprukaProduct,
} from "@/lib/tools";
import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// ── New Agentic Architecture ──────────────────────────────────────────────
import { routerAgent, type RouterDecision } from "@/lib/agents/routerAgent";
import { orderAgent } from "@/lib/agents/orderAgent";
import { cartModifierAgent, type CartModification } from "@/lib/agents/cartModifierAgent";
import {
  getCheckoutState,
  saveCheckoutState,
  clearCheckoutState,
  type CheckoutState,
} from "@/lib/checkoutContext";


interface SearchTermConfig {
  term: string;
  minPrice: number | null;
  maxPrice: number | null;
}

// ── Saved address registry (temporary — normally would be in DB per user) ───
const USER_DEFAULTS: Record<string, { name: string; phone: string; address: string; city: string }> = {
  "e17d0577-c93d-4c3e-9080-60b6bbfdf071": { name: "Kamal Silva", phone: "0771234567", address: "123 Galle Road, Colombo 3", city: "Colombo 3" },
  "b91d2a14-e58f-4ad1-97b0-cce218fd7d32": { name: "Nimal Perera", phone: "0719876543", address: "45 Flower Road, Colombo 7", city: "Colombo 7" },
};

// ── System Prompts per Pillar ───────────────────────────────────────────────
const SYSTEM_PROMPTS: Record<Intent, string> = {
  product: `You are Kapuruka's AI shopping assistant for Sri Lanka.
The user wants to find or buy products. Live product results from Kapruka.com have been fetched and shown to the user.
Do NOT fabricate product details — only reference what was returned by the search tool.
If the user wants to buy or order a specific product, guide them to select the product in the chat interface (by checking its selection box) and write "order this" (or simply ask you to order that product by name) to initiate the secure order checkout process directly in the chat.

For EACH search result category, you MUST format your response using EXACTLY these tags to frame your description:
[INTRO: <Category Name>]
A simple, brief 1-sentence introduction about the products found in this category (e.g. "[INTRO: Shoes] I found some beautiful shoes from the Kapruka catalog...").
[DETAILS: <Category Name>]
A detailed description (2-3 sentences) summarizing and comparing the products, their prices in LKR, stock status, and guiding the user on how they can select/order them.

If multiple categories were searched, output the [INTRO] and [DETAILS] tags for each category sequentially. Only use these tags if product search results are returned. If no products are found, write a standard response apologizing politely.`,

  delivery: `You are Kapuruka's Grasshoppers logistics assistant for Sri Lanka.
You help users check delivery availability, rates, and track orders.
All delivery quotes are in LKR. Flat rates are provided by the Grasshoppers courier network.
Be precise with dates and delivery windows. Always clarify if perishables have restrictions.
Keep responses concise — 2–3 sentences.`,

  service: `You are Kapuruka's home services booking assistant for Sri Lanka.
You connect users with verified local technicians — electricians, plumbers, AC repair, cleaning, pest control, painting, and carpentry.
If the user's city is known, verified providers in their area are shown.
Be warm and helpful. Explain what each service provider specialises in. Suggest the top option based on rating.`,

  qa: `You are Kapuruka's customer support and informational assistant for Sri Lanka.
You have access to Google Search to retrieve live, real-time information about Kapruka, Sri Lankan e-commerce, and general queries.
Answer the user's question accurately using search results. Provide clear, concise, and helpful responses in 2–3 sentences.
Highlight key information and always reference your sources if appropriate.`,
};

const SELECTED_PRODUCT_QA_PROMPT = `You are Kapuruka's AI product advisor for Sri Lanka.
The user has selected specific products from the catalog and is asking questions about them.
Answer their questions conversationally, helpfully, and specifically using only the provided product details.
Do NOT use [INTRO] or [DETAILS] tags. Be warm, direct, and detailed in your analysis.
If asked to compare, create a markdown table comparing their features, price, stock, and highlight the best option.`;

// ── Main Chat POST Handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, message, userId, country, currency, selectedProductIds } = body;

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: "Missing sessionId or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Ensure chat session exists
    let session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          id: sessionId,
          title: message.substring(0, 60) || "New Chat",
          status: "active",
          userId: userId && userId !== "guest" ? userId : null,
        },
      });
    }

    // 2. Fetch selected product details (if any)
    let fetchedSelectedProducts: KaprukaProduct[] = [];
    if (selectedProductIds && Array.isArray(selectedProductIds) && selectedProductIds.length > 0) {
      const detailsList = await Promise.all(
        selectedProductIds.map((id) =>
          pillar1_getProductDetails(id).catch((err) => {
            console.error(`Failed to fetch product details for ${id}:`, err);
            return null;
          })
        )
      );
      fetchedSelectedProducts = detailsList.filter((p): p is KaprukaProduct => p !== null);
    }

    // 3. Save user message to DB
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message,
        products: fetchedSelectedProducts.length > 0 ? (fetchedSelectedProducts as any) : undefined,
      },
    });

    // 4. Fetch chat history for context
    const chatHistory = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });

    const historySnippet = chatHistory
      .slice(0, -1) // exclude current user message
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content.substring(0, 150)}`)
      .join("\n");

    // 5. Setup Gemini AI
    const apiKey = config.gemini.apiKey;
    let ai: GoogleGenAI | null = null;
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
    }

    const hasSelectedProducts = !!(
      selectedProductIds &&
      Array.isArray(selectedProductIds) &&
      selectedProductIds.length > 0
    );

    // 6. Intent classification (unchanged — handles search terms)
    let intent: Intent = ruleBasedIntent(message);
    let isRelated = true;
    let llmSearchTerms: SearchTermConfig[] = [];

    if (hasSelectedProducts) {
      intent = "product";
      isRelated = true;
    } else if (ai) {
      try {
        const classifierPrompt = `You are a query classifier and search term extractor for Kapruka (Sri Lankan e-commerce assistant).
Analyze the user query in the context of the recent conversation history, and perform these tasks:

1. Determine if the query is RELATED or UNRELATED to the business of Kapruka.
   - RELATED: Product search, cake/gift shopping, order tracking, delivery rates/checks, cross-border import cost calculator, local home services (electrical, plumbing, AC repair, cleaning, etc.), or e-commerce platform support/Q&A. Also count follow-up requests for details/authors/specifications of previously discussed products in the conversation as RELATED.
   - UNRELATED: Software coding/programming help, copywriting, content/essay writing, translation, general homework/math solver, or generic chat/questions having nothing to do with e-commerce, local services, or the current conversation's context.
   Set "isRelated" to true if it is related, or false if it is unrelated.

2. Classify the user message into exactly ONE intent:
   - "product": Searching for, comparing, or buying products on Kapruka.com (e.g. cakes, gifts, clothes, books, electronics), asking for details/specifications of a product in the conversation, reordering, or responding to any active step in the checkout pipeline (such as specifying quantities, selecting/updating delivery addresses, choosing payment methods like cash on delivery or card, or confirming to place the order with "yes please").
   - "delivery": Checking delivery availability to a city, delivery rates, tracking an existing order.
   - "service": User needs a home service (repair, cleaning, pest control, plumber, electrician, AC repair, carpentry).
   - "qa": General platform questions (returns, policies, general account help) or general knowledge/informational queries that require web search grounding. Note: Do NOT classify any checkout responses, payment method selections for an active order, or checkout confirmations (e.g. cash on delivery) as "qa".

3. Extract focused product search terms and price filters ("searchTerms") as a JSON array of objects matching this schema:
   {
     "term": string (MAX 2 words — the core product noun only. Strip colors/descriptors like "gold", "silver", "black", occasion/verbs/filler words like "wedding", "cheap", "buy", "for me" — e.g. "gold phone cases" -> "phone cases", "chocolate birthday cake" -> "cake" or "chocolate cake"),
     "minPrice": number | null (minimum price limit specified by user, e.g. "above 5000" -> 5000, "between 2000 and 5000" -> 2000. Set to null if there is no minimum price limit),
     "maxPrice": number | null (maximum price limit specified by user, e.g. "under 3000" -> 3000, "between 2000 and 5000" -> 5000. Set to null if there is no maximum price limit)
   }
   CRITICAL RULES:
   - Do NOT include any currency symbols or conversions in minPrice/maxPrice — just extract the raw numbers as numbers.
   - Extract ONE object per distinct product the user wants (max 3 objects total).
   - If not a product/service intent, set "searchTerms" to [].

Respond ONLY with JSON matching this structure:
{"intent": "product"|"delivery"|"service"|"qa", "isRelated": boolean, "searchTerms": [{"term": string, "minPrice": number|null, "maxPrice": number|null}], "reason": "brief explanation"}

[Recent Conversation History]
${historySnippet || "No previous history."}

User query to classify: "${message}"`;

        const result = await ai.models.generateContent({
          model: config.gemini.fastModel,
          contents: classifierPrompt,
          config: { responseMimeType: "application/json" },
        });

        let responseText = result.text || "{}";
        if (responseText.includes("```")) {
          responseText = responseText.replace(/```json/i, "").replace(/```/g, "");
        }
        responseText = responseText.trim();
        const startIdx = responseText.indexOf("{");
        const endIdx = responseText.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
          responseText = responseText.substring(startIdx, endIdx + 1);
        }

        const parsed = JSON.parse(responseText);
        if (parsed?.intent && ["product", "delivery", "service", "qa"].includes(parsed.intent)) {
          intent = parsed.intent as Intent;
        }
        if (typeof parsed?.isRelated === "boolean") {
          isRelated = parsed.isRelated;
        }
        if (parsed?.searchTerms && Array.isArray(parsed.searchTerms)) {
          llmSearchTerms = (parsed.searchTerms as unknown[])
            .map((item): SearchTermConfig | null => {
              if (typeof item === "string" && item.trim().length > 0) {
                return { term: item.trim().toLowerCase(), minPrice: null, maxPrice: null };
              }
              if (item && typeof item === "object") {
                const obj = item as any;
                if (typeof obj.term === "string" && obj.term.trim().length > 0) {
                  return {
                    term: obj.term.trim().toLowerCase(),
                    minPrice: typeof obj.minPrice === "number" ? obj.minPrice : null,
                    maxPrice: typeof obj.maxPrice === "number" ? obj.maxPrice : null,
                  };
                }
              }
              return null;
            })
            .filter((x): x is SearchTermConfig => x !== null)
            .slice(0, 3);
        }
        if (llmSearchTerms.length === 0 && parsed?.searchQuery && typeof parsed.searchQuery === "string") {
          llmSearchTerms = [{ term: parsed.searchQuery.trim().toLowerCase(), minPrice: null, maxPrice: null }];
        }

        console.log(`[Intent] "${message.substring(0, 60)}" → ${intent} (isRelated: ${isRelated})`);
      } catch (err) {
        console.error("[Intent] classification failed:", (err as Error).message);
      }
    }

    if (hasSelectedProducts) {
      intent = "product";
      isRelated = true;
    }

    // 7. Load checkout state and saved address
    const checkoutState = await getCheckoutState(sessionId);
    const savedAddr = USER_DEFAULTS[userId] || null;

    // 8. Router Agent decision (replaces all regex intercepts)
    let routerDecision: RouterDecision = { action: "shop", reason: "default" };
    if (ai) {
      routerDecision = await routerAgent(
        message,
        historySnippet,
        checkoutState,
        intent,
        ai,
        config.gemini.fastModel
      );
    } else if (checkoutState) {
      // No AI — if checkout is active, try to continue
      routerDecision = { action: "checkout_continue", reason: "No AI — fallback checkout_continue" };
    }

    // 9. Build SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        // ── Helper: stream text word by word ──────────────────────────────
        const streamWords = async (text: string) => {
          const words = text.split(" ");
          for (let i = 0; i < words.length; i++) {
            send({ type: "text", content: words[i] + (i === words.length - 1 ? "" : " ") });
            await new Promise((r) => setTimeout(r, 22));
          }
        };

        // ── Helper: geocode a free-form location text ──────────────────────
        const geocodeLocation = async (
          locationText: string
        ): Promise<{ lat: number; lng: number; formattedAddress: string; label: string } | null> => {
          const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (!mapsKey) return null;
          try {
            const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
              locationText + ", Sri Lanka"
            )}&region=lk&key=${mapsKey}`;
            const geoRes = await fetch(geoUrl);
            if (!geoRes.ok) return null;
            const geoData = await geoRes.json();
            if (geoData.status !== "OK" || !geoData.results?.[0]) return null;
            const result = geoData.results[0];
            const { lat, lng } = result.geometry.location;
            const formattedAddress = result.formatted_address;
            const comps = result.address_components || [];
            const label =
              comps.find((c: any) => c.types.includes("locality"))?.long_name ||
              comps.find((c: any) => c.types.includes("administrative_area_level_3"))?.long_name ||
              formattedAddress.split(",")[0];
            return { lat, lng, formattedAddress, label };
          } catch {
            return null;
          }
        };

        // ── Helper: save assistant message with order step to DB ──────────
        const saveOrderMessage = async (
          text: string,
          orderFlowStepPayload: Record<string, unknown>
        ) => {
          await prisma.chatMessage.create({
            data: {
              sessionId,
              role: "assistant",
              content: text,
              thoughtProcess: JSON.stringify({
                steps: [
                  {
                    step: "order_agent",
                    status: "completed",
                    content: `Phase: ${orderFlowStepPayload.phase}`,
                    durationMs: 0,
                  },
                ],
                intent: "product",
                orderFlowStep: orderFlowStepPayload,
              }),
            },
          });
        };

        // ── Helper: load user cart from DB ────────────────────────────────
        const loadUserCart = async (): Promise<any[]> => {
          const currentUserId = session?.userId || userId || "guest";
          try {
            const userWithCart = await (prisma.user as any).findUnique({
              where: { id: currentUserId },
            });
            if (!userWithCart?.cart) return [];
            const cartObj =
              typeof userWithCart.cart === "string"
                ? JSON.parse(userWithCart.cart as string)
                : (userWithCart.cart as Record<string, any[]>);
            if (cartObj && typeof cartObj === "object" && !Array.isArray(cartObj)) {
              return cartObj[sessionId] || [];
            }
            return [];
          } catch {
            return [];
          }
        };

        // ── Helper: save cart to DB ────────────────────────────────────────
        const saveUserCart = async (cartItems: any[]) => {
          const currentUserId = session?.userId || userId || "guest";
          try {
            const userWithCart = await (prisma.user as any).findUnique({
              where: { id: currentUserId },
            });
            let cartObj: Record<string, any[]> = {};
            if (userWithCart?.cart) {
              const parsed =
                typeof userWithCart.cart === "string"
                  ? JSON.parse(userWithCart.cart as string)
                  : userWithCart.cart;
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                cartObj = parsed;
              }
            }
            cartObj[sessionId] = cartItems;
            await (prisma.user as any).update({
              where: { id: currentUserId },
              data: { cart: cartObj },
            });
          } catch (err) {
            console.error("[saveUserCart] failed:", err);
          }
        };

        // ══════════════════════════════════════════════════════════════════
        // ROUTING — Switch on Router Agent decision
        // ══════════════════════════════════════════════════════════════════

        const { action } = routerDecision;

        // ── Action: checkout_cancel ────────────────────────────────────────
        if (action === "checkout_cancel") {
          send({ type: "thought", step: "order_agent", status: "running", content: "Cancelling checkout..." });
          await clearCheckoutState(sessionId);
          await saveUserCart([]);

          const ofs = { phase: "cancelled", cartItems: [] };
          send({ type: "order_flow_step", ...ofs });
          send({ type: "thought", step: "order_agent", status: "completed", content: "Checkout cancelled.", durationMs: 0 });

          const t = "No problem! I've cancelled your checkout and cleared your cart. Let me know whenever you'd like to search for something!";
          await streamWords(t);
          await saveOrderMessage(t, ofs);
          controller.close();
          return;
        }

        // ── Action: checkout_start ─────────────────────────────────────────
        if (action === "checkout_start") {
          let currentCart = await loadUserCart();

          // Merge selected products from UI buttons
          if (fetchedSelectedProducts.length > 0) {
            for (const p of fetchedSelectedProducts as any[]) {
              const existingIdx = currentCart.findIndex((item) => item.id === p.id);
              if (existingIdx > -1) {
                currentCart[existingIdx].quantity += 1;
              } else {
                currentCart.push({
                  id: p.id,
                  name: p.name || p.title || "Kapruka Product",
                  price: p.price || 0,
                  quantity: 1,
                  imageUrl: p.imageUrl || p.image,
                  inStock: p.inStock !== false,
                });
              }
            }
            await saveUserCart(currentCart);
          }

          if (currentCart.length === 0) {
            const ofs = { phase: "qty_ask", cartItems: [] };
            send({ type: "order_flow_step", ...ofs });
            const t = "Your cart is currently empty. Please select products from the search results and click 'Add to Cart' first!";
            await streamWords(t);
            await saveOrderMessage(t, ofs);
            controller.close();
            return;
          }

          // Stock check
          send({ type: "thought", step: "checking_stock", status: "running", content: `Checking stock for ${currentCart.length} item(s)...` });
          const freshCart = await Promise.all(
            currentCart.map(async (item) => {
              const fresh = await pillar1_getProductDetails(item.id).catch(() => null as any);
              return {
                ...item,
                inStock: fresh ? fresh.inStock !== false : item.inStock,
                stockQty: (fresh as any)?.stockQty ?? 50,
              };
            })
          );
          currentCart = freshCart;
          await saveUserCart(currentCart);
          send({ type: "thought", step: "checking_stock", status: "completed", content: "Stock check complete.", durationMs: 0 });

          const outOfStockItems = currentCart.filter((item) => !item.inStock);
          if (outOfStockItems.length > 0) {
            const names = outOfStockItems.map((i) => `**${i.name}**`).join(", ");
            const ofs = { phase: "out_of_stock", cartItems: currentCart };
            send({ type: "order_flow_step", ...ofs });
            const t = `Sorry, some items are currently out of stock: ${names}. Please remove them or choose different products!`;
            await streamWords(t);
            await saveOrderMessage(t, ofs);
            controller.close();
            return;
          }

          // Save checkout session state
          const newCheckoutState: CheckoutState = {
            phase: "qty_ask",
            cartItems: currentCart,
            savedAddress: savedAddr ?? undefined,
          };
          await saveCheckoutState(sessionId, newCheckoutState);

          const total = currentCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
          const ofs = { phase: "qty_ask", cartItems: currentCart, savedAddress: savedAddr };
          send({ type: "order_flow_step", ...ofs });
          const t = `I've loaded your cart for checkout 📦 You have **${currentCart.length} item(s)** (Subtotal: Rs. ${total.toLocaleString()}). Please confirm the quantities and click next when ready.`;
          await streamWords(t);
          await saveOrderMessage(t, ofs);
          controller.close();
          return;
        }

        // ── Action: cart_modify ────────────────────────────────────────────
        if (action === "cart_modify" && checkoutState) {
          send({ type: "thought", step: "cart_agent", status: "running", content: "Cart Modifier Agent: understanding your request..." });

          const currentCart = await loadUserCart();

          // Fetch products from the last assistant response to serve as contextual available products
          let availableProducts: any[] = [];
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
              if (!availableProducts.some((ap) => ap.id === fp.id)) {
                availableProducts.push(fp);
              }
            }
          }

          let modification: CartModification = {
            type: "remove" as any,
            itemId: null,
            itemName: null,
            newQty: null,
            itemsToAdd: null,
            responseText: "Your cart has been updated.",
            updatedCart: currentCart,
          };

          if (ai) {
            modification = await cartModifierAgent(message, currentCart, availableProducts, ai, config.gemini.fastModel);
          }

          send({ type: "thought", step: "cart_agent", status: "completed", content: `Cart: ${modification.type} ${modification.type === "add" ? `${modification.itemsToAdd?.length ?? 0} item(s)` : `"${modification.itemName}"`}`, durationMs: 0 });

          // Apply and persist
          await saveUserCart(modification.updatedCart);

          // Update the checkout session's cartItems too
          if (checkoutState) {
            let nextPhase = checkoutState.phase;
            let resetConfirmedQty = checkoutState.confirmedQty;

            // If items are added, reset checkout phase to qty_ask so user can confirm
            if (modification.type === "add") {
              nextPhase = "qty_ask";
              resetConfirmedQty = undefined;
            }

            const updatedState: CheckoutState = {
              ...checkoutState,
              cartItems: modification.updatedCart,
              phase: nextPhase,
              confirmedQty: resetConfirmedQty,
            };

            if (modification.updatedCart.length === 0) {
              // Cart is now empty — cancel checkout
              await clearCheckoutState(sessionId);
              const ofs = { phase: "cancelled", cartItems: [] };
              send({ type: "order_flow_step", ...ofs });
              await streamWords("Your cart is now empty. Checkout has been cancelled. Feel free to search for more products!");
              await saveOrderMessage("Your cart is now empty. Checkout has been cancelled. Feel free to search for more products!", ofs);
              controller.close();
              return;
            } else {
              await saveCheckoutState(sessionId, updatedState);
              // Update the UI checkout card with new cart
              const ofs = {
                phase: updatedState.phase,
                cartItems: modification.updatedCart,
                savedAddress: updatedState.savedAddress,
                confirmedQuantity: updatedState.confirmedQty,
                confirmedAddress: updatedState.confirmedAddress,
                geocodedLocation: updatedState.geocodedLocation,
                paymentMethod: updatedState.paymentMethod,
              };
              send({ type: "order_flow_step", ...ofs });
            }
          }

          await streamWords(modification.responseText);
          await prisma.chatMessage.create({
            data: {
              sessionId,
              role: "assistant",
              content: modification.responseText,
              thoughtProcess: JSON.stringify({
                steps: [{ step: "cart_agent", status: "completed", content: `Cart modified: ${modification.type}`, durationMs: 0 }],
                intent: "product",
                orderFlowStep: checkoutState
                  ? {
                      phase: modification.type === "add" ? "qty_ask" : checkoutState.phase,
                      cartItems: modification.updatedCart,
                      savedAddress: checkoutState.savedAddress,
                      confirmedQuantity: modification.type === "add" ? undefined : checkoutState.confirmedQty,
                      confirmedAddress: checkoutState.confirmedAddress,
                      geocodedLocation: checkoutState.geocodedLocation,
                      paymentMethod: checkoutState.paymentMethod,
                    }
                  : undefined,
              }),
            },
          });
          controller.close();
          return;
        }

        // ── Action: checkout_continue ──────────────────────────────────────
        if (action === "checkout_continue" && checkoutState) {
          send({ type: "thought", step: "order_agent", status: "running", content: `Order Agent: processing phase "${checkoutState.phase}"...` });

          let agentOutput = {
            nextPhase: "stay" as any,
            stay: true,
            extractedData: {} as any,
            responseText: "I didn't quite catch that. Could you please clarify?",
            requiresGeocode: false,
            requiresOrderPlace: false,
          };

          if (ai) {
            agentOutput = await orderAgent(message, checkoutState, ai, config.gemini.fastModel);
          }

          send({ type: "thought", step: "order_agent", status: "completed", content: `Phase transition: ${checkoutState.phase} → ${agentOutput.nextPhase}`, durationMs: 0 });

          // Apply extracted data to checkout state
          let updatedState: CheckoutState = { ...checkoutState };

          const { extractedData } = agentOutput;

          if (extractedData.quantity) {
            updatedState.confirmedQty = extractedData.quantity;
          }
          if (extractedData.updatedCartItems) {
            updatedState.cartItems = extractedData.updatedCartItems;
            await saveUserCart(extractedData.updatedCartItems);
          }
          if (extractedData.usesSavedAddress === true && savedAddr) {
            updatedState.confirmedAddress = savedAddr;
          }
          if (extractedData.paymentMethod) {
            updatedState.paymentMethod = extractedData.paymentMethod;
          }

          // Determine the actual next phase
          const nextPhase = agentOutput.stay ? checkoutState.phase : agentOutput.nextPhase;
          updatedState.phase = nextPhase;

          // Handle geocoding for address_ask → map_open
          const isTransitioningToMap = checkoutState.phase === "address_ask" && nextPhase === "map_open";
          const addressToGeocode = extractedData.addressText || (isTransitioningToMap ? message : null);

          if ((agentOutput.requiresGeocode || isTransitioningToMap) && addressToGeocode) {
            send({ type: "thought", step: "geocoding", status: "running", content: `Geocoding: "${addressToGeocode}"...` });
            const geo = await geocodeLocation(addressToGeocode);
            send({ type: "thought", step: "geocoding", status: "completed", content: geo ? `Found: ${geo.label}` : `Default: Colombo (Query: "${addressToGeocode}")`, durationMs: 0 });
            updatedState.geocodedLocation = geo ?? { lat: 6.9271, lng: 79.8612, formattedAddress: addressToGeocode, label: addressToGeocode };
          }

          // Handle map_open confirmation: parse "Confirm location: <address>, <city>" from UI
          if (checkoutState.phase === "map_open" && /^confirm location:/i.test(message.trim())) {
            const locationMatch = message.match(/confirm location:\s*(.+),\s*([^,]+)$/i);
            if (locationMatch) {
              updatedState.confirmedAddress = {
                name: savedAddr?.name || "Customer",
                phone: savedAddr?.phone || "",
                address: locationMatch[1].trim(),
                city: locationMatch[2].trim(),
              };
            }
          }



          // Handle order placement (payment_ask → confirmed)
          if (agentOutput.requiresOrderPlace) {
            send({ type: "thought", step: "placing_order", status: "running", content: "Placing order via Kapruka..." });

            let checkoutUrl: string | undefined;
            let orderId: string | undefined;

            try {
              const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
              const cartItems = updatedState.cartItems || [];
              const confirmedAddress = updatedState.confirmedAddress;
              const paymentMethod = updatedState.paymentMethod || "cod";

              const orderItems = cartItems.map((i: any) => ({
                productId: i.id,
                productName: i.name,
                quantity: i.quantity,
                priceLKR: i.price,
                imageUrl: i.imageUrl,
              }));

              const orderRes = await fetch(`${baseUrl}/api/order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  items: orderItems,
                  recipient: confirmedAddress,
                  sessionId,
                  userId,
                  paymentMethod,
                }),
              });

              if (orderRes.ok) {
                const od = await orderRes.json();
                checkoutUrl = od.checkoutLink?.checkoutUrl;
                orderId = od.orderResult?.orderId || `ord-${Date.now()}`;

                // Clear cart and checkout session on success
                await saveUserCart([]);
                await clearCheckoutState(sessionId);
              }
            } catch (err) {
              console.error("[OrderAgent] place order failed:", err);
            }

            send({ type: "thought", step: "placing_order", status: "completed", content: "Order placed ✓", durationMs: 0 });

            const cartItems = updatedState.cartItems || [];
            const totalLKR = cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
            const itemsListStr = cartItems.map((i: any) => `${i.quantity}x **${i.name}**`).join(", ");

            const confirmationText =
              updatedState.paymentMethod === "cod"
                ? `Your order for ${itemsListStr} is confirmed! 🎉 Our courier will deliver and collect **Rs. ${totalLKR.toLocaleString()}** in cash on arrival.`
                : `Your order for ${itemsListStr} is confirmed! 🎉 Complete the payment via the secure link below to finalise your order.`;

            const cs = {
              phase: "confirmed",
              cartItems,
              confirmedAddress: updatedState.confirmedAddress,
              paymentMethod: updatedState.paymentMethod,
              checkoutUrl,
              orderId,
            };
            send({ type: "order_flow_step", ...cs });
            await streamWords(confirmationText);
            await saveOrderMessage(confirmationText, cs);
            controller.close();
            return;
          }

          // Save updated state (phase advanced)
          if (!agentOutput.requiresOrderPlace) {
            await saveCheckoutState(sessionId, updatedState);
          }

          // Build the SSE order_flow_step packet for the UI
          const ofs: Record<string, unknown> = {
            phase: updatedState.phase,
            cartItems: updatedState.cartItems,
            savedAddress: updatedState.savedAddress,
            confirmedQuantity: updatedState.confirmedQty,
            confirmedAddress: updatedState.confirmedAddress,
            geocodedLocation: updatedState.geocodedLocation,
            paymentMethod: updatedState.paymentMethod,
          };
          if (updatedState.product) ofs.product = updatedState.product;
          send({ type: "order_flow_step", ...ofs });

          await streamWords(agentOutput.responseText);
          await saveOrderMessage(agentOutput.responseText, ofs);
          controller.close();
          return;
        }

        // ── Action: checkout_pause ─────────────────────────────────────────
        // Falls through to the normal shop flow below, but with checkout context
        // injected into the LLM prompt so the agent knows checkout is paused.

        // ── Action: shop (+ checkout_pause) ───────────────────────────────
        // Everything below is the UNCHANGED product search / delivery / services / QA flow.

        if (!isRelated) {
          send({ type: "thought", step: "intent_routing", status: "completed", content: "Checking query appropriateness...", durationMs: 0 });

          const refusalText = "That's an interesting question! My expertise is shopping and product assistance. If you're looking for a product, need recommendations, or have questions about an order, I'd be happy to help.";
          const words = refusalText.split(" ");
          for (let i = 0; i < words.length; i++) {
            send({ type: "text", content: words[i] + (i === words.length - 1 ? "" : " ") });
            await new Promise((r) => setTimeout(r, 40));
          }

          const followUps = STATIC_FOLLOW_UPS["product"];
          send({ type: "follow_ups", questions: followUps });

          await prisma.chatMessage.create({
            data: {
              sessionId: sessionId,
              role: "assistant",
              content: refusalText,
              thoughtProcess: JSON.stringify({
                steps: [{ step: "intent_routing", status: "completed", content: "Query filtered by guardrails.", durationMs: 0 }],
                intent: "qa",
                followUpQuestions: followUps,
              }),
            },
          });

          controller.close();
          return;
        }

        const steps: Array<{ step: string; status: string; content: string; durationMs: number }> = [];
        let products: KaprukaProduct[] = [];
        let productGroups: Array<{ title: string; products: KaprukaProduct[] }> = [];
        let fullResponseText = "";
        let groundingSourcesList: Array<{ title: string; uri: string }> = [];
        let pastOrdersContext = "";
        let criteria: any = null;

        // ── Pillar 1: Product Search ─────────────────────────────────────
        if (intent === "product") {
          if (hasSelectedProducts && fetchedSelectedProducts.length > 0) {
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Processing ${selectedProductIds.length} selected product(s)...`, durationMs: 0 });
            send({ type: "thought", step: "fetching_product_details", status: "running", content: "Fetching selected product details..." });
            send({ type: "tool_call", name: "kapruka_get_product", args: { productIds: selectedProductIds } });
            products = fetchedSelectedProducts;
            const step2 = { step: "fetching_product_details", status: "completed", content: `Retrieved ${products.length} product(s).`, durationMs: 0 };
            steps.push(step2);
            send({ type: "thought", ...step2 });
            send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });
          } else {
            send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Kapruka product catalog..." });
            criteria = parseRequirements(message);

            const isReorderQuery = /reorder|ordered|bought|purchased|past order|history/.test(message.toLowerCase());

            if (isReorderQuery) {
              const step1 = { step: "intent_routing", status: "completed", content: "Identified as: Order History Lookup.", durationMs: 0 };
              steps.push(step1);
              send({ type: "thought", ...step1 });
              send({ type: "thought", step: "searching_kapruka", status: "running", content: "Retrieving user's order history..." });

              if (userId && userId !== "guest") {
                const userWithOrders = await prisma.user.findUnique({
                  where: { id: userId },
                  include: { orders: { include: { items: true }, orderBy: { createdAt: "desc" } } },
                });

                let orderProducts: KaprukaProduct[] = [];
                if (userWithOrders && userWithOrders.orders.length > 0) {
                  pastOrdersContext = `\n\n[User's Past Orders] You have access to the user's transaction history. The user (${userWithOrders.name}) has placed the following orders in the past:\n`;
                  for (const order of userWithOrders.orders) {
                    pastOrdersContext += `- Order Ref: ${order.id}, Date: ${order.createdAt.toISOString().split("T")[0]}, Status: ${order.status}, Total: LKR ${order.totalLKR}\n`;
                    for (const item of order.items) {
                      pastOrdersContext += `  * Item: ${item.productName} (ID: ${item.productId}), Qty: ${item.quantity}, Price: LKR ${item.priceLKR}\n`;
                      orderProducts.push({
                        id: item.productId,
                        name: item.productName,
                        price: item.priceLKR,
                        currency: "LKR",
                        inStock: true,
                        imageUrl: item.imageUrl || undefined,
                        url: `https://www.kapruka.com/buyonline/${item.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/kid/${item.productId}`,
                      });
                    }
                  }
                  const seenIds = new Set<string>();
                  products = orderProducts.filter((p) => { if (seenIds.has(p.id)) return false; seenIds.add(p.id); return true; });
                  pastOrdersContext += `\nInstruction to AI: The user wants to reorder a previous purchase. Confirm the details of the item they are referring to (item name, price, order date) and recommend they click the 'Buy Now' button to reorder.`;
                } else {
                  pastOrdersContext = `\n\n[User's Past Orders] The user (${userWithOrders?.name || "Unknown"}) has no past order history. Explain this politely.`;
                }
              } else {
                pastOrdersContext = `\n\n[User's Past Orders] The user is a guest and has no order history. Prompt them to select a user profile.`;
              }

              const step2 = { step: "searching_kapruka", status: "completed", content: products.length > 0 ? `Retrieved ${products.length} product(s) from past order history.` : "No past purchases found.", durationMs: 0 };
              steps.push(step2);
              send({ type: "thought", ...step2 });
              send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });
            } else {
              // ── Parallel per-intent search pipelines ──────────────────
              const reorderForKapruka = (term: string): string[] => {
                const words = term.trim().split(/\s+/);
                if (words.length <= 1) return [term];
                if (words.length === 2) { const reordered = `${words[1]} ${words[0]}`; return [reordered, words[1]]; }
                return [words[words.length - 1], term];
              };

              const baseLlmTerms: SearchTermConfig[] = (
                llmSearchTerms.length > 0
                  ? llmSearchTerms
                  : criteria.keywords.length > 0
                    ? [{ term: criteria.keywords[0], minPrice: null, maxPrice: null }]
                    : [{ term: message.split(" ").find((w: string) => w.length > 2) || message.split(" ")[0], minPrice: null, maxPrice: null }]
              ).slice(0, 3);

              const searchDisplay = baseLlmTerms.map((t: SearchTermConfig) => {
                let limitStr = "";
                if (t.minPrice !== null && t.maxPrice !== null) limitStr = ` (Rs. ${t.minPrice} - ${t.maxPrice})`;
                else if (t.minPrice !== null) limitStr = ` (above Rs. ${t.minPrice})`;
                else if (t.maxPrice !== null) limitStr = ` (under Rs. ${t.maxPrice})`;
                return `"${t.term}"${limitStr}`;
              }).join(", ");

              const step1 = { step: "intent_routing", status: "completed", content: `Identified as: Product Search. Terms: ${searchDisplay}${criteria.maxPrice ? `. Max price: Rs. ${criteria.maxPrice.toLocaleString()}` : ""}`, durationMs: 0 };
              steps.push(step1);
              send({ type: "thought", ...step1 });

              const runSearchPipeline = async (termConfig: SearchTermConfig, pipelineIndex: number): Promise<{ term: string; products: KaprukaProduct[]; discardedCount: number }> => {
                const baseTerm = termConfig.term;
                const variants = reorderForKapruka(baseTerm);
                const queryMaxPrice = termConfig.maxPrice ?? criteria.maxPrice;

                send({ type: "tool_call", name: "kapruka_search_products", args: { query: baseTerm, max_price: queryMaxPrice } });
                send({ type: "thought", step: "searching_kapruka", term: baseTerm, status: "running", content: `Searching Kapruka for "${baseTerm}"...` });

                const t1 = Date.now();
                const variantSettled = await Promise.allSettled(
                  variants.map((v, vi) =>
                    new Promise<KaprukaProduct[]>((resolve, reject) => {
                      setTimeout(() => {
                        pillar1_searchProducts(v, { maxPriceLKR: queryMaxPrice ?? undefined, smeFirst: false, limit: 30, currency: currency || "LKR" })
                          .then(resolve).catch(reject);
                      }, vi * 120);
                    })
                  )
                );
                const searchDur = Date.now() - t1;

                const seenIds = new Set<string>();
                const rawProducts: KaprukaProduct[] = [];
                for (const settled of variantSettled) {
                  if (settled.status === "fulfilled") {
                    for (const p of settled.value) {
                      if (!seenIds.has(p.id)) { seenIds.add(p.id); rawProducts.push(p); }
                    }
                  }
                }

                let filteredPriceProducts = rawProducts;
                let priceFilterDiscarded = 0;
                if (termConfig.minPrice !== null || termConfig.maxPrice !== null) {
                  filteredPriceProducts = rawProducts.filter((p) => {
                    if (termConfig.minPrice !== null && p.price < termConfig.minPrice) return false;
                    if (termConfig.maxPrice !== null && p.price > termConfig.maxPrice) return false;
                    return true;
                  });
                  priceFilterDiscarded = rawProducts.length - filteredPriceProducts.length;
                }

                send({ type: "thought", step: "searching_kapruka", term: baseTerm, status: "completed", content: `Found ${filteredPriceProducts.length} raw result${filteredPriceProducts.length !== 1 ? "s" : ""} for "${baseTerm}" in ${searchDur}ms.` + (priceFilterDiscarded > 0 ? ` (Filtered out ${priceFilterDiscarded} product(s) outside price limits)` : ""), durationMs: searchDur });

                // Bypass keyword-based scoring/filtering. Rely on raw search engine relevance and AI validator.
                const keywordFiltered: KaprukaProduct[] = filteredPriceProducts.map((p) => ({ ...p, _relevanceScore: 10 }));
                const keywordDiscarded = priceFilterDiscarded;

                let validated = keywordFiltered;
                let llmDiscarded = 0;

                if (ai && keywordFiltered.length > 0) {
                  send({ type: "thought", step: "validating_relevance", term: baseTerm, status: "running", content: `Validating ${keywordFiltered.length} result${keywordFiltered.length !== 1 ? "s" : ""} for "${baseTerm}"...` });
                  const t2 = Date.now();
                  validated = await llmValidateRelevance(keywordFiltered, baseTerm, message, ai, config.gemini.fastModel);
                  const validationDur = Date.now() - t2;
                  llmDiscarded = keywordFiltered.length - validated.length;
                  send({ type: "thought", step: "validating_relevance", term: baseTerm, status: "completed", content: llmDiscarded > 0 ? `Relevance check: ✓ kept ${validated.length}, removed ${llmDiscarded} irrelevant.` : `All ${validated.length} result${validated.length !== 1 ? "s" : ""} passed ✓`, durationMs: validationDur });
                }

                const totalDiscarded = keywordDiscarded + llmDiscarded;
                send({ type: "group_ready", term: baseTerm, products: validated, index: pipelineIndex, discardedCount: totalDiscarded });
                return { term: baseTerm, products: validated, discardedCount: totalDiscarded };
              };

              const tPipelines = Date.now();
              const pipelineResults = await Promise.allSettled(baseLlmTerms.map((tConfig: SearchTermConfig, index: number) => runSearchPipeline(tConfig, index)));
              const pipelinesDur = Date.now() - tPipelines;

              const groups: Array<{ title: string; products: KaprukaProduct[] }> = [];
              const notFoundOriginalTerms: string[] = [];
              let totalDiscardedAll = 0;

              for (let i = 0; i < pipelineResults.length; i++) {
                const settled = pipelineResults[i];
                const baseTerm = baseLlmTerms[i].term;
                if (settled.status === "fulfilled" && settled.value.products.length > 0) {
                  const title = baseTerm.replace(/\b\w/g, (c: string) => c.toUpperCase());
                  groups.push({ title, products: settled.value.products });
                  totalDiscardedAll += settled.value.discardedCount;
                } else {
                  notFoundOriginalTerms.push(baseTerm);
                }
              }

              productGroups = groups;
              products = groups.flatMap((g) => g.products);

              const step2 = {
                step: "searching_kapruka",
                status: "completed",
                content: products.length > 0
                  ? `All ${baseLlmTerms.length} search pipeline${baseLlmTerms.length > 1 ? "s" : ""} complete in ${pipelinesDur}ms — ${products.length} validated product${products.length !== 1 ? "s" : ""}${totalDiscardedAll > 0 ? `, ${totalDiscardedAll} irrelevant filtered out` : ""}${notFoundOriginalTerms.length > 0 ? `. Not found: ${notFoundOriginalTerms.map((t: string) => `"${t}"`).join(", ")}` : ""}.`
                  : "No matching products found after relevance filtering.",
                durationMs: pipelinesDur,
                terms: baseLlmTerms.map((t) => t.term),
              };
              steps.push(step2);
              send({ type: "thought", ...step2 });
              send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });
              send({ type: "product_groups", groups: productGroups });

              (criteria as typeof criteria & { _notFoundTerms?: string[] })._notFoundTerms = notFoundOriginalTerms;
            }
          }
        }

        // ── Pillar 3: SME/Partner Central ──────────────────────────────
        if (intent === "product") {
          const smeQuery = /artisan|local.*brand|sri lankan.*made|handmade|sme|small.*business|partner central|local.*gift/.test(message.toLowerCase());
          if (smeQuery) {
            send({ type: "thought", step: "sme_filter", status: "running", content: "Highlighting local Sri Lankan SME products..." });
            const t3 = Date.now();
            const smeProducts = await pillar3_searchSMEProducts(message, { maxPriceLKR: criteria?.maxPrice, limit: 50, currency: currency || "USD" });
            const dur3 = Date.now() - t3;
            if (smeProducts.length > 0) {
              products = smeProducts;
              const step3 = { step: "sme_filter", status: "completed", content: `Found ${smeProducts.filter((p) => p.isSME).length} verified local Sri Lankan SME products.`, durationMs: dur3 };
              steps.push(step3);
              send({ type: "thought", ...step3 });
              send({ type: "tool_result", toolName: "kapruka_search_products_sme", result: { products } });
            }
          }
        }

        // ── Pillar 2: Delivery / Tracking ──────────────────────────────
        if (intent === "delivery") {
          send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Grasshoppers logistics network..." });
          const orderId = extractOrderId(message);
          const city = extractCityFromMessage(message);
          const date = extractDate(message);
          const isPerishable = /cake|flower|food|perishable|fresh/.test(message.toLowerCase());

          if (orderId) {
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Tracking order: ${orderId}`, durationMs: 0 });
            send({ type: "thought", step: "tracking_order", status: "running", content: `Fetching live status for order ${orderId}...` });
            send({ type: "tool_call", name: "kapruka_track_order", args: { order_id: orderId } });
            const t = Date.now();
            const tracking = await pillar2_trackOrder(orderId);
            const dur = Date.now() - t;
            if (tracking) {
              steps.push({ step: "tracking_order", status: "completed", content: `Order ${orderId} status: ${tracking.currentStatus}`, durationMs: dur });
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Order status retrieved successfully.", durationMs: dur });
              send({ type: "tracking_result", result: tracking });
            } else {
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Could not retrieve order status.", durationMs: dur });
            }
          } else if (city) {
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Checking Grasshoppers delivery to ${city}`, durationMs: 0 });
            send({ type: "thought", step: "checking_delivery", status: "running", content: `Checking delivery availability to ${city} on ${date}${isPerishable ? " (perishable)" : ""}...` });
            send({ type: "tool_call", name: "kapruka_check_delivery", args: { city, date, is_perishable: isPerishable } });
            const t = Date.now();
            const delivery = await pillar2_checkDelivery(city, date, isPerishable);
            const dur = Date.now() - t;
            if (delivery) {
              steps.push({ step: "checking_delivery", status: "completed", content: `Delivery to ${city}: ${delivery.canDeliver ? "Available" : "Not available"}. Rate: Rs. ${delivery.flatRateLKR?.toLocaleString() || "N/A"}`, durationMs: dur });
              send({ type: "thought", step: "checking_delivery", status: "completed", content: `Delivery check complete for ${city}.`, durationMs: dur });
              send({ type: "delivery_result", result: delivery });
            } else {
              steps.push({ step: "checking_delivery", status: "completed", content: `Checking nearest cities to ${city}...`, durationMs: dur });
              send({ type: "thought", step: "checking_delivery", status: "completed", content: `No exact match for "${city}". Showing nearest covered cities.`, durationMs: dur });
              send({ type: "tool_call", name: "kapruka_list_delivery_cities", args: { query: city } });
              const cities = await pillar2_findCity(city);
              send({ type: "city_suggestions", result: { cities, query: city } });
            }
          } else {
            send({ type: "thought", step: "intent_routing", status: "completed", content: "Need city name or order ID to proceed.", durationMs: 0 });
          }
        }

        // ── Pillar 5: Services Platform ────────────────────────────────
        if (intent === "service") {
          send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Home Services Platform..." });
          const category = pillar5_detectServiceCategory(message);
          const city = extractCityFromMessage(message);
          send({ type: "thought", step: "intent_routing", status: "completed", content: `Service category: ${category}${city ? `. City: ${city}` : " (city needed)"}`, durationMs: 0 });
          send({ type: "thought", step: "finding_providers", status: "running", content: `Searching verified ${category.replace("_", " ")} providers${city ? ` in ${city}` : ""}...` });
          send({ type: "tool_call", name: "kapruka_service_search", args: { category, city } });
          const t = Date.now();
          const serviceResult = await pillar5_searchServiceProviders(category, city || undefined);
          const dur = Date.now() - t;
          steps.push({ step: "finding_providers", status: "completed", content: serviceResult.needsCityInput ? "Awaiting city input from user." : `Found ${serviceResult.providers.length} verified ${serviceResult.categoryLabel} providers.`, durationMs: dur });
          send({ type: "thought", step: "finding_providers", status: "completed", content: steps[steps.length - 1].content, durationMs: dur });
          send({ type: "service_listing", result: serviceResult });
        }

        // ── QA intent ─────────────────────────────────────────────────
        if (intent === "qa") {
          send({ type: "thought", step: "google_search_grounding", status: "running", content: "Launching Google Search for real-time information..." });
          const step1 = { step: "google_search_grounding", status: "completed", content: "Identified as: Information query. Querying Google Search.", durationMs: 0 };
          steps.push(step1);
          send({ type: "thought", ...step1 });
        }

        // ── LLM Main Response Generation ───────────────────────────────
        send({ type: "thought", step: "generating_response", status: "running", content: "Generating AI response..." });

        if (ai) {
          try {
            const geminiHistory = chatHistory.map((m: { role: string; content: string }) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            }));

            let contextNote = "";

            if (intent === "product") {
              if (hasSelectedProducts && products.length > 0) {
                contextNote = `\n\n[Selected Products Context — User is asking about these specific products]\n` +
                  products.map((p, idx) => {
                    const richInfo = { id: p.id, name: p.name, price: p.price, compare_at_price: p.originalPrice || null, currency: p.currency, in_stock: p.inStock, category: p.category, description: p.description, url: p.url, variants: p.variants || [], attributes: p.attributes || {}, shipping: p.shipping || {} };
                    return `Product ${idx + 1}:\n\`\`\`json\n${JSON.stringify(richInfo, null, 2)}\n\`\`\``;
                  }).join("\n\n") +
                  `\n\n[Instruction] The user has selected the above products and is asking: "${message}". Answer their question directly, conversationally, and specifically using ONLY the product data above. Be warm, helpful, and direct. Do NOT use [INTRO] or [DETAILS] tags.`;
              } else {
                const notFoundTerms: string[] = (criteria as typeof criteria & { _notFoundTerms?: string[] })?._notFoundTerms ?? [];
                if (productGroups && productGroups.length > 0) {
                  contextNote = `\n\n[Validated Product Search Results — All items below have been relevance-validated]\n`;
                  for (const group of productGroups) {
                    contextNote += `\n🔍 "${group.title}" — ${group.products.length} verified match${group.products.length !== 1 ? "es" : ""}:\n`;
                    contextNote += group.products.slice(0, 4).map((p, i) => `  ${i + 1}. ${p.name} — Rs. ${p.price?.toLocaleString() || "N/A"} (${p.inStock ? "✅ In Stock" : "❌ Out of Stock"})${p.isSME ? " 🇱🇰 Local" : ""}`).join("\n") + "\n";
                  }
                  if (notFoundTerms.length > 0) {
                    contextNote += `\n⚠️ NOT FOUND: ${notFoundTerms.map((t) => `"${t}"`).join(", ")} — these items are not available in the Kapruka catalog.`;
                  }
                  contextNote += `\n\n[Response Instructions]
You MUST structure your response for EACH category returned in the search results above using exactly these tags:
- Use \`[INTRO: <CategoryName>]\` followed by a 1-sentence simple introduction.
- Use \`[DETAILS: <CategoryName>]\` followed by a 2-3 sentence detailed comparison, mentioning prices in LKR and stock status.
Make sure the category name in the tags matches the search result headers above exactly. Speak naturally and confidently. Do not write any general text outside these tags.`;
                } else if (products.length > 0) {
                  contextNote = `\n\n[Validated Product Results] ${products.length} item${products.length !== 1 ? "s" : ""} found on Kapruka:\n` +
                    products.slice(0, 6).map((p, i) => `${i + 1}. ${p.name} — Rs. ${p.price?.toLocaleString() || "N/A"} (${p.inStock ? "✅ In Stock" : "❌ Out of Stock"})${p.isSME ? " 🇱🇰 Local" : ""}`).join("\n");
                  if (notFoundTerms.length > 0) {
                    contextNote += `\n\n⚠️ NOT FOUND: ${notFoundTerms.map((t) => `"${t}"`).join(", ")}. Tell the user clearly these are unavailable.`;
                  }
                  contextNote += `\n\n[Response Instructions]\nUse \`[INTRO: Product search]\` followed by a 1-sentence introduction.\nUse \`[DETAILS: Product search]\` followed by 2-3 sentences.`;
                } else {
                  contextNote = `\n\n[Search Result] NO products were found after relevance filtering. Apologize politely and suggest alternatives.`;
                }
              }
            }

            // Checkout pause context: let LLM know there's an active (paused) checkout
            if (action === "checkout_pause" && checkoutState) {
              const cartItems = checkoutState.cartItems ?? [];
              const itemsStr = cartItems.map((i) => `${i.quantity}x ${i.name}`).join(", ") || "No items";
              contextNote += `\n\n[Active Checkout In Progress (PAUSED)]
The user has an active checkout flow in progress.
- Current Checkout Items: ${itemsStr}
- Paused Phase/Step: "${checkoutState.phase}"
- Confirmed Location: ${checkoutState.confirmedAddress ? `${checkoutState.confirmedAddress.address}, ${checkoutState.confirmedAddress.city}` : "None"}

[Instruction]
The user has temporarily paused checkout to ask: "${message}".
1. Answer their current query directly and completely.
2. Do NOT mention, list, or summarize the paused checkout items in your text response (they are shown in the UI).
3. Do NOT ask the user to proceed with the checkout.
4. Keep the tone conversational, friendly, and helpful.`;
            }

            if (pastOrdersContext) {
              contextNote += pastOrdersContext;
            }

            if (geminiHistory.length > 0 && contextNote) {
              const last = geminiHistory[geminiHistory.length - 1];
              geminiHistory[geminiHistory.length - 1] = { ...last, parts: [{ text: last.parts[0].text + contextNote }] };
            }

            const streamConfig: any = {
              systemInstruction: hasSelectedProducts ? SELECTED_PRODUCT_QA_PROMPT : SYSTEM_PROMPTS[intent],
            };
            if (intent === "qa") {
              streamConfig.tools = [{ googleSearch: {} }];
            }

            const geminiStream = await ai.models.generateContentStream({
              model: config.gemini.reasoningModel,
              contents: geminiHistory,
              config: streamConfig,
            });

            let webQueries: string[] = [];

            for await (const chunk of geminiStream) {
              const text = chunk.text;
              if (text) {
                fullResponseText += text;
                send({ type: "text", content: text });
              }

              const metadata = chunk.candidates?.[0]?.groundingMetadata;
              if (metadata?.webSearchQueries) {
                for (const q of metadata.webSearchQueries) {
                  if (!webQueries.includes(q)) {
                    webQueries.push(q);
                    const searchStep = { step: "google_search_query", status: "completed" as const, content: `Searched Google for: "${q}"`, durationMs: 0 };
                    steps.push(searchStep);
                    send({ type: "thought", ...searchStep });
                  }
                }
              }

              if (metadata?.groundingChunks) {
                for (const c of metadata.groundingChunks) {
                  const web = c.web;
                  if (web?.uri) {
                    const title = web.title || new URL(web.uri).hostname;
                    if (!groundingSourcesList.some((gc) => gc.uri === web.uri)) {
                      groundingSourcesList.push({ title, uri: web.uri });
                    }
                  }
                }
              }
            }

            if (groundingSourcesList.length > 0) {
              const sourcesText = "\n\n**Sources:**\n" + groundingSourcesList.map((c, i) => `[${i + 1}] [${c.title}](${c.uri})`).join("\n");
              fullResponseText += sourcesText;
              send({ type: "text", content: sourcesText });
            }
          } catch (err) {
            const errMsg = (err as Error).message;
            console.error("[LLM] Gemini stream error:", errMsg);
            steps.push({ step: "generating_response", status: "completed", content: `Error: ${errMsg}`, durationMs: 0 });
            send({ type: "thought", step: "generating_response", status: "completed", content: `Error generating AI response: ${errMsg}` });
          }
        }

        if (!fullResponseText) {
          fullResponseText = generateFallback(intent, message, products);
          for (const word of fullResponseText.split(" ")) {
            send({ type: "text", content: word + " " });
            await new Promise((r) => setTimeout(r, 35));
          }
        }

        // ── Follow-up suggestions ──────────────────────────────────────
        let followUpQuestions: string[] = [];
        if (ai) {
          try {
            const suggestPrompt = `Given this user query and AI response for a Sri Lankan e-commerce platform, generate exactly 3 short follow-up queries that the user is most likely to ask next (written from the user's perspective as action/search prompts, NOT questions from the system to the user. Max 8 words each).
Context pillar: ${intent}
User: "${message.substring(0, 100)}"
AI: "${fullResponseText.substring(0, 200)}"
Respond ONLY as JSON array: ["query1", "query2", "query3"]`;

            const sug = await ai.models.generateContent({
              model: config.gemini.fastModel,
              contents: suggestPrompt,
              config: { responseMimeType: "application/json" },
            });
            const parsed = JSON.parse(sug.text || "[]");
            if (Array.isArray(parsed) && parsed.length >= 3) {
              followUpQuestions = parsed.slice(0, 3);
            }
          } catch {
            // use static fallbacks
          }
        }

        if (followUpQuestions.length === 0) {
          followUpQuestions = STATIC_FOLLOW_UPS[intent];
        }

        send({ type: "follow_ups", questions: followUpQuestions });

        // ── Save AI response to DB ─────────────────────────────────────
        await prisma.chatMessage.create({
          data: {
            sessionId: sessionId,
            role: "assistant",
            content: fullResponseText,
            thoughtProcess: JSON.stringify({
              steps,
              intent,
              followUpQuestions,
              groundingSources: groundingSourcesList.length > 0 ? groundingSourcesList : undefined,
              isComparison: !!(selectedProductIds && selectedProductIds.length > 0),
            }),
            products: productGroups.length > 0
              ? JSON.stringify(productGroups)
              : products.length > 0
                ? JSON.stringify(products)
                : undefined,
          },
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    console.error("[Chat API] Unhandled error:", (error as Error).message);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ── Static follow-up fallbacks per intent ─────────────────────────────────
const STATIC_FOLLOW_UPS: Record<Intent, string[]> = {
  product: [
    "Show me products under Rs. 2,000",
    "Filter by local Sri Lankan brands",
    "How do I buy and pay for this?",
  ],
  delivery: [
    "Can you deliver perishables to Kandy?",
    "What are the delivery charges to Galle?",
    "Track my recent Kapruka order",
  ],
  service: [
    "Find an electrician in Colombo",
    "Book a cleaning service for this weekend",
    "What's the average cost for AC repair?",
  ],
  qa: [
    "What payment methods does Kapruka accept?",
    "How long does standard delivery take?",
    "Can I return a product if it's damaged?",
  ],
};

// ── Static response fallback (if no Gemini API key) ───────────────────────
function generateFallback(intent: Intent, message: string, products: KaprukaProduct[]): string {
  switch (intent) {
    case "product":
      return products.length > 0
        ? `I found ${products.length} matching products on Kapruka for "${message}". Click "Buy Now" on any product to start checkout.`
        : `I searched the Kapruka catalog for "${message}". Please refine your search with more specific keywords.`;
    case "delivery":
      return "I can check Kapruka Grasshoppers delivery availability and rates to any Sri Lankan city.";
    case "service":
      return "I can connect you with verified home service technicians in your area.";
    case "qa":
      return "Kapruka accepts Credit/Debit cards, bank transfers, and cash on delivery for select areas.";
  }
}

// ── Accessory Noise Dictionary ─────────────────────────────────────────────
const ACCESSORY_NOISE: Record<string, string[]> = {
  shoe:   ["rack", "stand", "organizer", "organiser", "polish", "spray", "protector", "insert", "sole", "shelf", "cabinet", "drawer", "tree", "horn", "brush"],
  cake:   ["mold", "mould", "tin", "box", "board", "stand", "candle", "cutter", "topper", "tray", "server", "lifter", "wheel"],
  bag:    ["stand", "rack", "hook", "hanger", "clip"],
  watch:  ["stand", "box", "winder", "case", "storage"],
  flower: ["pot", "seed", "fertilizer", "scissors", "wire", "foam", "tape", "preserver"],
  phone:  ["case", "cover", "holder", "stand", "charger", "protector", "grip", "mount"],
  lamp:   ["shade", "bulb", "holder", "socket", "switch"],
  bottle: ["opener", "cap", "rack", "brush", "warmer", "cooler", "stopper"],
};

function getPrimaryNounVariants(baseTerm: string): string[] {
  const words = baseTerm.trim().toLowerCase().split(/\s+/);
  const noun = words[words.length - 1];
  if (!noun) return [];
  const variants = new Set<string>([noun]);
  if (noun.endsWith("ies") && noun.length > 3) { variants.add(noun.slice(0, -3) + "y"); }
  else if (noun.endsWith("es") && noun.length > 3) { variants.add(noun.slice(0, -2)); variants.add(noun.slice(0, -1)); }
  else if (noun.endsWith("s") && noun.length > 3) { variants.add(noun.slice(0, -1)); }
  else { variants.add(noun + "s"); variants.add(noun + "es"); }
  return Array.from(variants);
}

function scoreAndFilterProducts(products: KaprukaProduct[], baseTerm: string): KaprukaProduct[] {
  const cleanTerm = baseTerm.trim().toLowerCase();
  const queryTokens = cleanTerm.split(/\s+/).filter((w) => w.length > 1);
  const noun = cleanTerm.split(/\s+/).pop() || cleanTerm;
  const nounVariants = getPrimaryNounVariants(cleanTerm);
  const noiseWords = ACCESSORY_NOISE[noun] || [];

  return products
    .map((product) => {
      const nameLower = product.name.toLowerCase();
      let score = 0;
      const hasNoun = nounVariants.some((variant) => new RegExp(`\\b${variant}\\b`, "i").test(nameLower));
      if (hasNoun) score += 10;
      if (noiseWords.length > 0) {
        const matchesNoise = noiseWords.some((noise) => new RegExp(`\\b${noise}\\b`, "i").test(nameLower));
        if (matchesNoise) {
          const userWantsThisAccessory = queryTokens.some((t) => noiseWords.includes(t));
          if (!userWantsThisAccessory) score -= 15;
        }
      }
      if (nameLower.includes(cleanTerm)) score += 15;
      if (nameLower.startsWith(cleanTerm)) score += 5;
      const matchedTokens = queryTokens.filter((token) => new RegExp(`\\b${token}\\b`, "i").test(nameLower));
      score += matchedTokens.length === queryTokens.length ? 10 : matchedTokens.length * 3;
      return { ...product, _relevanceScore: score };
    })
    .sort((a, b) => b._relevanceScore - a._relevanceScore);
}

// ── LLM Relevance Validator ────────────────────────────────────────────────
async function llmValidateRelevance(
  products: KaprukaProduct[],
  searchTerm: string,
  userQuery: string,
  aiClient: GoogleGenAI,
  fastModel: string
): Promise<KaprukaProduct[]> {
  if (products.length === 0) return [];
  const productsToCheck = products.slice(0, 50);
  const productList = productsToCheck.map((p, i) => `${i + 1}. [${p.id}] ${p.name}`).join("\n");

  const prompt = `You are a product relevance validator for a Sri Lankan e-commerce search agent.

User's query: "${userQuery}"
Search term: "${searchTerm}"

For each product below, decide:
- KEEP: The product IS what the user wants (actual item, not a storage/cleaning/accessory variant)
- DISCARD: The product only shares a keyword but is categorically different

Examples:
- Searching "shoes" → sandals, boots, sneakers = KEEP. Shoe rack, shoe polish, shoe box = DISCARD.
- Searching "cake" → birthday cake, chocolate cake = KEEP. Cake mold, cake box, birthday candle = DISCARD.

Constraint:
- You must NOT discard more than 5 products. If there are more than 5 irrelevant products, only select the 5 most irrelevant ones to DISCARD, and mark all others as KEEP.

Products:
${productList}

Respond ONLY with valid JSON: {"keep_ids":["id1","id2",...],"reason":"one-line explanation"}`;

  try {
    const result = await aiClient.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            keep_ids: { type: "ARRAY", items: { type: "STRING" } },
            reason: { type: "STRING" },
          },
          required: ["keep_ids", "reason"],
        },
      },
    });

    let text = (result.text || "{}").trim().replace(/```json/i, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text);
    const keepIds = new Set<string>(Array.isArray(parsed?.keep_ids) ? parsed.keep_ids : []);
    if (keepIds.size === 0) {
      console.warn(`[LLM Validator] "${searchTerm}": validator returned 0 IDs — using raw set.`);
      return products;
    }
    const filtered = productsToCheck.filter((p) => keepIds.has(p.id));
    const remainder = products.slice(50);
    const combined = [...filtered, ...remainder].map((p) => {
      return {
        ...p,
        _relevanceScore: keepIds.has(p.id) ? 10 : 1
      };
    });

    // Sort in descending order of relevance score
    combined.sort((a, b) => {
      const scoreA = (a as any)._relevanceScore ?? 0;
      const scoreB = (b as any)._relevanceScore ?? 0;
      return scoreB - scoreA;
    });

    console.log(`[LLM Validator] "${searchTerm}": kept ${filtered.length}/${productsToCheck.length}. Reason: ${parsed?.reason || "n/a"}`);
    return combined;
  } catch (err) {
    console.error(`[LLM Validator] Failed for "${searchTerm}":`, (err as Error).message);
    return products;
  }
}
