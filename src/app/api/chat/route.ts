import { KAPRUKA_CITIES_SET } from "@/constants/cities";
import { findRelevantCategories } from "@/lib/categories";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logger";
import {
  extractCityFromMessage,
  extractDate,
  extractOrderId,
  Intent,
  ruleBasedIntent,
} from "@/lib/nlp";
import { placeOrderInternally } from "@/lib/orderService";
import {
  parseRequirements,
  pillar1_createOrderLink,
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
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// ── New Agentic Architecture ──────────────────────────────────────────────
import { cartModifierAgent, type CartModification } from "@/lib/agents/cartModifierAgent";
import { categoryBrowseAgent } from "@/lib/agents/categoryBrowseAgent";
import { orderAgent } from "@/lib/agents/orderAgent";
import { routerAgent, type RouterDecision } from "@/lib/agents/routerAgent";
import { BUDDY_PROMPTS, BUDDY_SELECTED_PRODUCT_PROMPT, BUDDY_OFFTOPIC_REFUSAL } from "@/lib/prompts/personality";
import {
  clearCheckoutState,
  getCheckoutState,
  saveCheckoutState,
  type CheckoutState,
} from "@/lib/checkoutContext";
import { getCachedCategories, scrapeMultipleCategoryUrls } from "@/lib/tools";

// Normalize address data from DB to SavedAddress schema
const mapToSavedAddress = (addr: any) => {
  if (!addr) return undefined;
  return {
    name: addr.recipientName || addr.name || addr.label || "Customer",
    phone: addr.phone || "",
    address: addr.addressLine || addr.address || "",
    city: addr.city || ""
  };
};

interface SearchTermConfig {
  term: string;
  minPrice: number | null;
  maxPrice: number | null;
}

// ── No hardcoded registry anymore — loaded dynamically per-user ───────────

// ── Kapruka fallback order number for live tracking ───────────────────────
// The real Kapruka order number (e.g. VPAY827982BA) is only generated after
// the customer completes payment on kapruka.com. Our internal kaprukaRef is
// NOT a valid tracking ID. We therefore always use this known-good fallback
// to fetch live progress steps, and enrich the result with our DB data.
const KAPRUKA_FALLBACK_ORDER_NUMBER = "VPAY827982BA";

// ── System Prompts — imported from centralized Best Buddy personality module ─
const SYSTEM_PROMPTS: Record<Intent, string> = BUDDY_PROMPTS;
const SELECTED_PRODUCT_QA_PROMPT = BUDDY_SELECTED_PRODUCT_PROMPT;

// ── Main Chat POST Handler ─────────────────────────────────────────────────
export const POST = withLogging(async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, message, userId, country, currency, selectedProductIds, selectedProductsList, editMessageId } = body;

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: "Missing sessionId or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Ensure chat session exists
    let session = await prisma.chatSession.findUnique({ where: { id: sessionId } });

    // Strict Ownership Check
    if (session && session.userId && session.userId !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden: You do not have permission to send messages to this shared chat." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!session) {
      // Ensure user exists (create a dummy guest user if needed)
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
        selectedProductIds.map((id: any) =>
          pillar1_getProductDetails(String(id)).catch((err) => {
            console.error(`Failed to fetch product details for ${id}:`, err);
            return null;
          })
        )
      );
      fetchedSelectedProducts = detailsList.filter((p): p is KaprukaProduct => p !== null);

      if (fetchedSelectedProducts.length === 0 && selectedProductsList && Array.isArray(selectedProductsList)) {
        console.warn(`[API] Fetching full product details failed. Falling back to inline products list.`);
        fetchedSelectedProducts = selectedProductsList.map((p: any) => ({
          id: String(p.id),
          name: p.name || p.title || "Product",
          price: p.price || 0,
          originalPrice: p.originalPrice,
          currency: p.currency || "LKR",
          imageUrl: p.imageUrl,
          category: p.category,
          inStock: p.inStock ?? true
        })) as KaprukaProduct[];
      }
    }

    // 3. Save or edit user message
    if (editMessageId) {
      const targetMessage = await prisma.chatMessage.findUnique({
        where: { id: editMessageId },
      });
      if (!targetMessage) {
        return new Response(JSON.stringify({ error: "Message to edit not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Update target user message content
      await prisma.chatMessage.update({
        where: { id: editMessageId },
        data: {
          content: message,
          products: fetchedSelectedProducts.length > 0 ? (fetchedSelectedProducts as any) : Prisma.DbNull,
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

      // Rollback CheckoutSession and user cart to the last remaining assistant message's state
      const lastAssistantMsg = await prisma.chatMessage.findFirst({
        where: {
          sessionId,
          role: "assistant",
          createdAt: { lt: targetMessage.createdAt },
        },
        orderBy: { createdAt: "desc" },
      });

      let orderFlowStep: any = null;
      if (lastAssistantMsg?.thoughtProcess) {
        try {
          const parsed = typeof lastAssistantMsg.thoughtProcess === "string"
            ? JSON.parse(lastAssistantMsg.thoughtProcess)
            : lastAssistantMsg.thoughtProcess;
          orderFlowStep = (parsed as any)?.orderFlowStep;
        } catch (e) {
          console.error("Error parsing thoughtProcess for rollback:", e);
        }
      }

      if (orderFlowStep && orderFlowStep.phase !== "confirmed" && orderFlowStep.phase !== "cancelled") {
        // Restore CheckoutSession
        await saveCheckoutState(sessionId, {
          phase: orderFlowStep.phase,
          cartItems: orderFlowStep.cartItems || [],
          product: orderFlowStep.product,
          confirmedQty: orderFlowStep.confirmedQuantity,
          confirmedAddress: orderFlowStep.confirmedAddress,
          savedAddress: orderFlowStep.savedAddress,
          geocodedLocation: orderFlowStep.geocodedLocation,
          paymentMethod: orderFlowStep.paymentMethod,
          deliveryDate: orderFlowStep.deliveryDate,
          personalMessage: orderFlowStep.personalMessage,
          deliveryFeeLKR: orderFlowStep.deliveryCheckResult?.flatRateLKR ?? orderFlowStep.deliveryFeeLKR,
        });

        // Synchronize user cart in DB
        const currentUserId = userId || "guest";
        try {
          const userRecord = await prisma.user.findUnique({ where: { id: currentUserId } });
          let cartObj: Record<string, any[]> = {};
          if (userRecord?.cart) {
            const parsed = typeof userRecord.cart === "string" ? JSON.parse(userRecord.cart) : userRecord.cart;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              cartObj = parsed as Record<string, any[]>;
            }
          }
          cartObj[sessionId] = orderFlowStep.cartItems || [];
          await (prisma.user as any).update({
            where: { id: currentUserId },
            data: { cart: cartObj },
          });
        } catch (err) {
          console.warn("Failed to sync cart during rollback:", err);
        }
      } else {
        // No prior checkout or it was finished -> clear checkout state
        await clearCheckoutState(sessionId);
      }
    } else {
      // Normal flow: save user message to DB
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "user",
          content: message,
          products: fetchedSelectedProducts.length > 0 ? (fetchedSelectedProducts as any) : undefined,
        },
      });
    }

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
    let historyTarget: string | null = null;
    let historyTimeline: string | null = null;
    let isAgeRestricted = false;

    if (hasSelectedProducts) {
      intent = "product";
      isRelated = true;
    } else if (ai) {
      try {
        // Run local Category Matcher (RACR) to get matching store categories
        const matchedCats = findRelevantCategories(message, 3);
        const matchedCategoriesText = matchedCats.length > 0
          ? matchedCats.map(c => `- ${c.slug} (Path: ${c.path})`).join("\n")
          : "None found";

        const classifierPrompt = `You are a query classifier and search term extractor for Kapruka (Sri Lankan e-commerce assistant).
Analyze the user query in the context of the recent conversation history, and perform these tasks:

1. Determine if the query is RELATED or UNRELATED to the business of Kapruka.
   - RELATED: Product search, cake/gift shopping, order tracking, delivery rates/checks, cross-border import cost calculator, local home services (electrical, plumbing, AC repair, cleaning, etc.), or e-commerce platform support/Q&A. Also count follow-up requests for details/authors/specifications of previously discussed products in the conversation as RELATED.
   - UNRELATED: Software coding/programming help, copywriting, content/essay writing, translation, general homework/math solver, or generic chat/questions having nothing to do with e-commerce, local services, or the current conversation's context.
   Set "isRelated" to true if it is related, or false if it is unrelated.

2. Classify the user message into exactly ONE intent:
   - "product": Searching for specific products (e.g. "iphone 15", "red roses", "black forest cake") where we should perform a direct text search against product names.
   - "category_browse": A broad or generic shopping query (e.g. "diwali gifts", "wedding gifts", "anniversary ideas", "show me cakes", "i want to buy flowers") where it's better to show a whole category page of curated items rather than doing a text search for specific keywords.
   - "delivery": Checking delivery availability to a city, delivery rates, tracking an existing order.
   - "service": User needs a home service (repair, cleaning, pest control, plumber, electrician, AC repair, carpentry).
   - "qa": General platform questions (returns, policies, general account help) or general knowledge/informational queries that require web search grounding. Note: Do NOT classify any checkout responses, payment method selections for an active order, or checkout confirmations (e.g. cash on delivery) as "qa".
   - "order_history": The user wants to check their order history (e.g., "what did I buy last week?", "what are the products that I ordered previously?").

3. Extract focused product search terms and price filters ("searchTerms") as a JSON array of objects matching this schema:
   {
     "term": string (MAX 2 words — the core product noun only. Strip colors/descriptors like "gold", "silver", "black", occasion/verbs/filler words like "wedding", "cheap", "buy", "for me". CRITICAL: Translate generic shopping nouns to local Sri Lankan database listing nouns, especially: "phone case" or "phone cover" -> "backcover". CRITICAL APPLE RULE: If the user asks for an Apple product like "iphone", extract it as "apple iphone"),
     "minPrice": number | null (minimum price limit specified by user, e.g. "above 5000" -> 5000, "between 2000 and 5000" -> 2000. Set to null if there is no minimum price limit),
     "maxPrice": number | null (maximum price limit specified by user, e.g. "under 3000" -> 3000, "between 2000 and 5000" -> 5000. Set to null if there is no maximum price limit)
   }

   CRITICAL RULES:
   - Do NOT include any currency symbols or conversions in minPrice/maxPrice — just extract the raw numbers as numbers.
   - Extract ONE object per distinct product the user wants (max 3 objects total).
   - If not a product/service intent, set "searchTerms" to [].

4. Extract order history context if intent is "order_history", matching this schema:
   {
     "historyTarget": string | null (e.g., "cake", "flowers" - the product they want to see from their history),
     "historyTimeline": string | null (an ISO 8601 date string representing the start of the timeframe requested. e.g., "last week" = 7 days ago. Today's date is ${new Date().toISOString()}. Set to null if NO timeline is provided)
   }

5. Determine if the query is for an age-restricted product (e.g., alcohol, tobacco, adult items, cigars).
   - Set "isAgeRestricted" to true if the user is asking for or searching for 21+ products. Otherwise, false.

[Candidate Store Categories matching query]
${matchedCategoriesText}

[Instructions for translation and noun preparation]
Use the candidate categories above to understand the listing taxonomy and prepare/translate the search query keyword ("term") to match the category's typical product noun (e.g., translate "phone cases" to "backcover" or "cover" or "casing" if the matched category is mobile_phone_accessories, and "cake" or "bento cake" to "cake" or "ribbon cake").

Respond ONLY with JSON matching this structure:
{"intent": "product"|"category_browse"|"delivery"|"service"|"qa"|"order_history", "isRelated": boolean, "searchTerms": [{"term": string, "minPrice": number|null, "maxPrice": number|null}], "historyTarget": "...", "historyTimeline": "...", "isAgeRestricted": boolean, "reason": "brief explanation"}

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
        if (parsed?.intent && ["product", "category_browse", "delivery", "service", "qa", "order_history"].includes(parsed.intent)) {
          intent = parsed.intent as Intent;
        }
        if (typeof parsed?.isRelated === "boolean") {
          isRelated = parsed.isRelated;
        }
        if (typeof parsed?.isAgeRestricted === "boolean") {
          isAgeRestricted = parsed.isAgeRestricted;
        }
        if (typeof parsed?.historyTarget === "string") {
          historyTarget = parsed.historyTarget;
        }
        if (typeof parsed?.historyTimeline === "string") {
          historyTimeline = parsed.historyTimeline;
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
    let checkoutState = await getCheckoutState(sessionId);

    let allUserAddresses: any[] = [];
    if (userId && userId !== "guest") {
      try {
        const userWithAddresses = await prisma.user.findUnique({
          where: { id: userId },
        });
        if (userWithAddresses?.addresses && Array.isArray(userWithAddresses.addresses)) {
          allUserAddresses = userWithAddresses.addresses;
        }
      } catch (err) {
        console.warn("Failed to load user addresses for context:", err);
      }
    }
    const savedAddressLabels = allUserAddresses.map((a: any) => a.label || a.type);
    const savedAddr = allUserAddresses.find((a: any) => a.isDefault) || allUserAddresses[0] || null;

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
        (fp as any).isExplicitlySelected = true;
        const existing = availableProducts.find(
          (ap) => String(ap.id).trim().toLowerCase() === String(fp.id).trim().toLowerCase()
        );
        if (existing) {
          existing.isExplicitlySelected = true;
        } else {
          availableProducts.push(fp);
        }
      }
    }

    // 8. Call Router Agent (Intent / Checkout state switch)
    let routerDecision: RouterDecision = { action: "shop", reason: "Fallback logic hit" };
    if (!ai) {
      if (hasSelectedProducts && /order/i.test(message)) routerDecision.action = "checkout_start";
      else routerDecision.action = "shop";
    } else if (checkoutState) {
      // Fallback checkout_continue if AI routing fails but checkout active
      routerDecision = { action: "checkout_continue", reason: "No AI — fallback checkout_continue" };
    }

    if (ai) {
      routerDecision = await routerAgent(message, historySnippet, checkoutState, intent, ai, config.gemini.fastModel, savedAddressLabels, availableProducts);
    }

    // 9. Build SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        if (isAgeRestricted) {
          send({ type: "age_verification_required" });
        }

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

        let action = routerDecision.action;

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
              const existingIdx = currentCart.findIndex((item) =>
                String(item.id).trim().toLowerCase() === String(p.id).trim().toLowerCase() ||
                String(item.name).trim().toLowerCase() === String(p.name).trim().toLowerCase()
              );
              if (existingIdx === -1) {
                currentCart.push({
                  id: String(p.id),
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
                stockQty: fresh ? (fresh.stockCount ?? undefined) : undefined,
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
          const existingCheckoutState = await getCheckoutState(sessionId);
          const newCheckoutState: CheckoutState = {
            phase: "qty_ask",
            cartItems: currentCart,
            savedAddress: savedAddr ?? undefined,
            confirmedAddress: existingCheckoutState?.confirmedAddress,
            deliveryDate: existingCheckoutState?.deliveryDate,
            personalMessage: existingCheckoutState?.personalMessage,
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

        // ── Action: checkout_start_with_address ────────────────────────────
        if (action === "checkout_start_with_address") {
          let currentCart = await loadUserCart();

          // Merge selected products
          if (fetchedSelectedProducts.length > 0) {
            for (const p of fetchedSelectedProducts as any[]) {
              const existingIdx = currentCart.findIndex((item) =>
                String(item.id).trim().toLowerCase() === String(p.id).trim().toLowerCase() ||
                String(item.name).trim().toLowerCase() === String(p.name).trim().toLowerCase()
              );
              if (existingIdx === -1) {
                currentCart.push({
                  id: String(p.id),
                  name: p.name || p.title || "Kapruka Product",
                  price: p.price || 0,
                  quantity: 1, // Skip qty_ask, use 1 by default
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
            const t = "Your cart is currently empty. Please select products from the search results first!";
            await streamWords(t);
            await saveOrderMessage(t, ofs);
            controller.close();
            return;
          }

          // Extract label and quantities from the prompt via LLM
          send({ type: "thought", step: "intent_routing", status: "running", content: "Extracting delivery address and quantities..." });

          let matchedAddress = savedAddr;
          if (ai) {
            const cartContext = currentCart.map((item: any) => `- ID: ${item.id}, Name: ${item.name}`).join("\n");
            const extractPrompt = `You are extracting information from a user's fast-checkout request.
User message: "${message}"

Current Cart Items:
${cartContext}

Task:
1. Extract the address label mentioned in the message and match it against one of these known labels: [${savedAddressLabels.map((l: string) => `"${l}"`).join(", ")}]. If none matches, set "label" to "NOT FOUND".
2. If the user specifies quantities for any of the items, extract them as a map of "item_id": quantity. For example, if they say "2 of the cakes" and the cake ID is 123, return { "123": 2 }.

Respond ONLY with valid JSON matching this schema:
{
  "label": "string",
  "quantities": { "string_item_id": number }
}`;
            try {
              const res = await ai.models.generateContent({
                model: config.gemini.fastModel,
                contents: extractPrompt,
                config: { responseMimeType: "application/json" }
              });
              const rawText = (res.text || "{}").trim();
              const parsed = JSON.parse(rawText);

              if (parsed.label && parsed.label !== "NOT FOUND") {
                const found = allUserAddresses.find((a: any) => (a.label || a.type).toLowerCase() === parsed.label.toLowerCase());
                if (found) matchedAddress = found;
              }

              // Apply extracted quantities to the cart
              if (parsed.quantities && typeof parsed.quantities === "object") {
                currentCart = currentCart.map((item) => {
                  const newQty = parsed.quantities[item.id];
                  if (typeof newQty === "number" && newQty > 0) {
                    return { ...item, quantity: newQty };
                  }
                  return item;
                });
                await saveUserCart(currentCart);
              }
            } catch (err) {
              console.warn("Failed to extract address label and quantities", err);
            }
          }

          send({ type: "thought", step: "intent_routing", status: "completed", content: `Matched address: ${matchedAddress ? (matchedAddress as any).label || (matchedAddress as any).type : "Default"}`, durationMs: 0 });

          // Validate that the matched address has a valid Kapruka delivery city
          const isCityValid = matchedAddress && matchedAddress.city && KAPRUKA_CITIES_SET.has(matchedAddress.city);

          if (isCityValid) {
            // Fast-track to delivery_date_ask (skips delivery_ask, user already confirmed address)
            const existingCheckoutState = await getCheckoutState(sessionId);
            const newCheckoutState: CheckoutState = {
              phase: "delivery_date_ask",
              cartItems: currentCart,
              savedAddress: savedAddr ?? undefined,
              confirmedAddress: mapToSavedAddress(matchedAddress) as any,
              deliveryDate: existingCheckoutState?.deliveryDate,
              personalMessage: existingCheckoutState?.personalMessage,
              confirmedQty: currentCart.reduce((sum, item) => sum + item.quantity, 0),
            };
            await saveCheckoutState(sessionId, newCheckoutState);

            const ofs = { phase: "delivery_date_ask", cartItems: currentCart, savedAddress: savedAddr, confirmedAddress: mapToSavedAddress(matchedAddress) };
            send({ type: "order_flow_step", ...ofs });

            const t = `Got it! I've added the item(s) to your cart and set the delivery to your **${(matchedAddress as any)?.label || (matchedAddress as any)?.type || "saved address"}**. When would you like it delivered? Pick a date below, and feel free to add a personal message!`;
            await streamWords(t);
            await saveOrderMessage(t, ofs);
            controller.close();
            return;
          } else {
            // Force delivery_ask phase to let user select/configure a valid address
            const newCheckoutState: CheckoutState = {
              phase: "delivery_ask",
              cartItems: currentCart,
              savedAddress: savedAddr ?? undefined,
              confirmedQty: currentCart.reduce((sum, item) => sum + item.quantity, 0),
            };
            await saveCheckoutState(sessionId, newCheckoutState);

            const ofs = { phase: "delivery_ask", cartItems: currentCart, savedAddress: savedAddr, savedAddresses: allUserAddresses };
            send({ type: "order_flow_step", ...ofs });

            const t = `I've added the item(s) to your cart, but I noticed your address does not have a verified Kapruka delivery city. Please confirm or select your delivery address below:`;
            await streamWords(t);
            await saveOrderMessage(t, ofs);
            controller.close();
            return;
          }
        }

        // ── Action: cart_modify ────────────────────────────────────────────
        if (action === "cart_modify" && checkoutState) {
          send({ type: "thought", step: "cart_agent", status: "running", content: "Cart Modifier Agent: understanding your request..." });

          const currentCart = await loadUserCart();

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

          // Fallback: If user tried to add items but none were matched in availableProducts,
          // it means they want to add a new product not currently loaded.
          // Pause checkout and perform a product search instead of failing the cart modification.
          if (modification.type === "add" && (!modification.itemsToAdd || modification.itemsToAdd.length === 0)) {
            console.log("[route.ts] cart_modify 'add' returned 0 items. Overriding to checkout_pause to search for the product.");
            action = "checkout_pause";
            intent = "product";
          } else {
            // Apply and persist
            await saveUserCart(modification.updatedCart);

            // Update the checkout session's cartItems too
            if (checkoutState) {
              let nextPhase = checkoutState.phase;
              let resetConfirmedQty = checkoutState.confirmedQty;

              // Reset checkout phase to qty_ask for all cart modifications so user can verify
              if (modification.type === "add" || modification.type === "remove" || modification.type === "update_qty") {
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
                        phase: (modification.type === "add" || modification.type === "remove" || modification.type === "update_qty") ? "qty_ask" : checkoutState.phase,
                        cartItems: modification.updatedCart,
                        savedAddress: checkoutState.savedAddress,
                        confirmedQuantity: (modification.type === "add" || modification.type === "remove" || modification.type === "update_qty") ? undefined : checkoutState.confirmedQty,
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
        }

        // ── Action: checkout_continue ──────────────────────────────────────
        if (action === "checkout_continue" && checkoutState) {
          send({ type: "thought", step: "order_agent", status: "running", content: `Order Agent: processing phase "${checkoutState.phase}"...` });

          // ── Phase 3: Sync live cart into checkoutState before every agent call ──
          // Silent Add-to-Cart actions (or deletions) done from the UI write to
          // User.cart[sessionId] directly. Re-read it here so the orderAgent always sees
          // the latest cart, not a stale snapshot.
          const liveCart = await loadUserCart();
          const liveCartStr = JSON.stringify(liveCart);
          const checkoutCartStr = JSON.stringify(checkoutState.cartItems);
          if (liveCartStr !== checkoutCartStr) {
            // Cart changed — update the CheckoutSession snapshot and re-save.
            checkoutState = { ...checkoutState, cartItems: liveCart };
            await saveCheckoutState(sessionId, checkoutState);
          }

          let agentOutput = {
            nextPhase: "stay" as any,
            stay: true,
            extractedData: {} as any,
            responseText: "I didn't quite catch that. Could you please clarify?",
            requiresGeocode: false,
            requiresOrderPlace: false,
            requiresDeliveryCheck: false,
          };

          let bypassedAI = false;
          if (checkoutState.phase === "delivery_ask" && / address selected$/i.test(message.trim())) {
            const labelMatch = message.match(/^(.+) address selected$/i);
            if (labelMatch) {
               const label = labelMatch[1].trim();
               const found = allUserAddresses.find((a: any) =>
                 (a.label?.toLowerCase() === label.toLowerCase()) ||
                 (a.type?.toLowerCase() === label.toLowerCase()) ||
                 (a.recipientName?.toLowerCase() === label.toLowerCase()) ||
                 ((a as any).name?.toLowerCase() === label.toLowerCase())
               );
               if (found) {
                 bypassedAI = true;
                 agentOutput = {
                   nextPhase: "delivery_date_ask",
                   stay: false,
                   extractedData: { usesSavedAddress: true, selectedAddressId: found.id },
                   responseText: "When would you like your order delivered? Pick a date below, and feel free to add a personal message!",
                   requiresGeocode: false,
                   requiresOrderPlace: false,
                   requiresDeliveryCheck: false,
                 };
               }
            }
          }

          if (checkoutState.phase === "payment_ask") {
            if (message.trim() === "I'll pay cash on delivery") {
              bypassedAI = true;
              agentOutput = {
                nextPhase: "confirmed",
                stay: false,
                extractedData: { paymentMethod: "cod" },
                responseText: "Placing your order...",
                requiresGeocode: false,
                requiresOrderPlace: true,
                requiresDeliveryCheck: false,
              };
            } else if (message.trim() === "I want to pay by card online") {
              bypassedAI = true;
              agentOutput = {
                nextPhase: "confirmed",
                stay: false,
                extractedData: { paymentMethod: "card" },
                responseText: "Placing your order...",
                requiresGeocode: false,
                requiresOrderPlace: true,
                requiresDeliveryCheck: false,
              };
            }
          }

          if (ai && !bypassedAI) {
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
            updatedState.confirmedAddress = mapToSavedAddress(savedAddr);
          }
          if (extractedData.selectedAddressId) {
            const found = allUserAddresses.find((a: any) => a.id === extractedData.selectedAddressId);
            if (found) updatedState.confirmedAddress = mapToSavedAddress(found);
          }
          if (extractedData.paymentMethod) {
            updatedState.paymentMethod = extractedData.paymentMethod;
          }
          // Persist delivery date + personal message from delivery_date_ask phase
          if (extractedData.deliveryDate) {
            updatedState.deliveryDate = extractedData.deliveryDate;
          }
          if (extractedData.personalMessage !== undefined && extractedData.personalMessage !== null) {
            updatedState.personalMessage = extractedData.personalMessage || undefined;
          }

          // Determine the actual next phase
          let nextPhase = agentOutput.stay ? checkoutState.phase : agentOutput.nextPhase;

          // Fast-track checkout transition when adding items to an active session
          if (!agentOutput.stay && checkoutState.phase === "qty_ask" && nextPhase === "delivery_ask" && updatedState.confirmedAddress) {
            if (updatedState.deliveryDate) {
              nextPhase = "payment_ask";
              (agentOutput as any).requiresDeliveryCheck = true;
            } else {
              nextPhase = "delivery_date_ask";
              agentOutput.responseText = "Quantities confirmed! Since I already have your delivery address, when would you like this delivered? Please select a date below, and feel free to add a personal message.";
            }
          }

          updatedState.phase = nextPhase;

          // Handle map_open confirmation (LEGACY fallback)
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

          // Handle new_address_form confirmation
          if (checkoutState.phase === "new_address_form" && /^new address confirmed:/i.test(message.trim())) {
            const parts = message.replace(/^new address confirmed:\s*/i, "").split("|");
            if (parts.length >= 4) {
              const name = parts[0].trim();
              const phone = parts[1].trim();
              const address = parts[2].trim();
              const city = parts[3].trim();

              updatedState.confirmedAddress = {
                name,
                phone,
                address,
                city,
              };

              // Automatically save this new address to the user's profile
              const currentUserId = session?.userId || userId || "guest";
              try {
                const userRec = await (prisma.user as any).findUnique({ where: { id: currentUserId }, select: { addresses: true } });
                let existingAddrs: any[] = [];
                if (userRec?.addresses) {
                  existingAddrs = typeof userRec.addresses === "string" ? JSON.parse(userRec.addresses) : userRec.addresses;
                  if (!Array.isArray(existingAddrs)) existingAddrs = [];
                }

                const newAddrId = crypto.randomUUID();
                const newAddr = {
                  id: newAddrId,
                  type: "custom",
                  label: name.split(" ")[0] + "'s Address", // custom label based on recipient
                  recipientName: name,
                  phone: phone,
                  addressLine: address,
                  city: city,
                  isDefault: existingAddrs.length === 0,
                };

                existingAddrs.push(newAddr);

                await (prisma.user as any).update({
                  where: { id: currentUserId },
                  data: { addresses: existingAddrs },
                });

                // Update local array so it gets passed down to the client in the SSE packet
                allUserAddresses = existingAddrs;
              } catch (err) {
                console.error("Failed to auto-save new address:", err);
              }
            }
          }

          // Fast-track after new address confirmation if delivery date is already set
          if (checkoutState.phase === "new_address_form" && updatedState.phase === "delivery_date_ask" && updatedState.confirmedAddress && updatedState.deliveryDate) {
            updatedState.phase = "payment_ask";
            (agentOutput as any).requiresDeliveryCheck = true;
          }

          // ── Handle delivery date check (delivery_date_ask → payment_ask) ──────────
          if ((agentOutput as any).requiresDeliveryCheck && updatedState.confirmedAddress?.city && updatedState.deliveryDate) {
            const city = updatedState.confirmedAddress.city;
            const date = updatedState.deliveryDate;

            let totalFee = 0;
            let deliveryCheck = null;
            let canDeliverAll = true;
            let nextAvail = null;
            let exactCityName = city;

            const itemsToCheck = updatedState.cartItems && updatedState.cartItems.length > 0
                ? updatedState.cartItems.map(i => i.id)
                : updatedState.product ? [updatedState.product.id] : [];

            send({ type: "thought", step: "checking_delivery", status: "running", content: `Checking delivery to ${city} on ${date} for ${itemsToCheck.length} item(s)...` });

            for (const pid of itemsToCheck) {
                send({ type: "tool_call", name: "kapruka_check_delivery", args: { city: city, date: date, product_id: pid } });
                const check = await pillar2_checkDelivery(city, date, pid);
                if (!check) {
                    canDeliverAll = false;
                    break;
                }
                if (!check.canDeliver) {
                    canDeliverAll = false;
                    nextAvail = check.deliveryDate;
                    break;
                }
                totalFee += (check.flatRateLKR || 0);
                deliveryCheck = check;
                exactCityName = check.city;
            }

            if (exactCityName) {
                updatedState.confirmedAddress.city = exactCityName;
            }

            send({ type: "thought", step: "checking_delivery", status: "completed", content: canDeliverAll ? `Delivery ✓ available in ${exactCityName}` : "Delivery not available on requested date", durationMs: 0 });

            if (!canDeliverAll || !deliveryCheck) {
              // Delivery NOT available — stay in delivery_date_ask with error message
              const nextAvailDate = nextAvail || deliveryCheck?.deliveryDate || "a later date";
              updatedState.phase = "delivery_date_ask";
              const errorOfs = {
                phase: "delivery_date_ask" as const,
                cartItems: updatedState.cartItems,
                confirmedAddress: updatedState.confirmedAddress,
                errorMessage: `Delivery to ${updatedState.confirmedAddress.city} is not available on ${updatedState.deliveryDate}. Next available: ${nextAvailDate}.`,
                deliveryCheckResult: {
                  city: updatedState.confirmedAddress.city,
                  canDeliver: false,
                  nextAvailableDate: nextAvailDate,
                },
              };
              await saveCheckoutState(sessionId, updatedState);
              send({ type: "order_flow_step", ...errorOfs });
              const errText = `Sorry, Grasshoppers can't deliver to **${updatedState.confirmedAddress.city}** on **${updatedState.deliveryDate}**. The next available date is **${nextAvailDate}**. Please pick a different date!`;
              await streamWords(errText);
              await saveOrderMessage(errText, errorOfs);
              controller.close();
              return;
            }

            // Pre-generate the checkout link
            send({ type: "thought", step: "placing_order", status: "running", content: "Pre-generating checkout link..." });
            try {
              const orderResult = await pillar1_createOrderLink(
                updatedState.cartItems.map((i: any) => ({ productId: i.id, quantity: i.quantity })),
                updatedState.confirmedAddress as any,
                undefined,
                updatedState.deliveryDate,
                updatedState.personalMessage
              );
              if (orderResult && orderResult.checkoutUrl && orderResult.orderId) {
                updatedState.checkoutUrl = orderResult.checkoutUrl;
                updatedState.orderId = orderResult.orderId;
                send({ type: "thought", step: "placing_order", status: "completed", content: "Generated secure checkout link", durationMs: 0 });
              } else {
                send({ type: "thought", step: "placing_order", status: "completed", content: "Failed to generate checkout link", durationMs: 0 });
              }
            } catch (err) {
              console.error("Pre-generation failed:", err);
              send({ type: "thought", step: "placing_order", status: "completed", content: "Pre-generation failed", durationMs: 0 });
            }

            // Delivery IS available — build OFS with delivery check result and advance to payment_ask
            updatedState.phase = "payment_ask";
            deliveryCheck.flatRateLKR = totalFee; // override with summed total fee
            updatedState.deliveryFeeLKR = deliveryCheck.flatRateLKR;
            const deliveryOfs = {
              phase: "payment_ask" as const,
              cartItems: updatedState.cartItems,
              confirmedAddress: updatedState.confirmedAddress,
              deliveryDate: updatedState.deliveryDate,
              personalMessage: updatedState.personalMessage,
              checkoutUrl: updatedState.checkoutUrl,
              orderId: updatedState.orderId,
              deliveryCheckResult: {
                city: deliveryCheck.city,
                canDeliver: true,
                flatRateLKR: deliveryCheck.flatRateLKR,
                nextAvailableDate: deliveryCheck.deliveryDate,
              },
              savedAddress: updatedState.savedAddress,
              paymentMethod: updatedState.paymentMethod,
            };
            await saveCheckoutState(sessionId, updatedState);
            send({ type: "order_flow_step", ...deliveryOfs });
            const feeText = deliveryCheck.flatRateLKR
              ? `Rs. ${deliveryCheck.flatRateLKR.toLocaleString()}`
              : "standard rate";
            const confirmText = `Delivery to **${deliveryCheck.city}** on **${updatedState.deliveryDate}** is confirmed (${feeText})! 🎉 How would you like to pay — **Cash on Delivery** or **Card Payment**?`;
            await streamWords(confirmText);
            await saveOrderMessage(confirmText, deliveryOfs);
            controller.close();
            return;
          }


          if (agentOutput.requiresOrderPlace) {
            send({ type: "thought", step: "placing_order", status: "running", content: "Placing order via Kapruka..." });

            let checkoutUrl: string | undefined;
            let orderId: string | undefined;
            let orderFailed = false;

            try {
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

              const od = await placeOrderInternally({
                items: orderItems,
                recipient: confirmedAddress as any,
                sessionId,
                userId: userId || undefined,
                paymentMethod: paymentMethod as "cod" | "card",
                deliveryDate: updatedState.deliveryDate || undefined,
                personalMessage: updatedState.personalMessage || undefined,
                deliveryFeeLKR: updatedState.deliveryFeeLKR || undefined,
                checkoutUrl: updatedState.checkoutUrl || undefined,
                orderId: updatedState.orderId || undefined,
              });

              checkoutUrl = od.checkoutLink?.checkoutUrl;
              orderId = od.orderResult?.orderId || `ord-${Date.now()}`;

              // Clear cart and checkout session on success
              await saveUserCart([]);
              await clearCheckoutState(sessionId);
            } catch (err: any) {
              console.error("[OrderAgent] place order failed:", err);
              orderFailed = true;
            }

            send({ type: "thought", step: "placing_order", status: "completed", content: orderFailed ? "Order placement failed ❌" : "Order placed ✓", durationMs: 0 });

            const cartItems = updatedState.cartItems || [];
            const subtotalLKR = cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
            const totalLKR = subtotalLKR + (updatedState.deliveryFeeLKR || 0);
            const itemsListStr = cartItems.map((i: any) => `${i.quantity}x **${i.name}**`).join(", ");

            let confirmationText = "";
            if (orderFailed) {
              confirmationText = `We encountered an issue placing your order for ${itemsListStr}. Please try again later.`;
            } else if (updatedState.paymentMethod === "cod") {
              confirmationText = `Your order for ${itemsListStr} is confirmed! 🎉 Our courier will deliver and collect **Rs. ${totalLKR.toLocaleString()}** in cash on arrival.`;
            } else {
              confirmationText = `Your order for ${itemsListStr} is confirmed! 🎉 Complete the payment via the secure link below to finalise your order.`;
            }

            const cs = {
              phase: "confirmed" as const,
              cartItems,
              confirmedAddress: updatedState.confirmedAddress,
              paymentMethod: updatedState.paymentMethod,
              checkoutUrl,
              orderId: orderFailed ? null : orderId, // Ensure it's null on failure
              deliveryDate: updatedState.deliveryDate,
              personalMessage: updatedState.personalMessage,
              deliveryCheckResult: updatedState.deliveryFeeLKR ? {
                city: updatedState.confirmedAddress?.city || "",
                canDeliver: true,
                flatRateLKR: updatedState.deliveryFeeLKR,
              } : undefined,
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
            savedAddresses: allUserAddresses, // NEW: pass full list for delivery_ask
            confirmedQuantity: updatedState.confirmedQty,
            confirmedAddress: updatedState.confirmedAddress,
            geocodedLocation: updatedState.geocodedLocation,
            paymentMethod: updatedState.paymentMethod,
            deliveryDate: updatedState.deliveryDate,
            personalMessage: updatedState.personalMessage,
            deliveryCheckResult: updatedState.deliveryFeeLKR ? {
              city: updatedState.confirmedAddress?.city || "",
              canDeliver: true,
              flatRateLKR: updatedState.deliveryFeeLKR,
            } : undefined,
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

          const refusalText = BUDDY_OFFTOPIC_REFUSAL;
          const words = refusalText.split(" ");
          for (let i = 0; i < words.length; i++) {
            send({ type: "text", content: words[i] + (i === words.length - 1 ? "" : " ") });
            await new Promise((r) => setTimeout(r, 40));
          }

          await prisma.chatMessage.create({
            data: {
              sessionId: sessionId,
              role: "assistant",
              content: refusalText,
              thoughtProcess: JSON.stringify({
                steps: [{ step: "intent_routing", status: "completed", content: "Query filtered by guardrails.", durationMs: 0 }],
                intent: "qa",
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
        let deliveryContext = "";
        let trackingContext = "";
        // Captured enriched tracking result — saved into thoughtProcess for refresh persistence
        let trackingResultForDB: import("@/lib/mcpClient").KaprukaTrackingResult | undefined;
        let serviceContext = "";
        let criteria: any = null;

        // ── Pillar 6: Category Browse ──────────────────────────────
        if (intent === "category_browse" && ai) {
          send({ type: "thought", step: "intent_routing", status: "completed", content: "Identified as: Category Browse.", durationMs: 0 });
          send({ type: "thought", step: "category_browse", status: "running", content: "Fetching product categories..." });
          const tCat = Date.now();
          const categoryTree = await getCachedCategories();

          if (categoryTree.length > 0) {
            const agentDecision = await categoryBrowseAgent(
              message,
              categoryTree,
              historySnippet,
              ai,
              config.gemini.fastModel
            );

            if (agentDecision.categoryGroups && agentDecision.categoryGroups.length > 0) {
              const groups: { title: string; products: KaprukaProduct[] }[] = [];
              let totalScraped = 0;

              for (const group of agentDecision.categoryGroups) {
                const urlsToScrape = group.categories.map(c => ({
                  url: c.url,
                  label: c.subcategory !== "Main Category Page" ? c.subcategory : c.mainCategory
                }));

                const scrapedResults = await scrapeMultipleCategoryUrls(urlsToScrape, 3, 150, { country: country });

                // Merge and deduplicate products within this semantic group
                const mergedProducts: KaprukaProduct[] = [];
                const seenIds = new Set<string>();
                for (const result of scrapedResults) {
                  for (const p of result.products) {
                    if (!seenIds.has(p.id)) {
                      seenIds.add(p.id);
                      p.currency = currency || p.currency || "LKR";
                      mergedProducts.push(p as any);
                    }
                  }
                }

                if (mergedProducts.length > 0) {
                   let validatedProducts = mergedProducts;
                   if (ai) {
                     send({ type: "thought", step: "validating_relevance", term: group.groupName, status: "running", content: `Validating ${mergedProducts.length} picked products from ${group.groupName}...` });
                     const tVal = Date.now();
                     validatedProducts = await llmValidateRelevance(mergedProducts, message, ai, config.gemini.fastModel);
                     const discarded = mergedProducts.length - validatedProducts.length;
                     send({ type: "thought", step: "validating_relevance", term: group.groupName, status: "completed", content: discarded > 0 ? `Relevance check: ✓ kept ${validatedProducts.length}, removed ${discarded}.` : `All ${validatedProducts.length} passed ✓`, durationMs: Date.now() - tVal });
                   }

                   if (validatedProducts.length > 0) {
                     groups.push({ title: group.groupName, products: validatedProducts });
                     totalScraped += validatedProducts.length;
                   }
                }
              }

              if (groups.length > 0) {
                productGroups = groups;
                products = groups.flatMap((g) => g.products);

                const stepCat = { step: "category_browse", status: "completed", content: `Found ${totalScraped} products across ${groups.length} categories in ${Date.now() - tCat}ms.`, durationMs: Date.now() - tCat };
                steps.push(stepCat);
                send({ type: "thought", ...stepCat });
                send({ type: "tool_result", toolName: "kapruka_category_browse", result: { products } });
                send({ type: "product_groups", groups: productGroups });
              } else {
                 // Fallback to text search if scraping failed entirely
                 intent = "product";
                 send({ type: "thought", step: "category_browse", status: "completed", content: "Could not pick products, falling back to standard search.", durationMs: Date.now() - tCat });
              }
            } else {
              intent = "product"; // fallback to text search if LLM failed
              send({ type: "thought", step: "category_browse", status: "completed", content: "No matching categories found, falling back to standard search.", durationMs: Date.now() - tCat });
            }
          } else {
             intent = "product";
             send({ type: "thought", step: "category_browse", status: "completed", content: "Category tree unavailable, falling back to standard search.", durationMs: Date.now() - tCat });
          }
        }

        // ── Pillar 1: Product Search & Order History ─────────────────────────────────────
        if (intent === "product" || intent === "order_history") {
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

            if (intent === "order_history") {
              const step1 = { step: "intent_routing", status: "completed", content: "Identified as: Order History Lookup.", durationMs: 0 };
              steps.push(step1);
              send({ type: "thought", ...step1 });
              send({ type: "thought", step: "searching_kapruka", status: "running", content: "Retrieving user's order history..." });

              if (userId && userId !== "guest") {
                const orderWhereClause = historyTimeline && !isNaN(new Date(historyTimeline).getTime())
                  ? { createdAt: { gte: new Date(historyTimeline) } }
                  : {};
                const takeLimit = historyTimeline ? undefined : 5;

                const userWithOrders = await prisma.user.findUnique({
                  where: { id: userId },
                  include: { orders: { where: orderWhereClause, include: { items: true }, orderBy: { createdAt: "desc" }, take: takeLimit } },
                });

                let orderProducts: KaprukaProduct[] = [];
                if (userWithOrders && userWithOrders.orders.length > 0) {
                  pastOrdersContext = `\n\n[User's Past Orders] You have access to the user's transaction history. The user (${userWithOrders.name}) has placed the following orders in the past:\n`;
                  for (const order of userWithOrders.orders) {
                    pastOrdersContext += `- Order Ref: ${order.id}, Date: ${order.createdAt.toISOString().split("T")[0]}, Status: ${order.status}, Total: LKR ${order.totalLKR}\n`;
                    for (const item of order.items) {
                      if (historyTarget && !item.productName.toLowerCase().includes(historyTarget.toLowerCase())) {
                        continue;
                      }
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
                  pastOrdersContext += `\nInstruction to AI: The user wants to view their order history. Confirm the details of the items found (item name, price, order date) and mention they can view them below.`;
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
                        pillar1_searchProducts(v, { maxPriceLKR: queryMaxPrice ?? undefined, smeFirst: false, currency: currency || "LKR" })
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
                      if (!seenIds.has(p.id)) {
                        seenIds.add(p.id);
                        p.currency = currency || p.currency || "LKR";
                        rawProducts.push(p);
                      }
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

                // Rely on raw search engine relevance and run the LLM relevance validator.
                const keywordDiscarded = priceFilterDiscarded;

                let validated = filteredPriceProducts;
                let llmDiscarded = 0;

                if (ai && filteredPriceProducts.length > 0) {
                  send({ type: "thought", step: "validating_relevance", term: baseTerm, status: "running", content: `Validating ${filteredPriceProducts.length} result${filteredPriceProducts.length !== 1 ? "s" : ""} for "${baseTerm}"...` });
                  const t2 = Date.now();
                  validated = await llmValidateRelevance(filteredPriceProducts, message, ai, config.gemini.fastModel);
                  const validationDur = Date.now() - t2;
                  llmDiscarded = filteredPriceProducts.length - validated.length;
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

          // ── Helper: enrich MCP tracking result with our DB order data ────
          // The MCP always returns progress steps for the fallback order number.
          // We overlay user-specific fields (product names, total, delivery date,
          // gift message) from our DB so the TrackingCard shows real user data.
          const enrichTrackingResult = (
            rawTracking: Awaited<ReturnType<typeof pillar2_trackOrder>>,
            dbOrder: {
              id: string;
              totalLKR: number;
              deliveryDate: string | null;
              personalMessage: string | null;
              items: Array<{ productName: string; quantity: number; priceLKR: number }>;
            }
          ) => {
            if (!rawTracking) return rawTracking;
            return {
              ...rawTracking,
              displayOrderRef: dbOrder.id,
              displayTotalLKR: dbOrder.totalLKR,
              displayItems: dbOrder.items.map((i) => ({
                name: i.productName,
                quantity: i.quantity,
                priceLKR: i.priceLKR,
              })),
              displayPersonalMessage: dbOrder.personalMessage ?? undefined,
            };
          };

          if (orderId) {
            // ── Path A: User typed an explicit order ID ───────────────────
            // We always use the fallback number for the MCP call (since our
            // kaprukaRef is not a valid Kapruka order number). We then try to
            // enrich the result with the user's most recent DB order.
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Tracking order: ${orderId}`, durationMs: 0 });
            send({ type: "thought", step: "tracking_order", status: "running", content: `Fetching live status for order ${orderId}...` });
            send({ type: "tool_call", name: "kapruka_track_order", args: { order_number: KAPRUKA_FALLBACK_ORDER_NUMBER } });
            const t = Date.now();
            const tracking = await pillar2_trackOrder(KAPRUKA_FALLBACK_ORDER_NUMBER);
            const dur = Date.now() - t;
            if (tracking) {
              // Try to enrich with the user's most recent DB order (best effort)
              let enrichedTracking = tracking;
              if (userId && userId !== "guest") {
                try {
                  const latestOrder = await prisma.order.findFirst({
                    where: { userId },
                    include: { items: true },
                    orderBy: { createdAt: "desc" },
                  });
                  if (latestOrder) {
                    enrichedTracking = enrichTrackingResult(tracking, latestOrder) ?? tracking;
                  }
                } catch (enrichErr) {
                  console.warn("[route.ts] Path A enrichment failed (non-fatal):", enrichErr);
                }
              }
              trackingContext = `\n\n[Tracking Result] Order ID: ${enrichedTracking.displayOrderRef || orderId}. Current Status: ${enrichedTracking.currentStatus}. Estimated Delivery: ${enrichedTracking.estimatedDelivery || "N/A"}. Use this in your response.`;
              steps.push({ step: "tracking_order", status: "completed", content: `Order ${orderId} status: ${enrichedTracking.currentStatus}`, durationMs: dur });
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Order status retrieved successfully.", durationMs: dur });
              // Capture for DB persistence so the card survives page refresh
              trackingResultForDB = enrichedTracking;
              send({ type: "tracking_result", result: enrichedTracking });
            } else {
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Could not retrieve order status.", durationMs: dur });
            }

          } else if (!city && userId && userId !== "guest") {
            // ── Path B: Smart natural-language lookup (logged-in users only) ─
            // e.g. "where is my last order?", "where is my roses order now?"
            // Always use the fallback order number for MCP, then enrich the
            // result with the matched order's actual DB data.
            send({ type: "thought", step: "intent_routing", status: "completed", content: "Looking up your orders...", durationMs: 0 });
            send({ type: "thought", step: "tracking_order", status: "running", content: "Searching your order history..." });

            try {
              const userOrders = await prisma.order.findMany({
                where: { userId },
                include: { items: true },
                orderBy: { createdAt: "desc" },
                take: 20,
              });

              let matchedOrder: typeof userOrders[0] | null = null;
              const lowerMsg = message.toLowerCase();

              // "last", "recent", "latest", "newest" → most recent order
              if (/\b(last|recent|latest|newest|previous)\b/.test(lowerMsg)) {
                matchedOrder = userOrders[0] || null;
              } else {
                // Keyword match against product names in order items
                const stopWords = /\b(where|is|my|order|orders|now|status|track|tracking|the|a|an|of|for|i|was|find|show|what|about|please|can|you)\b/g;
                const keywords = lowerMsg
                  .replace(stopWords, " ")
                  .trim()
                  .split(/\s+/)
                  .filter((w: string) => w.length > 2);

                if (keywords.length > 0) {
                  matchedOrder =
                    userOrders.find((order) =>
                      order.items.some((item) =>
                        keywords.some((kw: string) => item.productName.toLowerCase().includes(kw))
                      )
                    ) || null;
                }
              }

              if (matchedOrder) {
                // Always use the fallback order number — kaprukaRef is not a
                // real Kapruka order number and cannot be used for tracking.
                send({ type: "thought", step: "tracking_order", status: "running", content: `Found your order. Fetching live status...` });
                send({ type: "tool_call", name: "kapruka_track_order", args: { order_number: KAPRUKA_FALLBACK_ORDER_NUMBER } });
                const tTrack = Date.now();
                const rawTracking = await pillar2_trackOrder(KAPRUKA_FALLBACK_ORDER_NUMBER);
                const dur = Date.now() - tTrack;
                if (rawTracking) {
                  // Enrich MCP result with the user's real order data from DB
                  const enrichedTracking = enrichTrackingResult(rawTracking, matchedOrder) ?? rawTracking;
                  trackingContext = `\n\n[Tracking Result] Order ID: ${enrichedTracking.displayOrderRef || matchedOrder.id}. Current Status: ${enrichedTracking.currentStatus}. Estimated Delivery: ${enrichedTracking.estimatedDelivery || "N/A"}. Use this in your response.`;
                  steps.push({ step: "tracking_order", status: "completed", content: `Status: ${enrichedTracking.currentStatus}`, durationMs: dur });
                  send({ type: "thought", step: "tracking_order", status: "completed", content: `Order status: ${enrichedTracking.currentStatus}`, durationMs: dur });
                  // Capture for DB persistence so the card survives page refresh
                  trackingResultForDB = enrichedTracking;
                  send({ type: "tracking_result", result: enrichedTracking });
                } else {
                  send({ type: "thought", step: "tracking_order", status: "completed", content: "Kapruka tracking unavailable right now.", durationMs: dur });
                }
              } else {
                send({ type: "thought", step: "tracking_order", status: "completed", content: "No matching orders found in your history.", durationMs: 0 });
              }
            } catch (err) {
              console.error("[route.ts] smart order tracking failed:", err);
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Error looking up your orders.", durationMs: 0 });
            }

          } else if (!city && (!userId || userId === "guest")) {
            // ── Path C: Guest user asked about their orders ────────────────
            // Mirrors the existing order_history guest behaviour — ask to sign in.
            send({ type: "thought", step: "intent_routing", status: "completed", content: "Guest user — sign-in required for order tracking.", durationMs: 0 });

          } else if (city) {
            // ── Path D: Delivery availability check (unchanged) ────────────
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Checking Grasshoppers delivery to ${city}`, durationMs: 0 });
            send({ type: "thought", step: "checking_delivery", status: "running", content: `Checking delivery availability to ${city} on ${date}${isPerishable ? " (perishable)" : ""}...` });
            send({ type: "tool_call", name: "kapruka_check_delivery", args: { city, date, product_id: "GENERAL" } });
            const t = Date.now();
            const delivery = await pillar2_checkDelivery(city, date, "GENERAL");
            const dur = Date.now() - t;
            if (delivery) {
              deliveryContext = `\n\n[Delivery Check Result] City: ${delivery.city}. Available: ${delivery.canDeliver ? 'Yes' : 'No'}. Flat Rate: LKR ${delivery.flatRateLKR || "N/A"}. Date: ${delivery.deliveryDate || "N/A"}. Warning: ${delivery.warning || "None"}. Use this exact rate and availability in your response.`;
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
          if (serviceResult) {
            serviceContext = `\n\n[Service Providers Found] Category: ${serviceResult.categoryLabel}. Needs City Input: ${serviceResult.needsCityInput ? 'Yes' : 'No'}. Providers: ${JSON.stringify(serviceResult.providers.map(p => ({name: p.name, rating: p.rating, pricing: p.pricingLKR})))}.`;
          }
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

            if (intent === "product" || intent === "category_browse") {
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
- Use \`[INTRO: <CategoryName>]\` followed by a 1-sentence friendly opener — like you're pointing something out to a friend.
- Use \`[DETAILS: <CategoryName>]\` followed by a 2-3 sentence buddy-style rundown — mention standout picks, price highlights in LKR, and stock status. Talk naturally and confidently, like you're shopping together.
Make sure the category name in the tags matches the search result headers above exactly. Do not write any general text outside these tags.`;
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

            if (deliveryContext) {
              contextNote += deliveryContext;
            }

            if (trackingContext) {
              contextNote += trackingContext;
            }

            if (serviceContext) {
              contextNote += serviceContext;
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
            const suggestPrompt = `You are helping a friendly Sri Lankan shopping assistant suggest next steps. Given this user query and AI response, generate exactly 3 short, casual follow-up prompts the user would naturally say next (written from the user's perspective — action-oriented, not formal. Max 8 words each. Think: what would a friend say next?).
Context pillar: ${intent}
User: "${message.substring(0, 100)}"
AI: "${fullResponseText.substring(0, 200)}"
Respond ONLY as JSON array: ["query1", "query2", "query3"]`;

            const sug = await ai.models.generateContent({
              model: config.gemini.fastModel,
              contents: suggestPrompt,
              config: { responseMimeType: "application/json" },
            });
            let sugText = sug.text || "[]";
            if (sugText.includes("```")) {
              sugText = sugText.replace(/```json/i, "").replace(/```/g, "");
            }
            sugText = sugText.trim();
            sugText = extractFirstJsonArray(sugText);
            const parsed = JSON.parse(sugText);
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
              // Persist trackingResult so the TrackingCard survives page refresh
              trackingResult: trackingResultForDB ?? undefined,
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
});

// ── Static follow-up fallbacks per intent ─────────────────────────────────
const STATIC_FOLLOW_UPS: Record<Intent, string[]> = {
  product: [
    "Show me products under Rs. 2,000",
    "Filter by local Sri Lankan brands",
    "How do I buy and pay for this?",
  ],
  category_browse: [
    "Show me the best selling ones",
    "Filter by local Sri Lankan brands",
    "Are these available for same day delivery?",
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
  order_history: [
    "What are the products that I ordered previously?",
    "What did I buy last month?",
    "Track my past orders",
  ],
};

// ── Static response fallback (if no Gemini API key) ───────────────────────
function generateFallback(intent: Intent, message: string, products: KaprukaProduct[]): string {
  switch (intent) {
    case "product":
      return products.length > 0
        ? `I found ${products.length} matching products on Kapruka for "${message}". Click "Buy Now" on any product to start checkout.`
        : `I searched the Kapruka catalog for "${message}". Please refine your search with more specific keywords.`;
    case "category_browse":
      return products.length > 0
        ? `I found ${products.length} products in matching Kapruka categories. Click "Buy Now" on any product to start checkout.`
        : `I searched Kapruka categories for "${message}" but couldn't find matches. Please be more specific.`;
    case "delivery":
      return "I can check Kapruka Grasshoppers delivery availability and rates to any Sri Lankan city.";
    case "service":
      return "I can connect you with verified home service technicians in your area.";
    case "qa":
      return "Kapruka accepts Credit/Debit cards, bank transfers, and cash on delivery for select areas.";
    case "order_history":
      return products.length > 0
        ? `I found ${products.length} past purchases. Click on any product to view details or add it to your cart.`
        : "I couldn't find any past orders matching that description.";
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
  userQuery: string,
  aiClient: GoogleGenAI,
  fastModel: string
): Promise<KaprukaProduct[]> {
  if (products.length === 0) return [];
  const productsToCheck = products;
  const productList = productsToCheck.map((p, i) => `${i + 1}. [${p.id}] ${p.name}`).join("\n");

  const prompt = `You are a product relevance validator for a e-commerce search agent.

User's query: "${userQuery}"

For each product below, decide if it should be kept and assign a relevance score (1-100).
- KEEP (Score > 0): The product IS what the user might want or related.
- DISCARD: The product only shares a keyword but is categorically different, or is completely irrelevant.

Score criteria:
- 90-100: Exact match to user intent.
- 50-89: Good match, highly relevant.
- 1-49: Loosely related but still valid.

Examples:
- Searching "shoes" → sandals, boots, sneakers = KEEP (high score). Shoe rack, shoe box = DISCARD.
- Searching "cake" → birthday cake = KEEP. Cake mold = DISCARD.

Products:
${productList}

Respond ONLY with valid JSON: {"kept_items":[{"id":"id1","score":95}],"reason":"one-line explanation"}`;

  try {
    const result = await aiClient.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            kept_items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  score: { type: "INTEGER" }
                },
                required: ["id", "score"]
              }
            },
            reason: { type: "STRING" },
          },
          required: ["kept_items", "reason"],
        },
      },
    });

    let text = (result.text || "{}").trim().replace(/```json/i, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text);
    const keptItems = Array.isArray(parsed?.kept_items) ? parsed.kept_items : [];

    const scoreMap = new Map<string, number>();
    for (const item of keptItems) {
      scoreMap.set(item.id, item.score);
    }

    const filtered = productsToCheck.filter((p) => scoreMap.has(p.id));
    const combined = filtered.map((p) => {
      return {
        ...p,
        _relevanceScore: scoreMap.get(p.id) ?? 1
      };
    });

    // Sort in descending order of relevance score
    combined.sort((a, b) => {
      const scoreA = (a as any)._relevanceScore ?? 0;
      const scoreB = (b as any)._relevanceScore ?? 0;
      return scoreB - scoreA;
    });

    console.log(`[LLM Validator] "${userQuery.substring(0, 40)}": kept ${filtered.length}/${productsToCheck.length}. Reason: ${parsed?.reason || "n/a"}`);
    return combined;
  } catch (err) {
    console.error(`[LLM Validator] Failed for "${userQuery.substring(0, 40)}":`, (err as Error).message);
    return products;
  }
}

function extractFirstJsonArray(text: string): string {
  const start = text.indexOf("[");
  if (start === -1) return text;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "[") {
        depth++;
      } else if (char === "]") {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }
  }
  return text;
}
