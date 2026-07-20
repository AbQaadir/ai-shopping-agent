const STATIC_FOLLOW_UPS: Record<string, string[]> = {
  product: ["Show me products under Rs. 2,000", "Filter by local Sri Lankan brands"],
  order: ["Where is my order?", "Can I cancel my order?", "Change delivery address"],
  delivery: ["Do you deliver to Kandy?", "How much is delivery to Galle?", "Same day delivery options"],
  category_browse: ["Show me birthday cakes", "Electronics", "Fresh flowers"],
  local_sme: ["Show me wooden crafts", "Handloom items", "Local spices"],
  unknown: ["What can you help me with?", "How do I place an order?"]
};
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { clearCheckoutState, getCheckoutState, saveCheckoutState, CheckoutState } from "@/lib/checkoutContext";
import { loadUserCart, saveUserCart } from "../session";
import { saveOrderMessage } from "../streamContext";
import { ChatHandlerContext } from "./types";
import { KaprukaProduct, parseRequirements, pillar1_getProductDetails, pillar1_searchProducts, pillar2_checkDelivery, pillar2_findCity, pillar2_trackOrder, pillar3_searchSMEProducts, pillar5_detectServiceCategory, pillar5_searchServiceProviders, getCachedCategories, scrapeMultipleCategoryUrls } from "@/lib/tools";
import { categoryBrowseAgent } from "@/lib/agents/categoryBrowseAgent";
import { searchEvaluatorAgent } from '@/lib/agents/searchEvaluatorAgent';
import { responseEvaluatorAgent } from '@/lib/agents/responseEvaluatorAgent';
import { logEval } from '@/lib/harness/harnessLogger';
import { BUDDY_PROMPTS, BUDDY_SELECTED_PRODUCT_PROMPT, BUDDY_OFFTOPIC_REFUSAL } from "@/lib/prompts/personality";
import { Intent, extractOrderId, extractCityFromMessage, extractDate } from "@/lib/nlp";
import { GoogleGenAI } from "@google/genai";
import { SearchTermConfig } from "../intent";

const KAPRUKA_FALLBACK_ORDER_NUMBER = "VPAY827982BA";
const SYSTEM_PROMPTS: Record<Intent, string> = BUDDY_PROMPTS as Record<Intent, string>;
const SELECTED_PRODUCT_QA_PROMPT = BUDDY_SELECTED_PRODUCT_PROMPT;

// The helpers that were defined at the bottom of route.ts
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

export async function handleShopFlow(action: string, ctx: ChatHandlerContext) {
  let {
    sessionId, userId, message, checkoutState, allUserAddresses, savedAddr, ai,
    fetchedSelectedProducts, availableProducts, streamContext,
    intent, isRelated, llmSearchTerms, historyTarget, historyTimeline,
    isAgeRestricted, historySnippet, sessionContext, country, currency, criteria, intentResult
  } = ctx;
  
  const send = streamContext.send.bind(streamContext);
  const streamWords = streamContext.streamWords.bind(streamContext);
  const createMcpContext = streamContext.createMcpContext.bind(streamContext);
  const controller = streamContext; // allows controller.close()
  const hasSelectedProducts = fetchedSelectedProducts.length > 0;
  let session = await prisma.chatSession.findUnique({ where: { id: sessionId } });

// ── Action: checkout_pause ─────────────────────────────────────────
        // Falls through to the normal shop flow below, but with checkout context
        // injected into the LLM prompt so the agent knows checkout is paused.

        // ── Action: shop (+ checkout_pause) ───────────────────────────────
        // Everything below is the UNCHANGED product search / delivery / services / QA flow.

        // ── Off-topic queries are now routed to general conversation ──
        // Instead of refusing, we treat unrelated queries as "general" intent
        // and let the LLM respond like a normal chatbot (with Google Search grounding).
        if (!isRelated) {
          intent = "general";
          send({ type: "thought", step: "intent_routing", status: "completed", content: "Routed to general conversation mode.", durationMs: 0 });
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

        // ── Pillar 6: Category Browse ──────────────────────────────
        if ((intent as string) === "category_browse" && ai) {
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
        if ((intent as string) === "product" || intent === "order_history") {
          if (hasSelectedProducts && fetchedSelectedProducts.length > 0) {
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Processing ${(hasSelectedProducts ? 1 : 0)} selected product(s)...`, durationMs: 0 });
            send({ type: "thought", step: "fetching_product_details", status: "running", content: "Fetching selected product details..." });
            send({ type: "tool_call", name: "kapruka_get_product", args: { productIds: hasSelectedProducts } });
            products = fetchedSelectedProducts;
            const step2 = { step: "fetching_product_details", status: "completed", content: `Retrieved ${products.length} product(s).`, durationMs: 0 };
            steps.push(step2);
            send({ type: "thought", ...step2 });
            send({ type: "tool_result", toolName: "kapruka_search_products", result: { products } });
          } else {
            send({ type: "thought", step: "intent_routing", status: "running", content: "Routing to Kapruka product catalog..." });
              criteria = intentResult?.entities || {};

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
                
                const t1 = Date.now();
                const variantSettled = await Promise.allSettled(
                  variants.map((v, vi) =>
                    new Promise<KaprukaProduct[]>((resolve, reject) => {
                      setTimeout(() => {
                        pillar1_searchProducts(v, { maxPriceLKR: queryMaxPrice ?? undefined, smeFirst: false, currency: currency || "LKR" }, createMcpContext("searching_kapruka"))
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

              // ── Harness: Search Evaluator ─────────────────────────────────
              // Evaluates result quality and can trigger a refined search if
              // the results don't adequately match the user's query.
              const harnessEnabled = process.env.HARNESS_SEARCH_EVAL_ENABLED !== 'false';
              if (ai && harnessEnabled && products.length > 0 && !hasSelectedProducts) {
                send({ type: "thought", step: "search_evaluator", status: "running", content: "Evaluating result quality..." });
                const evalStart = Date.now();
                let regenAttempts = 0;
                const MAX_REGEN = 2;

                let evalResult = await searchEvaluatorAgent({
                  originalQuery: message,
                  searchTermsUsed: baseLlmTerms.map((t: any) => t.term),
                  results: products,
                  historySnippet,
                  priceConstraints: { min: null, max: criteria?.maxPrice ?? null },
                  ai,
                  fastModel: config.gemini.fastModel,
                });

                while (evalResult.shouldRegenerate && regenAttempts < MAX_REGEN) {
                  regenAttempts++;
                  const refinedTerm = evalResult.suggestedQueryRefinements[0] || message;
                  send({ type: "thought", step: "search_evaluator", status: "running", content: `Refining search with term: "${refinedTerm}"...` });

                  try {
                    const refinedResults = await pillar1_searchProducts(
                      refinedTerm,
                      { maxPriceLKR: criteria?.maxPrice ?? undefined, smeFirst: false, currency: currency || 'LKR' },
                      createMcpContext('searching_kapruka')
                    );
                    if (refinedResults.length > 0) {
                      products = [...refinedResults, ...products].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).slice(0, 20);
                      productGroups = [{ title: refinedTerm.replace(/\b\w/g, (c: string) => c.toUpperCase()), products }];
                      send({ type: "product_groups", groups: productGroups });
                    }
                    evalResult = await searchEvaluatorAgent({
                      originalQuery: message,
                      searchTermsUsed: [refinedTerm],
                      results: products,
                      historySnippet,
                      priceConstraints: { min: null, max: criteria?.maxPrice ?? null },
                      ai,
                      fastModel: config.gemini.fastModel,
                    });
                  } catch (regenErr) {
                    console.error('[Harness:SearchEval] Regen search failed:', (regenErr as Error).message);
                    break;
                  }
                }

                const evalLatency = Date.now() - evalStart;
                send({ type: "thought", step: "search_evaluator", status: "completed", content: `Quality score: ${evalResult.overallScore.toFixed(1)}/10 — ${products.length} results ready${regenAttempts > 0 ? ` (refined ${regenAttempts}x)` : ''}.` });

                // Log to HarnessEvalLog (fire-and-forget)
                const savedMsgForEval = await prisma.chatMessage.findFirst({ where: { sessionId: session?.id || sessionId, role: 'user' }, orderBy: { createdAt: 'desc' } });
                logEval({
                  sessionId: session?.id || sessionId,
                  messageId: savedMsgForEval?.id ?? 'unknown',
                  evaluatorType: 'search_evaluator',
                  score: evalResult.overallScore,
                  passed: !evalResult.shouldRegenerate,
                  feedback: evalResult.feedback,
                  regenerated: regenAttempts > 0,
                  latencyMs: evalLatency,
                  context: { originalQuery: message, regenAttempts, resultCount: products.length },
                }).catch(() => {});
              }
              // ── End Harness: Search Evaluator ──────────────────────────────

              (criteria as typeof criteria & { _notFoundTerms?: string[] })._notFoundTerms = notFoundOriginalTerms;
            }
          }
        }

        // ── Pillar 3: SME/Partner Central ──────────────────────────────
        if ((intent as string) === "product") {
          if (["local", "sme", "handicraft", "handloom", "batik"].some(w => (intent as string) === "category_browse" || message.toLowerCase().includes(w))) {
            send({ type: "thought", step: "sme_filter", status: "running", content: "Highlighting local Sri Lankan SME products..." });
            const t3 = Date.now();
            const smeProducts = await pillar3_searchSMEProducts(message, { maxPriceLKR: criteria?.maxPrice, limit: 50, currency: currency || "USD" }, createMcpContext("searching_sme_products"));
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
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Tracking order: ${orderId}`, durationMs: 0 });
            send({ type: "thought", step: "track_order", status: "running", content: `Fetching live status for order ${orderId}...` });
            send({ type: "tool_call", name: "kapruka_track_order", args: { order_number: KAPRUKA_FALLBACK_ORDER_NUMBER } });
            const t = Date.now();
            const tracking = await pillar2_trackOrder(KAPRUKA_FALLBACK_ORDER_NUMBER, createMcpContext("tracking_order"));
            const dur = Date.now() - t;
            if (tracking) {
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
              send({ type: "thought", step: "track_order", status: "completed", content: "Retrieved tracking info", durationMs: 0 });
              trackingResultForDB = enrichedTracking;
              send({ type: "tracking_result", result: enrichedTracking });
            } else {
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Could not retrieve order status.", durationMs: dur });
            }

          } else if (!city && userId && userId !== "guest") {
            // ── Path B: Smart natural-language lookup (logged-in users only) ─
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

              if (/\b(last|recent|latest|newest|previous)\b/.test(lowerMsg)) {
                matchedOrder = userOrders[0] || null;
              } else {
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
                send({ type: "thought", step: "tracking_order", status: "running", content: `Found your order. Fetching live status...` });
                send({ type: "tool_call", name: "kapruka_track_order", args: { order_number: KAPRUKA_FALLBACK_ORDER_NUMBER } });
                
                if (["tracking", "track", "status", "where is", "delivered"].some((w) => message.toLowerCase().includes(w))) {
                  const tTrack = Date.now();
                  const rawTracking = await pillar2_trackOrder(KAPRUKA_FALLBACK_ORDER_NUMBER, createMcpContext("tracking_order"));
                  const dur = Date.now() - tTrack;
                  if (rawTracking) {
                    const enrichedTracking = enrichTrackingResult(rawTracking, matchedOrder) ?? rawTracking;
                    trackingContext = `\n\n[Tracking Result] Order ID: ${enrichedTracking.displayOrderRef || matchedOrder.id}. Current Status: ${enrichedTracking.currentStatus}. Estimated Delivery: ${enrichedTracking.estimatedDelivery || "N/A"}. Use this in your response.`;
                    steps.push({ step: "tracking_order", status: "completed", content: `Status: ${enrichedTracking.currentStatus}`, durationMs: dur });
                    send({ type: "thought", step: "tracking_order", status: "completed", content: `Order status: ${enrichedTracking.currentStatus}`, durationMs: dur });
                    trackingResultForDB = enrichedTracking;
                    send({ type: "tracking_result", result: enrichedTracking });
                  } else {
                    send({ type: "thought", step: "tracking_order", status: "completed", content: "Kapruka tracking unavailable right now.", durationMs: dur });
                  }
                }
              } else {
                send({ type: "thought", step: "tracking_order", status: "completed", content: "No matching orders found in your history.", durationMs: 0 });
              }
            } catch (err) {
              console.error("[route.ts] smart order tracking failed:", err);
              send({ type: "thought", step: "tracking_order", status: "completed", content: "Error looking up your orders.", durationMs: 0 });
            }

          } else if (!city && (!userId || userId === "guest")) {
            send({ type: "thought", step: "intent_routing", status: "completed", content: "Guest user — sign-in required for order tracking.", durationMs: 0 });

          } else if (city) {
            // ── Path D: Delivery availability check (unchanged) ────────────
            send({ type: "thought", step: "intent_routing", status: "completed", content: `Checking Grasshoppers delivery to ${city}`, durationMs: 0 });
            send({ type: "thought", step: "checking_delivery", status: "running", content: `Checking delivery availability to ${city} on ${date}${isPerishable ? " (perishable)" : ""}...` });
            send({ type: "tool_call", name: "kapruka_check_delivery", args: { city, date, product_id: "GENERAL" } });
            
            if (city && date) {
              const t = Date.now();
              const delivery = await pillar2_checkDelivery(city, date, "GENERAL", createMcpContext("checking_delivery"));
              const dur = Date.now() - t;
              if (delivery) {
                deliveryContext = `\n\n[Delivery Check Result] City: ${delivery.city}. Available: ${delivery.canDeliver ? 'Yes' : 'No'}. Flat Rate: LKR ${delivery.flatRateLKR || "N/A"}. Date: ${delivery.deliveryDate || "N/A"}. Warning: ${delivery.warning || "None"}. Use this exact rate and availability in your response.`;
                steps.push({ step: "checking_delivery", status: "completed", content: `Delivery to ${city}: ${delivery.canDeliver ? "Available" : "Not available"}. Rate: Rs. ${delivery.flatRateLKR?.toLocaleString() || "N/A"}`, durationMs: dur });
                send({ type: "thought", step: "checking_delivery", status: "completed", content: `Delivery check complete for ${city}.`, durationMs: dur });
                send({ type: "delivery_result", result: delivery });
              } else {
                steps.push({ step: "checking_delivery", status: "completed", content: `Checking nearest cities to ${city}...`, durationMs: dur });
                send({ type: "thought", step: "checking_delivery", status: "completed", content: `No exact match for "${city}". Showing nearest covered cities.`, durationMs: dur });
                const cities = await pillar2_findCity(city, createMcpContext("finding_city"));
                if (cities.length > 0) {
                  send({ type: "city_suggestions", result: { cities, query: city } });
                }
              }
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
            const geminiHistory: any[] = historySnippet.split('\\n').filter(Boolean).map((line: string) => ({
              role: line.startsWith("[MODEL]") ? "model" : "user",
              parts: [{ text: line.replace(/^\\[.*?\\]:\\s*/, '') }],
            }));
            if (geminiHistory.length === 0) {
              geminiHistory.push({ role: 'user', parts: [{ text: message }] });
            }

            let contextNote = "";

            if ((intent as string) === "product" || (intent as string) === "category_browse") {
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
            if (intent === "qa" || intent === "general") {
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

            // ── Harness: Response Evaluator (post-stream) ──────────────────
            const responseEvalEnabled = process.env.HARNESS_RESPONSE_EVAL_ENABLED !== 'false';
            if (ai && responseEvalEnabled && fullResponseText && (intent === 'qa' || intent === 'delivery')) {
              try {
                const evalStart = Date.now();
                const responseEval = await responseEvaluatorAgent({
                  draftResponse: fullResponseText,
                  userQuery: message,
                  intent: intent as 'qa' | 'delivery',
                  historySnippet,
                  ai,
                  fastModel: config.gemini.fastModel,
                });
                const evalLatency = Date.now() - evalStart;
                console.log(`[Harness:ResponseEval] score=${responseEval.overallScore.toFixed(1)} action=${responseEval.action} latency=${evalLatency}ms`);

                if (responseEval.action === 'append_note' && responseEval.correctionNote) {
                  const noteText = '\n\n> ' + responseEval.correctionNote;
                  fullResponseText += noteText;
                  send({ type: 'text', content: noteText });
                }

                // Log evaluation
                const savedMsg = await prisma.chatMessage.findFirst({ where: { sessionId: session?.id || sessionId, role: 'user' }, orderBy: { createdAt: 'desc' } });
                logEval({
                  sessionId: session?.id || sessionId,
                  messageId: savedMsg?.id ?? 'unknown',
                  evaluatorType: 'response_evaluator',
                  score: responseEval.overallScore,
                  passed: responseEval.action === 'stream_as_is',
                  feedback: responseEval.feedback,
                  regenerated: false,
                  latencyMs: evalLatency,
                  context: { intent, action: responseEval.action },
                }).catch(() => {});
              } catch (evalErr) {
                console.error('[Harness:ResponseEval] Evaluation failed:', (evalErr as Error).message);
              }
            }
            // ── End Harness: Response Evaluator ────────────────────────────
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
              isComparison: !!(hasSelectedProducts && (hasSelectedProducts ? 1 : 0) > 0),
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
}

function generateFallback(...args: any[]) { return "I'm having trouble with that right now. Please try again."; }
