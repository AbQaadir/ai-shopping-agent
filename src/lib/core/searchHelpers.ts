/**
 * searchHelpers.ts
 * ---------------------------------------------------------------------------
 * Phase 1 — Extraction & Cleanup
 *
 * Product search helper functions extracted from the route.ts monolith.
 * These were previously defined as inline closures inside the SSE start()
 * callback and as module-level functions at the bottom of route.ts.
 * ---------------------------------------------------------------------------
 */

import { config } from "@/lib/config";
import { pillar1_searchProducts, type KaprukaProduct } from "@/lib/tools";
import { GoogleGenAI } from "@google/genai";
import type { SearchTermConfig } from "@/lib/core/intent";

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

// ── Internal helpers ──────────────────────────────────────────────────────

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

// ── scoreAndFilterProducts ─────────────────────────────────────────────────

/**
 * Keyword-based relevance scorer and filter.
 * Scores products by how well their name matches the query term,
 * penalising accessory noise words that don't match user intent.
 *
 * Extracted from route.ts lines 2281–2308.
 */
export function scoreAndFilterProducts(
  products: KaprukaProduct[],
  baseTerm: string
): KaprukaProduct[] {
  const cleanTerm = baseTerm.trim().toLowerCase();
  const queryTokens = cleanTerm.split(/\s+/).filter((w) => w.length > 1);
  const noun = cleanTerm.split(/\s+/).pop() || cleanTerm;
  const nounVariants = getPrimaryNounVariants(cleanTerm);
  const noiseWords = ACCESSORY_NOISE[noun] || [];

  return products
    .map((product) => {
      const nameLower = product.name.toLowerCase();
      let score = 0;
      const hasNoun = nounVariants.some((variant) =>
        new RegExp(`\\b${variant}\\b`, "i").test(nameLower)
      );
      if (hasNoun) score += 10;
      if (noiseWords.length > 0) {
        const matchesNoise = noiseWords.some((noise) =>
          new RegExp(`\\b${noise}\\b`, "i").test(nameLower)
        );
        if (matchesNoise) {
          const userWantsThisAccessory = queryTokens.some((t) =>
            noiseWords.includes(t)
          );
          if (!userWantsThisAccessory) score -= 15;
        }
      }
      if (nameLower.includes(cleanTerm)) score += 15;
      if (nameLower.startsWith(cleanTerm)) score += 5;
      const matchedTokens = queryTokens.filter((token) =>
        new RegExp(`\\b${token}\\b`, "i").test(nameLower)
      );
      score += matchedTokens.length === queryTokens.length ? 10 : matchedTokens.length * 3;
      return { ...product, _relevanceScore: score };
    })
    .sort((a, b) => b._relevanceScore - a._relevanceScore);
}

// ── llmValidateRelevance ───────────────────────────────────────────────────

/**
 * Use the LLM to validate and score product relevance for a user query.
 * Discards products that only share a keyword but are categorically irrelevant.
 *
 * Extracted from route.ts lines 2311–2399.
 */
export async function llmValidateRelevance(
  products: KaprukaProduct[],
  userQuery: string,
  aiClient: GoogleGenAI,
  fastModel: string
): Promise<KaprukaProduct[]> {
  if (products.length === 0) return [];
  const productsToCheck = products;
  const productList = productsToCheck
    .map((p, i) => `${i + 1}. [${p.id}] ${p.name}`)
    .join("\n");

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
                  score: { type: "INTEGER" },
                },
                required: ["id", "score"],
              },
            },
            reason: { type: "STRING" },
          },
          required: ["kept_items", "reason"],
        },
      },
    });

    let text = (result.text || "{}")
      .trim()
      .replace(/```json/i, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(text);
    const keptItems = Array.isArray(parsed?.kept_items) ? parsed.kept_items : [];

    const scoreMap = new Map<string, number>();
    for (const item of keptItems) {
      scoreMap.set(item.id, item.score);
    }

    const filtered = productsToCheck.filter((p) => scoreMap.has(p.id));
    const combined = filtered.map((p) => ({
      ...p,
      _relevanceScore: scoreMap.get(p.id) ?? 1,
    }));

    // Sort in descending order of relevance score
    combined.sort((a, b) => {
      const scoreA = (a as any)._relevanceScore ?? 0;
      const scoreB = (b as any)._relevanceScore ?? 0;
      return scoreB - scoreA;
    });

    console.log(
      `[LLM Validator] "${userQuery.substring(0, 40)}": kept ${filtered.length}/${productsToCheck.length}. Reason: ${parsed?.reason || "n/a"}`
    );
    return combined;
  } catch (err) {
    console.error(
      `[LLM Validator] Failed for "${userQuery.substring(0, 40)}":`,
      (err as Error).message
    );
    return products;
  }
}

// ── reorderForKapruka ──────────────────────────────────────────────────────

/**
 * Generate word-order variants for a search term to improve Kapruka search
 * recall. For example, "apple iphone" → ["iphone", "apple"] to account for
 * the way Kapruka indexes its product names.
 *
 * Extracted from route.ts lines 1603–1608.
 */
export function reorderForKapruka(term: string): string[] {
  const words = term.trim().split(/\s+/);
  if (words.length <= 1) return [term];
  if (words.length === 2) {
    const reordered = `${words[1]} ${words[0]}`;
    return [reordered, words[1]];
  }
  return [words[words.length - 1], term];
}

// ── runSearchPipeline ──────────────────────────────────────────────────────

/**
 * Execute a full product search pipeline for a single search term config:
 *  1. Generate word-order variants via `reorderForKapruka`.
 *  2. Run parallel search calls for each variant (staggered 120ms apart).
 *  3. Deduplicate results by product ID.
 *  4. Apply min/max price filters.
 *  5. Run LLM relevance validation.
 *  6. Emit SSE events: `tool_call`, `thought` (running/completed), `group_ready`.
 *
 * Extracted from route.ts lines 1630–1696.
 */
export async function runSearchPipeline(
  termConfig: SearchTermConfig,
  pipelineIndex: number,
  send: (payload: Record<string, unknown>) => void,
  currency: string,
  originalMessage: string,
  ai: GoogleGenAI | null,
  /** The overall max price from parsed requirements (fallback when termConfig has none) */
  criteriaMaxPrice: number | null | undefined
): Promise<{ term: string; products: KaprukaProduct[]; discardedCount: number }> {
  const baseTerm = termConfig.term;
  const variants = reorderForKapruka(baseTerm);
  const queryMaxPrice = termConfig.maxPrice ?? criteriaMaxPrice;

  send({ type: "tool_call", name: "kapruka_search_products", args: { query: baseTerm, max_price: queryMaxPrice } });
  send({ type: "thought", step: "searching_kapruka", term: baseTerm, status: "running", content: `Searching Kapruka for "${baseTerm}"...` });

  const t1 = Date.now();
  const variantSettled = await Promise.allSettled(
    variants.map((v, vi) =>
      new Promise<KaprukaProduct[]>((resolve, reject) => {
        setTimeout(() => {
          pillar1_searchProducts(v, {
            maxPriceLKR: queryMaxPrice ?? undefined,
            smeFirst: false,
            currency: currency || "LKR",
          })
            .then(resolve)
            .catch(reject);
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

  send({
    type: "thought",
    step: "searching_kapruka",
    term: baseTerm,
    status: "completed",
    content:
      `Found ${filteredPriceProducts.length} raw result${filteredPriceProducts.length !== 1 ? "s" : ""} for "${baseTerm}" in ${searchDur}ms.` +
      (priceFilterDiscarded > 0
        ? ` (Filtered out ${priceFilterDiscarded} product(s) outside price limits)`
        : ""),
    durationMs: searchDur,
  });

  // Run the LLM relevance validator
  const keywordDiscarded = priceFilterDiscarded;
  let validated = filteredPriceProducts;
  let llmDiscarded = 0;

  if (ai && filteredPriceProducts.length > 0) {
    send({
      type: "thought",
      step: "validating_relevance",
      term: baseTerm,
      status: "running",
      content: `Validating ${filteredPriceProducts.length} result${filteredPriceProducts.length !== 1 ? "s" : ""} for "${baseTerm}"...`,
    });
    const t2 = Date.now();
    validated = await llmValidateRelevance(
      filteredPriceProducts,
      originalMessage,
      ai,
      config.gemini.fastModel
    );
    const validationDur = Date.now() - t2;
    llmDiscarded = filteredPriceProducts.length - validated.length;
    send({
      type: "thought",
      step: "validating_relevance",
      term: baseTerm,
      status: "completed",
      content:
        llmDiscarded > 0
          ? `Relevance check: ✓ kept ${validated.length}, removed ${llmDiscarded} irrelevant.`
          : `All ${validated.length} result${validated.length !== 1 ? "s" : ""} passed ✓`,
      durationMs: validationDur,
    });
  }

  const totalDiscarded = keywordDiscarded + llmDiscarded;
  send({ type: "group_ready", term: baseTerm, products: validated, index: pipelineIndex, discardedCount: totalDiscarded });
  return { term: baseTerm, products: validated, discardedCount: totalDiscarded };
}
