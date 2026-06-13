import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  extractCityFromMessage,
  extractDate,
  extractOrderId,
  extractUrlFromMessage,
  extractUsdPrice,
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
  pillar4_estimateImportCost,
  pillar5_detectServiceCategory,
  pillar5_searchServiceProviders,
  type KaprukaProduct,
} from "@/lib/tools";
import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

interface SearchTermConfig {
  term: string;
  minPrice: number | null;
  maxPrice: number | null;
}

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

  import: `You are Kapuruka's cross-border import cost estimator for Sri Lanka.
You help users understand the full landed cost of importing goods from overseas (Amazon, Walmart, eBay, etc.).
The estimate shown uses standard Sri Lanka Customs duty rates (2024): Customs Duty, PAL (10%), CESS (2.5%), and VAT (18%).
Always remind the user that this is an estimate and actual duties may vary. Keep responses helpful and clear.`,

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

    // 2. Save user message to DB
    let fetchedSelectedProducts: KaprukaProduct[] = [];

    if (selectedProductIds && Array.isArray(selectedProductIds) && selectedProductIds.length > 0) {
      const detailsList = await Promise.all(
        selectedProductIds.map(id => pillar1_getProductDetails(id).catch(err => {
          console.error(`Failed to fetch product details for ${id}:`, err);
          return null;
        }))
      );
      fetchedSelectedProducts = detailsList.filter((p): p is KaprukaProduct => p !== null);
    }

    await prisma.chatMessage.create({
      data: { 
        sessionId: session.id, 
        role: "user", 
        content: message,
        products: fetchedSelectedProducts.length > 0 ? (fetchedSelectedProducts as any) : undefined
      },
    });

    // 2b. Fetch chat history for context-aware classification
    const chatHistoryForClassifier = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
    });

    const historySnippet = chatHistoryForClassifier
      .slice(0, -1) // Exclude the user message we just created so we only see prior history
      .slice(-6)    // Take up to the last 6 messages (3 turns)
      .map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 150)}`)
      .join("\n");

    // 3. Determine intent ───────────────────────────────────────────────────
    const apiKey = config.gemini.apiKey;
    let ai: GoogleGenAI | null = null;
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
    }

    const hasSelectedProducts = !!(selectedProductIds && Array.isArray(selectedProductIds) && selectedProductIds.length > 0);

    // Start with rule-based, then refine with LLM
    let intent: Intent = ruleBasedIntent(message);
    let isRelated = true;
    let llmSearchTerms: SearchTermConfig[] = []; // Array of focused product search configs

    if (hasSelectedProducts) {
      intent = "product";
      isRelated = true;
      llmSearchTerms = [];
      console.log(`[Intent] Skipping classification — ${selectedProductIds.length} product(s) selected`);
    } else if (apiKey) {
      try {
        const fastModel = config.gemini.fastModel;

        // LLM-based intent refinement and parallel keyword extraction
        const classifierPrompt = `You are a query classifier and search term extractor for Kapruka (Sri Lankan e-commerce assistant).
Analyze the user query in the context of the recent conversation history, and perform these tasks:

1. Determine if the query is RELATED or UNRELATED to the business of Kapruka.
   - RELATED: Product search, cake/gift shopping, order tracking, delivery rates/checks, cross-border import cost calculator, local home services (electrical, plumbing, AC repair, cleaning, etc.), or e-commerce platform support/Q&A. Also count follow-up requests for details/authors/specifications of previously discussed products in the conversation as RELATED.
   - UNRELATED: Software coding/programming help, copywriting, content/essay writing, translation, general homework/math solver, or generic chat/questions having nothing to do with e-commerce, local services, or the current conversation's context.
   Set "isRelated" to true if it is related, or false if it is unrelated.

2. Classify the user message into exactly ONE intent:
   - "product": Searching for, comparing, or buying products on Kapruka.com (e.g. cakes, gifts, clothes, books, electronics), asking for details/specifications of a product in the conversation, or reordering.
   - "delivery": Checking delivery availability to a city, delivery rates, tracking an existing order.
   - "import": User asks about importing goods from abroad, pastes Amazon/Walmart/eBay URLs, or asks customs/duties.
   - "service": User needs a home service (repair, cleaning, pest control, plumber, electrician, AC repair, carpentry).
   - "qa": General platform questions (payment, returns, policies, account help) or general knowledge/informational queries that require web search grounding.

3. Extract focused product search terms and price filters ("searchTerms") as a JSON array of objects matching this schema:
   {
     "term": string (MAX 2 words — the core product noun only. Strip occasion/verbs/filler words like "wedding", "cheap", "buy", "for me"),
     "minPrice": number | null (minimum price limit specified by user, e.g. "above 5000" -> 5000, "between 2000 and 5000" -> 2000. Set to null if there is no minimum price limit),
     "maxPrice": number | null (maximum price limit specified by user, e.g. "under 3000" -> 3000, "between 2000 and 5000" -> 5000. Set to null if there is no maximum price limit)
   }
   CRITICAL RULES:
   - Do NOT include any currency symbols or conversions in minPrice/maxPrice — just extract the raw numbers as numbers.
   - Extract ONE object per distinct product the user wants (max 3 objects total).
   - If not a product/service intent, set "searchTerms" to [].

Respond ONLY with JSON matching this structure:
{"intent": "product"|"delivery"|"import"|"service"|"qa", "isRelated": boolean, "searchTerms": [{"term": string, "minPrice": number|null, "maxPrice": number|null}], "reason": "brief explanation"}

[Recent Conversation History]
${historySnippet || "No previous history."}

User query to classify: "${message}"`;

        if (!ai) throw new Error("GoogleGenAI client not initialized");
        const result = await ai.models.generateContent({
          model: fastModel,
          contents: classifierPrompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        let responseText = result.text || "{}";
        // Clean markdown code blocks if they are present
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
        if (parsed?.intent && ["product", "delivery", "import", "service", "qa"].includes(parsed.intent)) {
          intent = parsed.intent as Intent;
        }
        if (typeof parsed?.isRelated === "boolean") {
          isRelated = parsed.isRelated;
        }

        // Parse searchTerms[] array supporting both structured objects and legacy strings
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
                    minPrice: typeof obj.minPrice === "number" ? obj.minPrice : (obj.minPrice && !isNaN(Number(obj.minPrice)) ? Number(obj.minPrice) : null),
                    maxPrice: typeof obj.maxPrice === "number" ? obj.maxPrice : (obj.maxPrice && !isNaN(Number(obj.maxPrice)) ? Number(obj.maxPrice) : null),
                  };
                }
              }
              return null;
            })
            .filter((x): x is SearchTermConfig => x !== null)
            .slice(0, 3); // cap at 3
        }

        // Backward compat: if old searchQuery string came back, wrap it
        if (llmSearchTerms.length === 0 && parsed?.searchQuery && typeof parsed.searchQuery === "string" && parsed.searchQuery.trim()) {
          llmSearchTerms = [{ term: parsed.searchQuery.trim().toLowerCase(), minPrice: null, maxPrice: null }];
        }

        console.log(`[Intent] "${message.substring(0, 60)}" → ${intent} (isRelated: ${isRelated}, searchTerms: ${JSON.stringify(llmSearchTerms)}, reason: ${parsed.reason})`);
      } catch (err) {
        console.error("[Intent] LLM classification failed, using rule-based:", (err as Error).message);
      }
    }

    if (hasSelectedProducts) {
      intent = "product";
      isRelated = true;
    }

    // 4. Build SSE stream ──────────────────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        // ── Order Processing Agent System Prompt ───────────────────────────
        const ORDER_AGENT_SYSTEM_PROMPT = `You are Kapruka's dedicated Order Processing Agent — warm, professional, and conversational.
Your ONLY job is to guide the customer naturally through placing a single order, one step at a time.
RULES:
- NEVER greet with "Hello", "Hi", "Hey". Start directly with the context.
- NEVER skip steps (stock check then quantity then address then payment).
- NEVER fabricate product availability or order details.
- Be concise: 1-2 sentences per reply. Do not over-explain.
- Address the customer by first name if known.
- Use emojis sparingly (1 per message max).`;

        // ── Helper: geocode a free-form location text ────────────────────
        const geocodeLocation = async (locationText: string): Promise<{ lat: number; lng: number; formattedAddress: string; label: string } | null> => {
          const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (!mapsKey) return null;
          try {
            const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationText + ", Sri Lanka")}&region=lk&key=${mapsKey}`;
            const geoRes = await fetch(geoUrl);
            if (!geoRes.ok) return null;
            const geoData = await geoRes.json();
            if (geoData.status !== "OK" || !geoData.results?.[0]) return null;
            const result = geoData.results[0];
            const { lat, lng } = result.geometry.location;
            const formattedAddress = result.formatted_address;
            const comps = result.address_components || [];
            const label = (
              comps.find((c: any) => c.types.includes("locality"))?.long_name ||
              comps.find((c: any) => c.types.includes("administrative_area_level_3"))?.long_name ||
              formattedAddress.split(",")[0]
            );
            return { lat, lng, formattedAddress, label };
          } catch { return null; }
        };

        // ── Helper: extract active order phase from history ──────────────
        const getActiveOrderPhase = (): { phase: string; orderFlowStep: Record<string, unknown> } | null => {
          for (let i = chatHistoryForClassifier.length - 1; i >= 0; i--) {
            const m = chatHistoryForClassifier[i];
            if (m.role === "assistant" && m.thoughtProcess) {
              try {
                const tp = typeof m.thoughtProcess === "string" ? JSON.parse(m.thoughtProcess as string) : m.thoughtProcess as Record<string, unknown>;
                if (tp?.orderFlowStep && typeof (tp.orderFlowStep as any).phase === "string") {
                  const phase = (tp.orderFlowStep as any).phase as string;
                  if (phase === "confirmed" || phase === "out_of_stock") return null;
                  return { phase, orderFlowStep: tp.orderFlowStep as Record<string, unknown> };
                }
              } catch { /* ignore */ }
            }
          }
          return null;
        };

        // ── Helper: accumulate order data across history ─────────────────
        const getAccumulatedOrderData = () => {
          let product: any = null, savedAddress: any = null, confirmedQuantity: number | null = null;
          let confirmedAddress: any = null, paymentMethod: string | null = null, stockQty: number | null = null, stockStatus: string | null = null;
          let cartItems: any[] | null = null;
          for (const m of chatHistoryForClassifier) {
            if (m.role === "assistant" && m.thoughtProcess) {
              try {
                const tp = typeof m.thoughtProcess === "string" ? JSON.parse(m.thoughtProcess as string) : m.thoughtProcess as any;
                if (tp?.orderFlowStep) {
                  const step = tp.orderFlowStep as any;
                  if (step.product) product = step.product;
                  if (step.cartItems) cartItems = step.cartItems;
                  if (step.savedAddress) savedAddress = step.savedAddress;
                  if (step.confirmedQuantity != null) confirmedQuantity = step.confirmedQuantity;
                  if (step.confirmedAddress) confirmedAddress = step.confirmedAddress;
                  if (step.paymentMethod) paymentMethod = step.paymentMethod;
                  if (step.stockQty != null) stockQty = step.stockQty;
                  if (step.stockStatus) stockStatus = step.stockStatus;
                }
              } catch { /* ignore */ }
            }
          }
          return { product, cartItems, savedAddress, confirmedQuantity, confirmedAddress, paymentMethod, stockQty, stockStatus };
        };

        // ── Helper: stream text word by word ────────────────────────────
        const streamWords = async (text: string) => {
          const words = text.split(" ");
          for (let i = 0; i < words.length; i++) {
            send({ type: "text", content: words[i] + (i === words.length - 1 ? "" : " ") });
            await new Promise((r) => setTimeout(r, 22));
          }
        };

        // ── Helper: LLM text generation (non-streaming) ──────────────────
        const llmGenerate = async (prompt: string): Promise<string> => {
          if (!ai) return "";
          try {
            const r = await ai.models.generateContent({
              model: config.gemini.fastModel,
              contents: prompt,
              config: { systemInstruction: ORDER_AGENT_SYSTEM_PROMPT },
            });
            return r.text || "";
          } catch { return ""; }
        };

        // ── Helper: save assistant message to DB with orderFlowStep ──────
        const saveOrderMessage = async (text: string, orderFlowStepPayload: Record<string, unknown>) => {
          await prisma.chatMessage.create({
            data: {
              sessionId,
              role: "assistant",
              content: text,
              thoughtProcess: JSON.stringify({
                steps: [{ step: "order_agent", status: "completed", content: `Phase: ${orderFlowStepPayload.phase}`, durationMs: 0 }],
                intent: "product",
                orderFlowStep: orderFlowStepPayload,
              }),
            },
          });
        };

        // ── Saved address lookup per user ────────────────────────────────
        const USER_DEFAULTS_OA: Record<string, { name: string; phone: string; address: string; city: string }> = {
          "e17d0577-c93d-4c3e-9080-60b6bbfdf071": { name: "Kamal Silva", phone: "0771234567", address: "123 Galle Road, Colombo 3", city: "Colombo 3" },
          "b91d2a14-e58f-4ad1-97b0-cce218fd7d32": { name: "Nimal Perera", phone: "0719876543", address: "45 Flower Road, Colombo 7", city: "Colombo 7" },
        };
        const savedAddr = USER_DEFAULTS_OA[userId] || null;
        const hasSavedAddress = !!(savedAddr?.address && savedAddr?.city);

        // ── Intercept Add to Cart queries ───────────────────────────────
        const isAddToCartQuery = /add.*cart|add.*to.*cart|put.*cart/i.test(message.toLowerCase());
        if (isAddToCartQuery) {
          const currentUserId = session?.userId || userId || "guest";
          const userWithCart = await (prisma.user as any).findUnique({ where: { id: currentUserId } });
          let currentCart: any[] = [];
          if (userWithCart?.cart) {
            try {
              currentCart = typeof userWithCart.cart === "string" ? JSON.parse(userWithCart.cart as string) : (userWithCart.cart as any[]);
            } catch (e) {
              console.error(e);
            }
          }

          let responseText = "";
          if (currentCart.length > 0) {
            const itemsList = currentCart.map((item) => `- ${item.quantity}x **${item.name}** (Rs. ${item.price.toLocaleString()})`).join("\n");
            const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            responseText = `I've updated your session cart! 🛒 Current items in your cart:\n\n${itemsList}\n\n**Total subtotal: Rs. ${total.toLocaleString()}**\n\nWould you like to search for more products or proceed to **checkout cart**?`;
          } else {
            responseText = "Your cart is currently empty. Try checking some product selection boxes in the search matches and click **Add to Cart**!";
          }

          await streamWords(responseText);
          await prisma.chatMessage.create({
            data: {
              sessionId,
              role: "assistant",
              content: responseText,
              thoughtProcess: JSON.stringify({
                steps: [{ step: "cart_addition", status: "completed", content: "Updated cart view sent to customer.", durationMs: 0 }],
                intent: "product",
              }),
            },
          });
          controller.close();
          return;
        }

        // ══════════════════════════════════════════════════════════════════════
        // PHASE: INITIAL — "checkout cart" or "order this" → check stock → qty_ask
        // ══════════════════════════════════════════════════════════════════════
        const isCheckoutQuery = 
          /checkout|place.*order|order.*selected/i.test(message.toLowerCase()) ||
          message.toLowerCase().trim() === "checkout cart" ||
          message.toLowerCase().trim() === "order this" ||
          message.toLowerCase().trim() === "order selected" ||
          (message.toLowerCase().trim() === "order this" && selectedProductIds && selectedProductIds.length === 1);

        if (isCheckoutQuery) {
          let currentCart: any[] = [];
          const currentUserId = session?.userId || userId || "guest";
          const userWithCart = await (prisma.user as any).findUnique({ where: { id: currentUserId } });
          if (userWithCart?.cart) {
            try {
              currentCart = typeof userWithCart.cart === "string" ? JSON.parse(userWithCart.cart as string) : (userWithCart.cart as any[]);
            } catch (e) {
              console.error(e);
            }
          }

          // Auto-populate cart from selection boxes if empty
          if (currentCart.length === 0 && fetchedSelectedProducts.length > 0) {
            currentCart = fetchedSelectedProducts.map((p: any) => ({
              id: p.id,
              name: p.name || p.title || "Kapruka Product",
              price: p.price || 0,
              quantity: 1,
              imageUrl: p.imageUrl || p.image,
              inStock: p.inStock !== false
            }));
            await (prisma.user as any).update({
              where: { id: currentUserId },
              data: { cart: currentCart }
            });
          }

          if (currentCart.length === 0) {
            const ofs = { phase: "qty_ask", cartItems: [] };
            send({ type: "order_flow_step", ...ofs });
            const t = "Your cart is currently empty. Please select products from the search matches and click 'Add to Cart' or 'Order Selected' first!";
            await streamWords(t);
            await saveOrderMessage(t, ofs);
            controller.close();
            return;
          }

          // Stock checking
          send({ type: "thought", step: "checking_stock", status: "running", content: `Checking stock for ${currentCart.length} item(s)...` });
          
          const freshCart = await Promise.all(
            currentCart.map(async (item) => {
              const fresh = await pillar1_getProductDetails(item.id).catch(() => null as any);
              return {
                ...item,
                inStock: fresh ? fresh.inStock !== false : item.inStock,
                stockQty: (fresh as any)?.stockQty ?? 50
              };
            })
          );

          currentCart = freshCart;
          await (prisma.user as any).update({
            where: { id: currentUserId },
            data: { cart: currentCart }
          });

          send({ type: "thought", step: "checking_stock", status: "completed", content: "Stock check complete.", durationMs: 0 });

          // If any out of stock items
          const outOfStockItems = currentCart.filter((item) => !item.inStock);
          if (outOfStockItems.length > 0) {
            const ofs = { phase: "out_of_stock", cartItems: currentCart };
            send({ type: "order_flow_step", ...ofs });
            const names = outOfStockItems.map(i => `**${i.name}**`).join(", ");
            const t = `I'm sorry, but some items in your cart are currently out of stock: ${names}. Please remove them or choose different products!`;
            await streamWords(t);
            await saveOrderMessage(t, ofs);
            controller.close(); return;
          }

          const qas = { phase: "qty_ask", cartItems: currentCart, savedAddress: savedAddr };
          send({ type: "order_flow_step", ...qas });
          const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const t = `I've loaded your cart for checkout 📦 You have **${currentCart.length} item(s)** (Subtotal: Rs. ${total.toLocaleString()}). Please confirm the quantities and click next when ready.`;
          await streamWords(t);
          await saveOrderMessage(t, qas);
          controller.close(); return;
        }

        // ══════════════════════════════════════════════════════════════════════
        // PHASE CONTINUATION — detect active order phase from history
        // ══════════════════════════════════════════════════════════════════════
        const activePhase = getActiveOrderPhase();

        if (activePhase) {
          const { phase, orderFlowStep: currentStep } = activePhase;
          const accData = getAccumulatedOrderData();
          const product = (accData.product || (currentStep as any).product) as any;
          const cartItems = (accData.cartItems || (currentStep as any).cartItems) as any[] | null;
          const stockQty = (accData.stockQty ?? (currentStep as any).stockQty ?? 50) as number;

          send({ type: "thought", step: "order_agent", status: "running", content: `Order agent: processing phase "${phase}"...` });
          send({ type: "thought", step: "order_agent", status: "completed", content: `Analysing customer reply for phase "${phase}"`, durationMs: 0 });

          // ── Phase: qty_ask ───────────────────────────────────────────────
          if (phase === "qty_ask") {
            if (cartItems && cartItems.length > 0) {
              const currentUserId = session?.userId || userId || "guest";
              const userWithCart = await (prisma.user as any).findUnique({ where: { id: currentUserId } });
              let finalCart = cartItems;
              if (userWithCart?.cart) {
                try {
                  finalCart = typeof userWithCart.cart === "string" ? JSON.parse(userWithCart.cart as string) : (userWithCart.cart as any[]);
                } catch (e) {
                  console.error(e);
                }
              }

              const das: Record<string, unknown> = { phase: "delivery_ask", cartItems: finalCart, savedAddress: savedAddr };
              send({ type: "order_flow_step", ...das });
              const itemsListStr = finalCart.map((i) => `${i.quantity}x **${i.name}**`).join(", ");
              const t = hasSavedAddress
                ? `Got it — ${itemsListStr} confirmed! Should we deliver to your saved address at **${savedAddr?.address}, ${savedAddr?.city}**, or would you like to use a different address?`
                : `Got it — ${itemsListStr} confirmed! Where should we deliver your order? You can type an address or a nearby landmark.`;
              await streamWords(t); await saveOrderMessage(t, das); controller.close(); return;
            } else {
              let extractedQty = 1;
              try {
                if (ai) {
                  const r = await ai.models.generateContent({
                    model: config.gemini.fastModel,
                    contents: `Extract the integer quantity from: "${message}". Reply ONLY with the number.`,
                    config: { responseMimeType: "application/json" },
                  });
                  extractedQty = Math.max(1, Math.abs(parseInt(JSON.parse(r.text || "1")) || 1));
                } else {
                  extractedQty = parseInt(message.match(/\d+/)?.[0] || "1") || 1;
                }
              } catch { extractedQty = parseInt(message.match(/\d+/)?.[0] || "1") || 1; }

              if (extractedQty > stockQty) {
                const ofs = { phase: "qty_ask", product, stockStatus: "in_stock", stockQty, savedAddress: savedAddr, errorMessage: `max ${stockQty}` };
                send({ type: "order_flow_step", ...ofs });
                const t = await llmGenerate(`Customer requested ${extractedQty} units but max available is ${stockQty}. Tell them politely and ask again.`)
                  || `We only have **${stockQty}** units available right now. How many would you like (up to ${stockQty})?`;
                await streamWords(t); await saveOrderMessage(t, ofs); controller.close(); return;
              }

              const das: Record<string, unknown> = { phase: "delivery_ask", product, stockQty, confirmedQuantity: extractedQty, savedAddress: savedAddr };
              send({ type: "order_flow_step", ...das });
              const firstName = savedAddr?.name?.split(" ")[0] || "";
              const t = await llmGenerate(
                `Customer confirmed qty: ${extractedQty} units of "${product.name || product.title}". ${hasSavedAddress ? `They have a saved address (${savedAddr?.address}, ${savedAddr?.city}). Ask if they want delivery there or a new address.` : "Ask where to deliver."} 1-2 sentences.`
              ) || (hasSavedAddress
                ? `Perfect! ${extractedQty} unit${extractedQty > 1 ? "s" : ""} of **${product.name || product.title}** confirmed. Should we deliver to ${firstName ? firstName + "'s" : "your"} saved address, or would you like a new one?`
                : `Got it — ${extractedQty} unit${extractedQty > 1 ? "s" : ""} of **${product.name || product.title}** locked in! Where should we deliver your order?`);
              await streamWords(t); await saveOrderMessage(t, das); controller.close(); return;
            }
          }

          // ── Phase: delivery_ask ──────────────────────────────────────────
          if (phase === "delivery_ask") {
            const confirmedQty = accData.confirmedQuantity ?? 1;
            const msgLower = message.toLowerCase();
            const wantsSaved = /\b(yes|yeah|yep|sure|saved|same|that one|deliver here|use that|my address|there|ok|okay|confirm)\b/.test(msgLower);
            const wantsNew = /\b(new|different|another|change|other|no|nope)\b/.test(msgLower);
            const hasLocationText = !wantsSaved && message.trim().length > 3;

            if (wantsSaved && hasSavedAddress) {
              const pas: Record<string, unknown> = { phase: "payment_ask", product, cartItems, confirmedQuantity: confirmedQty, confirmedAddress: savedAddr, savedAddress: savedAddr };
              send({ type: "order_flow_step", ...pas });
              const t = await llmGenerate(`Delivering to ${savedAddr?.address}, ${savedAddr?.city}. Ask how to pay: Cash on Delivery or Card. 1 sentence.`)
                || `Delivering to **${savedAddr?.address}, ${savedAddr?.city}** ✓ How would you like to pay?`;
              await streamWords(t); await saveOrderMessage(t, pas); controller.close(); return;
            }

            if (wantsNew) {
              const aas: Record<string, unknown> = { phase: "address_ask", product, cartItems, confirmedQuantity: confirmedQty, savedAddress: savedAddr };
              send({ type: "order_flow_step", ...aas });
              const t = await llmGenerate(`Customer wants to use a new address. Prompt them to type a rough location or nearby landmark in chat first. 1-2 sentences.`)
                || `Sure! Please type a rough location or nearby landmark (e.g. "near munas tex bogahakumbura" or "Galle Road, Colombo 3") so I can open the map there.`;
              await streamWords(t); await saveOrderMessage(t, aas); controller.close(); return;
            }

            if (hasLocationText) {
              const locationText = message.trim();
              send({ type: "thought", step: "geocoding", status: "running", content: `Geocoding: "${locationText}"...` });
              const geo = await geocodeLocation(locationText);
              send({ type: "thought", step: "geocoding", status: "completed", content: geo ? `Found: ${geo.label}` : "Default: Colombo", durationMs: 0 });
              const geocodedLocation = geo ?? { lat: 6.9271, lng: 79.8612, formattedAddress: "Colombo, Sri Lanka", label: "Colombo" };

              const mos: Record<string, unknown> = { phase: "map_open", product, cartItems, confirmedQuantity: confirmedQty, savedAddress: savedAddr, geocodedLocation };
              send({ type: "order_flow_step", ...mos });
              const t = await llmGenerate(`Opening map near "${geocodedLocation.label}". Tell customer to drag pin to exact door and confirm. 1-2 sentences.`)
                || `I've opened the map near **${geocodedLocation.label}** 📍 Drag the pin to your exact door and tap "Confirm this location" when ready.`;
              await streamWords(t); await saveOrderMessage(t, mos); controller.close(); return;
            }

            const das2: Record<string, unknown> = { phase: "delivery_ask", product, cartItems, confirmedQuantity: confirmedQty, savedAddress: savedAddr };
            send({ type: "order_flow_step", ...das2 });
            const t = hasSavedAddress
              ? `Should I deliver to your saved address at **${savedAddr?.address}**, or would you like a new location?`
              : `Where should I deliver your order? You can type an address or a nearby landmark.`;
            await streamWords(t); await saveOrderMessage(t, das2); controller.close(); return;
          }

          // ── Phase: address_ask ───────────────────────────────────────────
          if (phase === "address_ask") {
            const confirmedQty = accData.confirmedQuantity ?? 1;
            const locationText = message.trim();

            send({ type: "thought", step: "geocoding", status: "running", content: `Geocoding: "${locationText}"...` });
            const geo = await geocodeLocation(locationText);
            send({ type: "thought", step: "geocoding", status: "completed", content: geo ? `Found: ${geo.label}` : "Default: Colombo", durationMs: 0 });
            const geocodedLocation = geo ?? { lat: 6.9271, lng: 79.8612, formattedAddress: "Colombo, Sri Lanka", label: "Colombo" };

            const mos: Record<string, unknown> = { phase: "map_open", product, cartItems, confirmedQuantity: confirmedQty, savedAddress: savedAddr, geocodedLocation };
            send({ type: "order_flow_step", ...mos });
            const t = await llmGenerate(`Opening map near "${geocodedLocation.label}". Tell customer to drag pin to exact door and confirm. 1-2 sentences.`)
              || `I've opened the map near **${geocodedLocation.label}** 📍 Drag the pin to your exact door and tap "Confirm this location" when ready.`;
            await streamWords(t); await saveOrderMessage(t, mos); controller.close(); return;
          }

          // ── Phase: map_open ──────────────────────────────────────────────
          if (phase === "map_open") {
            const confirmedQty = accData.confirmedQuantity ?? 1;
            const locationMatch = message.match(/confirm location:\s*(.+),\s*([^,]+)$/i);
            const confirmedAddress = locationMatch
              ? { name: savedAddr?.name || "Customer", phone: savedAddr?.phone || "", address: locationMatch[1].trim(), city: locationMatch[2].trim() }
              : { name: savedAddr?.name || "Customer", phone: savedAddr?.phone || "", address: message, city: "Colombo" };

            const pas2: Record<string, unknown> = { phase: "payment_ask", product, cartItems, confirmedQuantity: confirmedQty, confirmedAddress, savedAddress: savedAddr };
            send({ type: "order_flow_step", ...pas2 });
            const t = await llmGenerate(`Address confirmed: ${JSON.stringify(confirmedAddress)}. Ask how to pay (COD or Card). 1 sentence.`)
              || `Address confirmed ✓ How would you like to pay for your order?`;
            await streamWords(t); await saveOrderMessage(t, pas2); controller.close(); return;
          }

          // ── Phase: payment_ask ───────────────────────────────────────────
          if (phase === "payment_ask") {
            const confirmedQty = accData.confirmedQuantity ?? 1;
            const confirmedAddress: any = accData.confirmedAddress || (currentStep as any).confirmedAddress || savedAddr;
            const msgLower = message.toLowerCase();

            let paymentMethod: "cod" | "card" | null = null;
            if (/\b(cash|cod|delivery|on delivery|cash on delivery)\b/.test(msgLower)) paymentMethod = "cod";
            if (/\b(card|credit|debit|online|pay online|card payment)\b/.test(msgLower)) paymentMethod = "card";

            if (!paymentMethod) {
              const pas3: Record<string, unknown> = { phase: "payment_ask", product, cartItems, confirmedQuantity: confirmedQty, confirmedAddress, savedAddress: savedAddr };
              send({ type: "order_flow_step", ...pas3 });
              await streamWords(`How would you like to pay? Please choose **Cash on Delivery** or **Card Payment**.`);
              await saveOrderMessage(`How would you like to pay? Please choose **Cash on Delivery** or **Card Payment**.`, pas3);
              controller.close(); return;
            }

            if (cartItems && cartItems.length > 0) {
              send({ type: "thought", step: "placing_order", status: "running", content: "Placing combined order via Kapruka..." });
              
              let checkoutUrl: string | undefined;
              let orderId: string | undefined;
              try {
                const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
                const orderItems = cartItems.map((i) => ({
                  productId: i.id,
                  productName: i.name,
                  quantity: i.quantity,
                  priceLKR: i.price,
                  imageUrl: i.imageUrl
                }));

                const orderRes = await fetch(`${baseUrl}/api/order`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    items: orderItems,
                    recipient: confirmedAddress,
                    sessionId, userId,
                    paymentMethod,
                  }),
                });
                if (orderRes.ok) {
                  const od = await orderRes.json();
                  checkoutUrl = od.checkoutLink?.checkoutUrl;
                  orderId = od.orderResult?.orderId || `ord-${Date.now()}`;
                  
                  // Clear the user's cart in DB after successful order checkout!
                  const currentUserId = session?.userId || userId || "guest";
                  await (prisma.user as any).update({
                    where: { id: currentUserId },
                    data: { cart: [] }
                  });
                }
              } catch (err) { console.error("[OrderAgent] place order failed:", err); }

              send({ type: "thought", step: "placing_order", status: "completed", content: "Order placed ✓", durationMs: 0 });

              const cs: Record<string, unknown> = { phase: "confirmed", cartItems, confirmedAddress, paymentMethod, checkoutUrl, orderId };
              send({ type: "order_flow_step", ...cs });

              const totalLKR = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
              const itemsListStr = cartItems.map((i) => `${i.quantity}x **${i.name}**`).join(", ");
              
              const t = paymentMethod === "cod"
                ? `Your order for ${itemsListStr} is confirmed! 🎉 Our courier will deliver and collect **Rs. ${totalLKR.toLocaleString()}** in cash on arrival.`
                : `Your order for ${itemsListStr} is confirmed! 🎉 Complete the payment via the secure link below to finalise your order.`;
              await streamWords(t); await saveOrderMessage(t, cs); controller.close(); return;
            } else {
              send({ type: "thought", step: "placing_order", status: "running", content: "Placing order via Kapruka..." });

              let checkoutUrl: string | undefined;
              let orderId: string | undefined;
              try {
                const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
                const orderRes = await fetch(`${baseUrl}/api/order`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    productId: product.id, quantity: confirmedQty,
                    recipient: confirmedAddress,
                    sessionId, userId,
                    productTitle: product.name || product.title,
                    priceLKR: product.price, imageUrl: product.imageUrl, paymentMethod,
                  }),
                });
                if (orderRes.ok) {
                  const od = await orderRes.json();
                  checkoutUrl = od.checkoutLink?.checkoutUrl;
                  orderId = od.orderResult?.orderId || `ord-${Date.now()}`;
                }
              } catch (err) { console.error("[OrderAgent] place order failed:", err); }

              send({ type: "thought", step: "placing_order", status: "completed", content: "Order placed ✓", durationMs: 0 });

              const cs: Record<string, unknown> = { phase: "confirmed", product, confirmedQuantity: confirmedQty, confirmedAddress, paymentMethod, checkoutUrl, orderId };
              send({ type: "order_flow_step", ...cs });

              const totalLKR = (product.price || 0) * confirmedQty;
              const t = await llmGenerate(
                `Order confirmed. Payment: ${paymentMethod}. Total: LKR ${totalLKR}. Qty: ${confirmedQty}x "${product.name}". City: ${confirmedAddress?.city}. Write 1-2 confirmation sentences. ${paymentMethod === "card" ? "Mention payment link is below." : "Mention courier will collect cash."}`
              ) || (paymentMethod === "cod"
                ? `Your order is confirmed! 🎉 Our courier will deliver **${confirmedQty}x ${product.name}** and collect **Rs. ${totalLKR.toLocaleString()}** in cash on arrival.`
                : `Your order is confirmed! 🎉 Complete the payment via the secure link below to finalise your **${product.name}** order.`);
              await streamWords(t); await saveOrderMessage(t, cs); controller.close(); return;
            }
          }
          // Fallback: unknown phase — fall through to normal routing
        }



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
                followUpQuestions: followUps 
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

        // ── Pillar 1 & 3: Product Search ───────────────────────────────────
        if (intent === "product" || intent === "service") {
          // For "service" the LLM will handle text, but we still check product context
        }

        if (intent === "product") {
          if (selectedProductIds && Array.isArray(selectedProductIds) && selectedProductIds.length > 0) {
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Processing ${selectedProductIds.length} selected product(s)...`, durationMs: 0 });
            
            send({ type: "thought", step: "fetching_product_details", status: "running", content: "Fetching selected product details in parallel..." });
            send({ type: "tool_call", name: "kapruka_get_product", args: { productIds: selectedProductIds } });

            products = fetchedSelectedProducts;

            const step2 = {
              step: "fetching_product_details",
              status: "completed",
              content: `Retrieved ${products.length} product(s).`,
              durationMs: 0,
            };
            steps.push(step2);
            send({ type: "thought", ...step2 });
            send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });

            // Context will be built in contextNote below to avoid duplication
            pastOrdersContext = "";
          } else {
            // Step 1: Parse requirements
            send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Kapruka product catalog..." });
            criteria = parseRequirements(message);
            
            const isReorderQuery = /reorder|ordered|bought|purchased|past order|history/.test(message.toLowerCase());

            if (isReorderQuery) {
              const step1 = {
                step: "intent_routing",
                status: "completed",
                content: "Identified as: Order History Lookup.",
                durationMs: 0,
              };
              steps.push(step1);
              send({ type: "thought", ...step1 });

              send({ type: "thought", step: "searching_kapruka", status: "running", content: "Retrieving user's order history..." });
              
              if (userId && userId !== "guest") {
                const userWithOrders = await prisma.user.findUnique({
                  where: { id: userId },
                  include: {
                    orders: {
                      include: {
                        items: true
                      },
                      orderBy: { createdAt: "desc" }
                    }
                  }
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
                        url: `https://www.kapruka.com/buyonline/${item.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/kid/${item.productId}`
                      });
                    }
                  }

                  // Deduplicate orderProducts by id
                  const seenIds = new Set<string>();
                  products = orderProducts.filter(p => {
                    if (seenIds.has(p.id)) return false;
                    seenIds.add(p.id);
                    return true;
                  });
                  
                  pastOrdersContext += `\nInstruction to AI: The user wants to reorder a previous purchase. Confirm the details of the item they are referring to (item name, price, order date) and recommend they click the 'Buy Now' button to reorder.`;
                } else {
                  pastOrdersContext = `\n\n[User's Past Orders] The user (${userWithOrders?.name || "Unknown"}) has no past order history in the system. Explain this politely.`;
                }
              } else {
                pastOrdersContext = `\n\n[User's Past Orders] The user is currently browsing as a Guest and has no associated order history. Politely prompt them to select a user profile from the header to view order history.`;
              }

              const step2 = {
                step: "searching_kapruka",
                status: "completed",
                content: products.length > 0
                  ? `Retrieved ${products.length} product(s) from past order history.`
                  : "No past purchases found.",
                durationMs: 0,
              };
              steps.push(step2);
              send({ type: "thought", ...step2 });
              send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });

            } else {
              // ── Parallel Per-Intent Pipelines: Search → Validate → Stream ───────────────

              // Helper: reorder terms for Kapruka's noun-first search engine.
              const reorderForKapruka = (term: string): string[] => {
                const words = term.trim().split(/\s+/);
                if (words.length <= 1) return [term];
                if (words.length === 2) {
                  const reordered = `${words[1]} ${words[0]}`;
                  return [reordered, words[1]];
                }
                return [words[words.length - 1], term];
              };

              // Build base terms from LLM extraction or fallback (max 3)
              // Build base terms from LLM extraction or fallback (max 3)
              const baseLlmTerms: SearchTermConfig[] = (
                llmSearchTerms.length > 0
                  ? llmSearchTerms
                  : criteria.keywords.length > 0
                    ? [{ term: criteria.keywords[0], minPrice: null, maxPrice: null }]
                    : [{ term: message.split(" ").find((w: string) => w.length > 2) || message.split(" ")[0], minPrice: null, maxPrice: null }]
              ).slice(0, 3);

              const searchDisplay = baseLlmTerms.map((t: SearchTermConfig) => {
                let limitStr = "";
                if (t.minPrice !== null && t.maxPrice !== null) {
                  limitStr = ` (Rs. ${t.minPrice} - ${t.maxPrice})`;
                } else if (t.minPrice !== null) {
                  limitStr = ` (above Rs. ${t.minPrice})`;
                } else if (t.maxPrice !== null) {
                  limitStr = ` (under Rs. ${t.maxPrice})`;
                }
                return `"${t.term}"${limitStr}`;
              }).join(", ");

              const step1 = {
                step: "intent_routing",
                status: "completed",
                content: `Identified as: Product Search. Terms: ${searchDisplay}${criteria.maxPrice ? `. Max price: Rs. ${criteria.maxPrice.toLocaleString()}` : ""}`,
                durationMs: 0,
              };
              steps.push(step1);
              send({ type: "thought", ...step1 });

              // ── Per-intent pipeline: runs in parallel for each base term ──────────────
              // Each pipeline independently: searches → keyword-filters → LLM-validates → streams group_ready
              const runSearchPipeline = async (
                termConfig: SearchTermConfig,
                pipelineIndex: number
              ): Promise<{ term: string; products: KaprukaProduct[]; discardedCount: number }> => {

                const baseTerm = termConfig.term;
                const variants = reorderForKapruka(baseTerm);
                const queryMaxPrice = termConfig.maxPrice ?? criteria.maxPrice;

                // Announce this pipeline starting
                send({ type: "tool_call", name: "kapruka_search_products", args: { query: baseTerm, max_price: queryMaxPrice } });
                send({
                  type: "thought",
                  step: "searching_kapruka",
                  term: baseTerm,
                  status: "running",
                  content: `Searching Kapruka for "${baseTerm}"...`,
                });

                // Search all variants in parallel, staggered 120ms to avoid rate spikes
                const t1 = Date.now();
                const variantSettled = await Promise.allSettled(
                  variants.map((v, vi) =>
                    new Promise<KaprukaProduct[]>((resolve, reject) => {
                      setTimeout(() => {
                        pillar1_searchProducts(v, {
                          maxPriceLKR: queryMaxPrice ?? undefined,
                          smeFirst: false,
                          limit: 30,
                          currency: currency || "LKR",
                        }).then(resolve).catch(reject);
                      }, vi * 120);
                    })
                  )
                );
                const searchDur = Date.now() - t1;

                // Merge + deduplicate results across variants
                const seenIds = new Set<string>();
                const rawProducts: KaprukaProduct[] = [];
                for (const settled of variantSettled) {
                  if (settled.status === "fulfilled") {
                    for (const p of settled.value) {
                      if (!seenIds.has(p.id)) {
                        seenIds.add(p.id);
                        rawProducts.push(p);
                      }
                    }
                  }
                }

                // Apply mathematical price filters: minPrice <= price <= maxPrice
                const beforeFilterCount = rawProducts.length;
                let priceFilterDiscarded = 0;
                let filteredPriceProducts = rawProducts;
                if (termConfig.minPrice !== null || termConfig.maxPrice !== null) {
                  filteredPriceProducts = rawProducts.filter(p => {
                    const priceVal = p.price;
                    if (termConfig.minPrice !== null && priceVal < termConfig.minPrice) return false;
                    if (termConfig.maxPrice !== null && priceVal > termConfig.maxPrice) return false;
                    return true;
                  });
                  priceFilterDiscarded = beforeFilterCount - filteredPriceProducts.length;
                }

                send({
                  type: "thought",
                  step: "searching_kapruka",
                  term: baseTerm,
                  status: "completed",
                  content: `Found ${filteredPriceProducts.length} raw result${filteredPriceProducts.length !== 1 ? "s" : ""} for "${baseTerm}" in ${searchDur}ms.` +
                    (priceFilterDiscarded > 0 ? ` (Filtered out ${priceFilterDiscarded} product(s) outside price limits)` : ""),
                  durationMs: searchDur,
                });

                // Layer 1: Fast keyword pre-filter (noun check + accessory exclusion + scoring)
                const keywordFiltered = scoreAndFilterProducts(filteredPriceProducts, baseTerm);
                const keywordDiscarded = filteredPriceProducts.length - keywordFiltered.length + priceFilterDiscarded;

                // Layer 2: LLM Relevance Validation (fast model — runs per pipeline)
                let validated = keywordFiltered;
                let llmDiscarded = 0;

                if (ai && keywordFiltered.length > 0) {
                  send({
                    type: "thought",
                    step: "validating_relevance",
                    term: baseTerm,
                    status: "running",
                    content: `Validating ${keywordFiltered.length} result${keywordFiltered.length !== 1 ? "s" : ""} for "${baseTerm}" against your query...`,
                  });

                  const t2 = Date.now();
                  validated = await llmValidateRelevance(
                    keywordFiltered,
                    baseTerm,
                    message,
                    ai,
                    config.gemini.fastModel
                  );
                  const validationDur = Date.now() - t2;
                  llmDiscarded = keywordFiltered.length - validated.length;

                  send({
                    type: "thought",
                    step: "validating_relevance",
                    term: baseTerm,
                    status: "completed",
                    content: llmDiscarded > 0
                      ? `Relevance check for "${baseTerm}": ✓ kept ${validated.length}, removed ${llmDiscarded} irrelevant item${llmDiscarded !== 1 ? "s" : ""}.`
                      : `All ${validated.length} result${validated.length !== 1 ? "s" : ""} for "${baseTerm}" passed relevance check ✓`,
                    durationMs: validationDur,
                  });
                }

                const totalDiscarded = keywordDiscarded + llmDiscarded;

                // Stream this group immediately — don't wait for other pipelines
                send({
                  type: "group_ready",
                  term: baseTerm,
                  products: validated,
                  index: pipelineIndex,
                  discardedCount: totalDiscarded,
                });

                return { term: baseTerm, products: validated, discardedCount: totalDiscarded };
              };

              // Launch all pipelines in parallel (max 3)
              const tPipelines = Date.now();
              const pipelineResults = await Promise.allSettled(
                baseLlmTerms.map((tConfig: SearchTermConfig, index: number) => runSearchPipeline(tConfig, index))
              );
              const pipelinesDur = Date.now() - tPipelines;

              // Collect validated groups from completed pipelines
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
              products = groups.flatMap(g => g.products);

              // Summary thought step (all pipelines complete)
              const step2 = {
                step: "searching_kapruka",
                status: "completed",
                content: products.length > 0
                  ? `All ${baseLlmTerms.length} search pipeline${baseLlmTerms.length > 1 ? "s" : ""} complete in ${pipelinesDur}ms — ${products.length} validated product${products.length !== 1 ? "s" : ""}${totalDiscardedAll > 0 ? `, ${totalDiscardedAll} irrelevant filtered out` : ""}${notFoundOriginalTerms.length > 0 ? `. Not found: ${notFoundOriginalTerms.map((t: string) => `"${t}"`).join(", ")}` : ""}.`
                  : `No matching products found after relevance filtering.`,
                durationMs: pipelinesDur,
                terms: baseLlmTerms.map(t => t.term), // user-intent base terms for ThinkingPanel capsule rendering
              };
              steps.push(step2);
              send({ type: "thought", ...step2 });
              send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });
              send({ type: "product_groups", groups: productGroups });

              // Stash notFoundOriginalTerms for contextNote
              (criteria as typeof criteria & { _notFoundTerms?: string[] })._notFoundTerms = notFoundOriginalTerms;
            }
          }
        }

        // ── Pillar 3: SME/Partner Central ──────────────────────────────────
        if (intent === "product") {
          // Check if this is an SME-focused query
          const smeQuery = /artisan|local.*brand|sri lankan.*made|handmade|sme|small.*business|partner central|local.*gift/.test(message.toLowerCase());
          if (smeQuery) {
            send({ type: "thought", step: "sme_filter", status: "running", content: "Highlighting local Sri Lankan SME products..." });
            const t3 = Date.now();
            const smeProducts = await pillar3_searchSMEProducts(message, {
              maxPriceLKR: criteria.maxPrice,
              limit: 50,
              currency: currency || "USD",
            });
            const dur3 = Date.now() - t3;

            if (smeProducts.length > 0) {
              products = smeProducts;
              const step3 = {
                step: "sme_filter",
                status: "completed",
                content: `Found ${smeProducts.filter((p) => p.isSME).length} verified local Sri Lankan SME products.`,
                durationMs: dur3,
              };
              steps.push(step3);
              send({ type: "thought", ...step3 });
              send({ type: "tool_result", toolName: "kapruka_search_products_sme", result: { products } });
            }
          }
        }

        // ── Pillar 2: Delivery / Tracking ─────────────────────────────────
        if (intent === "delivery") {
          send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Grasshoppers logistics network..." });

          const orderId = extractOrderId(message);
          const city = extractCityFromMessage(message);
          const date = extractDate(message);
          const isPerishable = /cake|flower|food|perishable|fresh/.test(message.toLowerCase());

          if (orderId) {
            // Track order
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Tracking order: ${orderId}`, durationMs: 0 });
            send({ type: "thought", step: "tracking_order", status: "running", content: `Fetching live status for order ${orderId}...` });
            send({ type: "tool_call", name: "kapruka_track_order", args: { order_id: orderId } });

            const t = Date.now();
            const tracking = await pillar2_trackOrder(orderId);
            const dur = Date.now() - t;

            if (tracking) {
              steps.push({ step: "tracking_order", status: "completed", content: `Order ${orderId} status: ${tracking.currentStatus}`, durationMs: dur });
              send({ type: "thought", step: "tracking_order", status: "completed", content: `Order status retrieved successfully.`, durationMs: dur });
              send({ type: "tracking_result", result: tracking });
            } else {
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Could not retrieve order status. Order may not exist or is too old.", durationMs: dur });
            }
          } else if (city) {
            // Check delivery
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Checking Grasshoppers delivery to ${city}`, durationMs: 0 });
            send({ type: "thought", step: "checking_delivery", status: "running", content: `Checking delivery availability to ${city} on ${date}${isPerishable ? " (perishable item)" : ""}...` });
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
              // Fallback: search cities
              send({ type: "tool_call", name: "kapruka_list_delivery_cities", args: { query: city } });
              const cities = await pillar2_findCity(city);
              send({ type: "city_suggestions", result: { cities, query: city } });
            }
          } else {
            send({ type: "thought", step: "intent_routing", status: "completed", content: "Need city name or order ID to proceed.", durationMs: 0 });
          }
        }

        // ── Pillar 4: Import Cost Estimator ───────────────────────────────
        if (intent === "import") {
          send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Cross-Border Import Estimator..." });

          const url = extractUrlFromMessage(message);
          const usdPrice = extractUsdPrice(message);

          send({ type: "thought", step: "intent_routing", status: "completed", content: `Detected import query${url ? ` with URL: ${url.substring(0, 60)}...` : ""}`, durationMs: 0 });
          send({ type: "thought", step: "calculating_import", status: "running", content: "Applying Sri Lanka Customs duty schedule (Customs Duty + PAL 10% + CESS 2.5% + VAT 18%)..." });
          send({ type: "tool_call", name: "kapruka_import_estimate", args: { url: url || "unknown", usd_price: usdPrice } });

          const t = Date.now();
          const estimate = await pillar4_estimateImportCost(url || message, usdPrice);
          const dur = Date.now() - t;

          if (estimate) {
            steps.push({ step: "calculating_import", status: "completed", content: `Estimated landed cost: LKR ${estimate.totalLandedLKR.toLocaleString()} for ${estimate.productTitle}`, durationMs: dur });
            send({ type: "thought", step: "calculating_import", status: "completed", content: `Import cost calculated. Category: ${estimate.productTitle}. Total: LKR ${estimate.totalLandedLKR.toLocaleString()}`, durationMs: dur });
            send({ type: "import_estimate", result: estimate });
          }
        }

        // ── Pillar 5: Services Platform ────────────────────────────────────
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

        // ── QA intent: no tool calls, just LLM response ───────────────────
        if (intent === "qa") {
          send({ type: "thought", step: "google_search_grounding", status: "running", content: "Launching Google Search for real-time information..." });
          const step1 = { step: "google_search_grounding", status: "completed", content: "Identified as: Information query. Querying Google Search.", durationMs: 0 };
          steps.push(step1);
          send({ type: "thought", ...step1 });
        }

        // ── LLM Response Generation ────────────────────────────────────────
        send({ type: "thought", step: "generating_response", status: "running", content: "Generating AI response..." });

        if (ai) {
          try {
            // Reuse the chat history loaded earlier
            const chatHistory = chatHistoryForClassifier;

            // Augment context with tool results for the LLM
            let contextNote = "";
            if (intent === "product") {
              if (hasSelectedProducts && products.length > 0) {
                contextNote = `\n\n[Selected Products Context — User is asking about these specific products]\n` +
                  products.map((p, idx) => {
                    const richInfo = {
                      id: p.id,
                      name: p.name,
                      price: p.price,
                      compare_at_price: p.originalPrice || null,
                      currency: p.currency,
                      in_stock: p.inStock,
                      category: p.category,
                      description: p.description,
                      url: p.url,
                      variants: p.variants || [],
                      attributes: p.attributes || {},
                      shipping: p.shipping || {}
                    };
                    return `Product ${idx + 1}:\n\`\`\`json\n${JSON.stringify(richInfo, null, 2)}\n\`\`\``;
                  }).join("\n\n") +
                  `\n\n[Instruction] The user has selected the above products and is asking: "${message}". ` +
                  `Answer their question directly, conversationally, and specifically using ONLY the product data above. ` +
                  `Be warm, helpful, and direct. Do NOT use [INTRO] or [DETAILS] tags. Do NOT suggest searching for other products unless they ask. ` +
                  `If they ask for reasons to buy or advantages, analyze the product description, price, attributes, and comparison price (compare_at_price). ` +
                  `If they ask for a comparison, generate a clean detailed Markdown comparison table.`;
              } else {
                const notFoundTerms: string[] = (criteria as typeof criteria & { _notFoundTerms?: string[] })._notFoundTerms ?? [];
                if (productGroups && productGroups.length > 0) {
                  // Rich structured context — reasoning model uses this for a high-quality response
                  contextNote = `\n\n[Validated Product Search Results — All items below have been relevance-validated]\n`;
                  for (const group of productGroups) {
                    contextNote += `\n🔍 "${group.title}" — ${group.products.length} verified match${group.products.length !== 1 ? "es" : ""}:\n`;
                    contextNote += group.products.slice(0, 4).map((p, i) =>
                      `  ${i + 1}. ${p.name} — Rs. ${p.price?.toLocaleString() || "N/A"} (${p.inStock ? "✅ In Stock" : "❌ Out of Stock"})${p.isSME ? " 🇱🇰 Local" : ""}`
                    ).join("\n") + "\n";
                  }
                  if (notFoundTerms.length > 0) {
                    contextNote += `\n⚠️ NOT FOUND: ${notFoundTerms.map(t => `"${t}"`).join(", ")} — these items are not available in the Kapruka catalog. You MUST clearly tell the user which specific items are unavailable.`;
                  }
                  contextNote += `\n\n[Response Instructions]
You MUST structure your response for EACH category returned in the search results above using exactly these tags:
- Use \`[INTRO: <CategoryName>]\` followed by a 1-sentence simple introduction.
- Use \`[DETAILS: <CategoryName>]\` followed by a 2-3 sentence detailed comparison, mentioning prices in LKR and stock status.
Make sure the category name in the tags matches the search result headers above exactly (e.g. if the category header is 🔍 "Shoes", use [INTRO: Shoes] and [DETAILS: Shoes]). Speak naturally and confidently. Do not write any general text outside these tags.`;
                } else if (products.length > 0) {
                  contextNote = `\n\n[Validated Product Results] ${products.length} item${products.length !== 1 ? "s" : ""} found on Kapruka:\n` +
                    products.slice(0, 6).map((p, i) =>
                      `${i + 1}. ${p.name} — Rs. ${p.price?.toLocaleString() || "N/A"} (${p.inStock ? "✅ In Stock" : "❌ Out of Stock"})${p.isSME ? " 🇱🇰 Local" : ""}`
                    ).join("\n");
                  if (notFoundTerms.length > 0) {
                    contextNote += `\n\n⚠️ NOT FOUND: ${notFoundTerms.map(t => `"${t}"`).join(", ")}. Tell the user clearly these are unavailable.`;
                  }
                  contextNote += `\n\n[Response Instructions]
You MUST structure your response using exactly these tags:
- Use \`[INTRO: Product search]\` followed by a 1-sentence simple introduction.
- Use \`[DETAILS: Product search]\` followed by a 2-3 sentence detailed comparison, mentioning prices in LKR and stock status.`;
                } else {
                  contextNote = `\n\n[Search Result] NO products were found in the Kapruka live catalog after relevance filtering. Apologize politely, suggest the user try different keywords or a related category, and offer to help find alternatives.`;
                }
              }
            }

            if (pastOrdersContext) {
              contextNote += pastOrdersContext;
            }

            const geminiHistory = chatHistory.map((m: { role: string; content: string }) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            }));

            // Inject context into the last user message
            if (geminiHistory.length > 0 && contextNote) {
              const last = geminiHistory[geminiHistory.length - 1];
              geminiHistory[geminiHistory.length - 1] = {
                ...last,
                parts: [{ text: last.parts[0].text + contextNote }],
              };
            }

            const streamConfig: any = {
              systemInstruction: hasSelectedProducts ? SELECTED_PRODUCT_QA_PROMPT : SYSTEM_PROMPTS[intent],
            };

            // If intent is "qa", enable the Google Search grounding tool!
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

              // Extract search queries if available
              const metadata = chunk.candidates?.[0]?.groundingMetadata;
              if (metadata?.webSearchQueries) {
                for (const q of metadata.webSearchQueries) {
                  if (!webQueries.includes(q)) {
                    webQueries.push(q);
                    const searchStep = {
                      step: "google_search_query",
                      status: "completed" as const,
                      content: `Searched Google for: "${q}"`,
                      durationMs: 0,
                    };
                    steps.push(searchStep);
                    send({ type: "thought", ...searchStep });
                  }
                }
              }

              // Extract grounding sources (citations)
              if (metadata?.groundingChunks) {
                for (const c of metadata.groundingChunks) {
                  const web = c.web;
                  if (web?.uri) {
                    const title = web.title || new URL(web.uri).hostname;
                    if (!groundingSourcesList.some(gc => gc.uri === web.uri)) {
                      groundingSourcesList.push({ title, uri: web.uri });
                    }
                  }
                }
              }
            }

            // Append sources to the text if there are any search grounding sources
            if (groundingSourcesList.length > 0) {
              const sourcesText = "\n\n**Sources:**\n" + groundingSourcesList.map((c, i) => `[${i + 1}] [${c.title}](${c.uri})`).join("\n");
              fullResponseText += sourcesText;
              send({ type: "text", content: sourcesText });
            }

          } catch (err) {
            const errMsg = (err as Error).message;
            console.error("[LLM] Gemini stream error:", errMsg);
            steps.push({
              step: "generating_response",
              status: "completed",
              content: `Error generating AI response: ${errMsg}`,
              durationMs: 0
            });
            send({
              type: "thought",
              step: "generating_response",
              status: "completed",
              content: `Error generating AI response: ${errMsg}`
            });
          }
        }

        // Fallback if no LLM response was generated
        if (!fullResponseText) {
          fullResponseText = generateFallback(intent, message, products);
          for (const word of fullResponseText.split(" ")) {
            send({ type: "text", content: word + " " });
            await new Promise((r) => setTimeout(r, 35));
          }
        }

        // ── Follow-up Suggestions ──────────────────────────────────────────
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
              config: {
                responseMimeType: "application/json",
              },
            });
            const parsed = JSON.parse(sug.text || "[]");
            if (Array.isArray(parsed) && parsed.length >= 3) {
              followUpQuestions = parsed.slice(0, 3);
            }
          } catch {
            // Use static fallbacks
          }
        }

        if (followUpQuestions.length === 0) {
          followUpQuestions = STATIC_FOLLOW_UPS[intent];
        }

        send({ type: "follow_ups", questions: followUpQuestions });

        // ── Save AI response to DB ─────────────────────────────────────────
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
              : (products.length > 0 ? JSON.stringify(products) : undefined),
          },
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    console.error("[Chat API] Unhandled error:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
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
  import: [
    "Calculate import cost for electronics",
    "What are Sri Lanka customs duty rates?",
    "Can Kapruka Global Shop help me import this?",
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
        ? `I found ${products.length} matching products on Kapruka for "${message}". The results include prices in LKR with stock availability. Click "Buy Now" on any product to create a secure 60-minute checkout link.`
        : `I searched the Kapruka catalog for "${message}". Please refine your search with more specific keywords or a price range in LKR.`;
    case "delivery":
      return "I can check Kapruka Grasshoppers delivery availability and rates to any Sri Lankan city. Please mention the destination city and delivery date.";
    case "import":
      return "I can estimate the Sri Lanka landed cost (including Customs Duty, PAL, CESS, and VAT) for any product you want to import. Please share the product URL or USD price.";
    case "service":
      return "I can connect you with verified home service technicians in your area. Please tell me your city and the type of service you need (e.g., AC repair, plumbing, electrical).";
    case "qa":
      return "Kapruka accepts payments via Credit/Debit cards, bank transfers, and cash on delivery for select areas. For returns, you have 7 days from delivery. Contact support@kapruka.com for account help.";
  }
}

// ── Accessory Noise Dictionary ─────────────────────────────────────────────
// When searching for a noun (e.g. "shoe"), products that ALSO match these
// noise words are accessories/storage items, not the product itself.
// Only applied when the user did NOT explicitly search for the accessory type.
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
  const noun = words[words.length - 1]; // last word is the head noun
  if (!noun) return [];

  const variants = new Set<string>([noun]);
  if (noun.endsWith("ies") && noun.length > 3) {
    variants.add(noun.slice(0, -3) + "y");
  } else if (noun.endsWith("es") && noun.length > 3) {
    variants.add(noun.slice(0, -2));
    variants.add(noun.slice(0, -1));
  } else if (noun.endsWith("s") && noun.length > 3) {
    variants.add(noun.slice(0, -1));
  } else {
    variants.add(noun + "s");
    variants.add(noun + "es");
  }
  return Array.from(variants);
}

function scoreAndFilterProducts(products: KaprukaProduct[], baseTerm: string): KaprukaProduct[] {
  const cleanTerm = baseTerm.trim().toLowerCase();
  const queryTokens = cleanTerm.split(/\s+/).filter(w => w.length > 1);
  const noun = cleanTerm.split(/\s+/).pop() || cleanTerm; // head noun
  const nounVariants = getPrimaryNounVariants(cleanTerm);

  // Noise words for this noun (empty if not in dictionary)
  const noiseWords = ACCESSORY_NOISE[noun] || [];

  return products
    .map(product => {
      const nameLower = product.name.toLowerCase();

      // 1. Strict Noun Check (word boundary match)
      const hasNoun = nounVariants.some(variant => {
        const regex = new RegExp(`\\b${variant}\\b`, "i");
        return regex.test(nameLower);
      });
      if (!hasNoun) return null;

      // 2. Accessory exclusion: discard products that are accessories of the noun
      //    unless the user specifically searched for that accessory type
      if (noiseWords.length > 0) {
        const matchesNoise = noiseWords.some(noise => {
          const noiseRegex = new RegExp(`\\b${noise}\\b`, "i");
          return noiseRegex.test(nameLower);
        });
        if (matchesNoise) {
          // Exception: keep it if the user explicitly searched for this accessory type
          const userWantsThisAccessory = queryTokens.some(t => noiseWords.includes(t));
          if (!userWantsThisAccessory) return null;
        }
      }

      let score = 10; // base score for passing noun check

      // 3. Exact Phrase Match
      if (nameLower.includes(cleanTerm)) score += 15;

      // 4. Starts With Term
      if (nameLower.startsWith(cleanTerm)) score += 5;

      // 5. Token Overlap Score
      const matchedTokens = queryTokens.filter(token => {
        const regex = new RegExp(`\\b${token}\\b`, "i");
        return regex.test(nameLower);
      });
      score += matchedTokens.length === queryTokens.length
        ? 10
        : matchedTokens.length * 3;

      return { ...product, _relevanceScore: score };
    })
    .filter((p): p is KaprukaProduct & { _relevanceScore: number } => p !== null)
    .sort((a, b) => b._relevanceScore - a._relevanceScore);
}

// ── LLM Relevance Validator (fast model per pipeline) ─────────────────────
// Second layer of filtering: semantically validates each product against the
// user's actual intent. Catches accessories/wrong-category items that slipped
// through the keyword pre-filter. Uses gemini-2.5-flash-lite for speed.
async function llmValidateRelevance(
  products: KaprukaProduct[],
  searchTerm: string,
  userQuery: string,
  aiClient: GoogleGenAI,
  fastModel: string
): Promise<KaprukaProduct[]> {
  if (products.length === 0) return [];

  // Cap at 20 to keep prompt compact and fast
  const productsToCheck = products.slice(0, 20);
  const productList = productsToCheck
    .map((p, i) => `${i + 1}. [${p.id}] ${p.name}`)
    .join("\n");

  const prompt = `You are a product relevance validator for a Sri Lankan e-commerce search agent.

User's query: "${userQuery}"
Search term: "${searchTerm}"

For each product below, decide:
- KEEP: The product IS what the user wants (actual item, not a storage/cleaning/accessory variant)
- DISCARD: The product only shares a keyword but is categorically different

Examples:
- Searching "shoes" → sandals, boots, sneakers = KEEP. Shoe rack, shoe polish, shoe box = DISCARD.
- Searching "cake" → birthday cake, chocolate cake = KEEP. Cake mold, cake box, birthday candle = DISCARD.
- Searching "flower vase" → ceramic vase, glass flower vase = KEEP. Artificial flowers (no vase) = DISCARD.
- Searching "phone" → smartphone, mobile phone = KEEP. Phone case, charger, screen protector = DISCARD.

Products:
${productList}

Respond ONLY with valid JSON (no markdown):
{"keep_ids":["id1","id2",...],"reason":"one-line explanation"}`;

  try {
    const result = await aiClient.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    let text = (result.text || "{}").trim()
      .replace(/```json/i, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(text);
    const keepIds = new Set<string>(Array.isArray(parsed?.keep_ids) ? parsed.keep_ids : []);

    if (keepIds.size === 0) {
      console.warn(`[LLM Validator] "${searchTerm}": validator returned 0 IDs — using keyword-filtered set as fallback.`);
      return products; // safety: never discard everything
    }

    const filtered = productsToCheck.filter(p => keepIds.has(p.id));
    // Append any products beyond the 20-cap (not sent to LLM) without re-checking
    const remainder = products.slice(20);
    const combined = [...filtered, ...remainder];

    console.log(`[LLM Validator] "${searchTerm}": kept ${filtered.length}/${productsToCheck.length}. Reason: ${parsed?.reason || "n/a"}`);
    return combined.length > 0 ? combined : products; // safety fallback
  } catch (err) {
    console.error(`[LLM Validator] Failed for "${searchTerm}", using keyword-filtered results:`, (err as Error).message);
    return products; // graceful fallback — never break the search
  }
}

