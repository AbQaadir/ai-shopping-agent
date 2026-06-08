import { prisma } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import {
  pillar1_searchProducts,
  pillar2_checkDelivery,
  pillar2_trackOrder,
  pillar2_findCity,
  pillar3_searchSMEProducts,
  pillar4_estimateImportCost,
  pillar5_detectServiceCategory,
  pillar5_searchServiceProviders,
  parseRequirements,
  type KaprukaProduct,
} from "@/lib/tools";

// ── Intent Types ────────────────────────────────────────────────────────────
type Intent = "product" | "delivery" | "import" | "service" | "qa";

// ── System Prompts per Pillar ───────────────────────────────────────────────
const SYSTEM_PROMPTS: Record<Intent, string> = {
  product: `You are Kapuruka's AI shopping assistant for Sri Lanka. 
The user wants to find or buy products. Live product results from Kapruka.com have been fetched and shown to the user. 
Summarise the best options in 2–3 sentences. Mention price ranges in LKR and highlight any local Sri Lankan brands.
Do NOT fabricate product details — only reference what was returned by the search tool.
If the user wants to buy a specific product, guide them to click the "Buy Now" button.`,

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

  qa: `You are Kapuruka's customer support assistant for Sri Lanka.
Answer questions about the platform: payment methods, delivery terms, return policy, seller information, and general help.
Be concise and accurate. If you don't know something, say so honestly and suggest contacting support at support@kapruka.com.`,
};

// ── URL Detection (for import intent) ──────────────────────────────────────
function extractUrlFromMessage(message: string): string | null {
  const urlRegex = /https?:\/\/[^\s]+/i;
  const match = message.match(urlRegex);
  return match ? match[0] : null;
}

// ── Price extraction for import queries ────────────────────────────────────
function extractUsdPrice(message: string): number | undefined {
  const match = message.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (match) return parseFloat(match[1].replace(",", ""));
  const wordMatch = message.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:usd|dollars?)/i);
  if (wordMatch) return parseFloat(wordMatch[1].replace(",", ""));
  return undefined;
}

// ── City extraction for delivery queries ───────────────────────────────────
function extractCityFromMessage(message: string): string | null {
  const knownCities = [
    "Colombo", "Kandy", "Galle", "Negombo", "Jaffna", "Trincomalee",
    "Batticaloa", "Kurunegala", "Anuradhapura", "Ratnapura", "Badulla",
    "Matara", "Hambantota", "Nuwara Eliya", "Matale", "Gampaha",
    "Kalutara", "Kegalle", "Polonnaruwa", "Mullaitivu", "Vavuniya",
    "Mannar", "Puttalam", "Ampara", "Monaragala",
  ];
  const lower = message.toLowerCase();
  return knownCities.find((c) => lower.includes(c.toLowerCase())) || null;
}

// ── Order ID extraction ─────────────────────────────────────────────────────
function extractOrderId(message: string): string | null {
  const match = message.match(/\b(KAP-?[A-Z0-9]{6,12}|order[:\s#]*([A-Z0-9-]{6,15}))\b/i);
  return match ? (match[2] || match[1]).toUpperCase() : null;
}

// ── Date extraction (simple) ───────────────────────────────────────────────
function extractDate(message: string): string {
  const lower = message.toLowerCase();
  const today = new Date();
  if (lower.includes("tomorrow")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }
  if (lower.includes("saturday")) {
    const d = new Date(today);
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    return d.toISOString().split("T")[0];
  }
  if (lower.includes("sunday")) {
    const d = new Date(today);
    d.setDate(d.getDate() + ((0 - d.getDay() + 7) % 7 || 7));
    return d.toISOString().split("T")[0];
  }
  // Default to tomorrow
  const d = new Date(today);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// ── Rule-based intent fallback ─────────────────────────────────────────────
function ruleBasedIntent(message: string): Intent {
  const lower = message.toLowerCase();

  // Import: URL presence = definitive signal
  if (/https?:\/\/(www\.)?(amazon|walmart|ebay|aliexpress|target)\./i.test(lower)) return "import";
  if (/import|from amazon|from abroad|overseas|global shop|landed cost|customs duty/i.test(lower)) return "import";

  // Delivery / tracking
  if (/track|tracking|order status|where.*order|my order/i.test(lower)) return "delivery";
  if (/deliver.*to|can.*deliver|delivery.*rate|flat rate|grasshoppers|ship.*to|when.*arrive/i.test(lower)) return "delivery";

  // Service
  if (/repair|fix.*my|broken|not working|technician|plumber|electrician|ac.*repair|cleaning service|pest control/i.test(lower)) return "service";
  if (/book.*service|service.*provider|home service/i.test(lower)) return "service";

  // QA
  if (/payment|return|policy|refund|contact|support|faq|how.*work|what.*kapruka|terms/i.test(lower)) return "qa";

  // Default to product search
  return "product";
}

// ── Main Chat POST Handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, message } = body;

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
        },
      });
    }

    // 2. Save user message to DB
    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: "user", content: message },
    });

    // 3. Determine intent ───────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    let genAI: InstanceType<typeof GoogleGenerativeAI> | null = null;
    let classifierModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]> | null = null;
    let mainModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]> | null = null;

    // Start with rule-based, then refine with LLM
    let intent: Intent = ruleBasedIntent(message);

    if (apiKey) {
      try {
        genAI = new GoogleGenerativeAI(apiKey);
        const fastModel = process.env.FAST_GEMINI_MODEL || "gemini-1.5-flash-8b";
        const reasoningModel = process.env.REASONING_GEMINI_MODEL || "gemini-1.5-flash";

        classifierModel = genAI.getGenerativeModel({ model: fastModel });
        mainModel = genAI.getGenerativeModel({ model: reasoningModel });

        // LLM-based intent refinement
        const classifierPrompt = `Classify this Sri Lankan e-commerce user message into exactly ONE intent:

- "product": Searching for, comparing, or buying products on Kapruka.com (e.g. cakes, gifts, clothes, electronics)
- "delivery": Checking delivery availability to a city, delivery rates, tracking an existing order
- "import": User pastes a URL from Amazon/Walmart/eBay, or asks about importing goods from abroad + customs/duties
- "service": User needs a home service (repair, cleaning, pest control, plumber, electrician, AC repair, carpentry)
- "qa": General platform questions (payment, returns, policies, account help)

Respond ONLY with JSON: {"intent": "product"|"delivery"|"import"|"service"|"qa", "reason": "brief"}

User message: "${message.substring(0, 300)}"`;

        const result = await classifierModel.generateContent({
          contents: [{ role: "user", parts: [{ text: classifierPrompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        });

        const parsed = JSON.parse(result.response.text());
        if (parsed?.intent && ["product", "delivery", "import", "service", "qa"].includes(parsed.intent)) {
          intent = parsed.intent as Intent;
          console.log(`[Intent] "${message.substring(0, 60)}" → ${intent} (${parsed.reason})`);
        }
      } catch (err) {
        console.error("[Intent] LLM classification failed, using rule-based:", (err as Error).message);
      }
    }

    // 4. Build SSE stream ──────────────────────────────────────────────────
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const steps: Array<{ step: string; status: string; content: string; durationMs: number }> = [];
        let products: KaprukaProduct[] = [];
        let fullResponseText = "";

        // ── Pillar 1 & 3: Product Search ───────────────────────────────────
        if (intent === "product" || intent === "service") {
          // For "service" the LLM will handle text, but we still check product context
        }

        if (intent === "product") {
          // Step 1: Parse requirements
          send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Kapruka product catalog..." });
          const criteria = parseRequirements(message);

          const step1 = {
            step: "intent_routing",
            status: "completed",
            content: `Identified as: Product Search. Keywords: [${criteria.keywords.slice(0, 5).join(", ")}]${criteria.maxPrice ? `. Max price: Rs. ${criteria.maxPrice.toLocaleString()}` : ""}`,
            durationMs: 0,
          };
          steps.push(step1);
          send({ type: "thought", ...step1 });

          // Step 2: MCP product search
          const t2 = Date.now();
          send({ type: "thought", step: "searching_kapruka", status: "running", content: `Searching Kapruka live catalog for "${criteria.keywords.join(" ")}"...` });
          send({ type: "tool_call", name: "kapruka_search_products", args: { query: criteria.keywords.join(" "), max_price: criteria.maxPrice } });

          products = await pillar1_searchProducts(criteria.keywords.join(" "), {
            maxPriceLKR: criteria.maxPrice,
            smeFirst: false,
          });
          const dur2 = Date.now() - t2;

          const step2 = {
            step: "searching_kapruka",
            status: "completed",
            content: products.length > 0
              ? `Found ${products.length} products from Kapruka live catalog.`
              : "No exact matches — showing closest available products.",
            durationMs: dur2,
          };
          steps.push(step2);
          send({ type: "thought", ...step2 });
          send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });
        }

        // ── Pillar 3: SME/Partner Central ──────────────────────────────────
        if (intent === "product") {
          // Check if this is an SME-focused query
          const smeQuery = /artisan|local.*brand|sri lankan.*made|handmade|sme|small.*business|partner central|local.*gift/.test(message.toLowerCase());
          if (smeQuery) {
            send({ type: "thought", step: "sme_filter", status: "running", content: "Highlighting local Sri Lankan SME products..." });
            const t3 = Date.now();
            const smeProducts = await pillar3_searchSMEProducts(message);
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
          send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Customer Support knowledge base..." });
          const step1 = { step: "intent_routing", status: "completed", content: "Identified as: Customer Support query. Consulting Kapruka platform policies.", durationMs: 0 };
          steps.push(step1);
          send({ type: "thought", ...step1 });
        }

        // ── LLM Response Generation ────────────────────────────────────────
        send({ type: "thought", step: "generating_response", status: "running", content: "Generating AI response..." });

        if (mainModel) {
          try {
            // Build chat history for context
            const chatHistory = await prisma.chatMessage.findMany({
              where: { sessionId: session.id },
              orderBy: { createdAt: "asc" },
            });

            // Augment context with tool results for the LLM
            let contextNote = "";
            if (intent === "product" && products.length > 0) {
              contextNote = `\n\n[Tool Results] Found ${products.length} products on Kapruka:\n` +
                products.slice(0, 5).map((p, i) =>
                  `${i + 1}. ${p.name} — Rs. ${p.price?.toLocaleString() || "N/A"} (${p.inStock ? "In Stock" : "Out of Stock"})${p.isSME ? " 🇱🇰 Local Brand" : ""}`
                ).join("\n");
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

            const chatModel = genAI!.getGenerativeModel({
              model: process.env.REASONING_GEMINI_MODEL || "gemini-1.5-flash",
              systemInstruction: SYSTEM_PROMPTS[intent],
            });

            const geminiStream = await chatModel.generateContentStream({
              contents: geminiHistory,
            });

            for await (const chunk of geminiStream.stream) {
              const text = chunk.text();
              fullResponseText += text;
              send({ type: "text", content: text });
            }
          } catch (err) {
            console.error("[LLM] Gemini stream error:", (err as Error).message);
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

        if (classifierModel) {
          try {
            const suggestPrompt = `Given this user query and AI response for a Sri Lankan e-commerce platform, generate exactly 3 short follow-up questions (max 8 words each). 
Context pillar: ${intent}
User: "${message.substring(0, 100)}"
AI: "${fullResponseText.substring(0, 200)}"
Respond ONLY as JSON array: ["question1", "question2", "question3"]`;

            const sug = await classifierModel.generateContent({
              contents: [{ role: "user", parts: [{ text: suggestPrompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            });
            const parsed = JSON.parse(sug.response.text());
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
            thoughtProcess: JSON.stringify({ steps, intent, followUpQuestions }),
            products: products.length > 0 ? JSON.stringify(products) : undefined,
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
