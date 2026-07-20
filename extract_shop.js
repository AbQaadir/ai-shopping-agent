const fs = require('fs');

const content = fs.readFileSync('src/app/api/chat/route.ts', 'utf-8');

const startMarker = '// ── Action: checkout_pause';

const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
    console.error("Start Marker not found!");
    process.exit(1);
}

// We grab everything from startIdx to the end of the start() block.
// The start block ends around `return new Response(stream, {`
const endMarker = 'return new Response(stream, {';
const endIdx = content.indexOf(endMarker, startIdx);

if (endIdx === -1) {
    console.error("End Marker not found!");
    process.exit(1);
}

let block = content.substring(startIdx, endIdx);

// We need to cut off the trailing `    });` and `  },` before the `return new Response`.
// Let's just find the last `controller.close();` and close the block there.
const lastCloseIdx = block.lastIndexOf('controller.close();');
block = block.substring(0, lastCloseIdx + 'controller.close();'.length);

const header = `import { config } from "@/lib/config";
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
import { Intent } from "@/lib/nlp";
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
  const words = baseTerm.trim().toLowerCase().split(/\\s+/);
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
  const queryTokens = cleanTerm.split(/\\s+/).filter((w) => w.length > 1);
  const noun = cleanTerm.split(/\\s+/).pop() || cleanTerm;
  const nounVariants = getPrimaryNounVariants(cleanTerm);
  const noiseWords = ACCESSORY_NOISE[noun] || [];

  return products
    .map((product) => {
      const nameLower = product.name.toLowerCase();
      let score = 0;
      const hasNoun = nounVariants.some((variant) => new RegExp(\`\\\\b\${variant}\\\\b\`, "i").test(nameLower));
      if (hasNoun) score += 10;
      if (noiseWords.length > 0) {
        const matchesNoise = noiseWords.some((noise) => new RegExp(\`\\\\b\${noise}\\\\b\`, "i").test(nameLower));
        if (matchesNoise) {
          const userWantsThisAccessory = queryTokens.some((t) => noiseWords.includes(t));
          if (!userWantsThisAccessory) score -= 15;
        }
      }
      if (nameLower.includes(cleanTerm)) score += 15;
      if (nameLower.startsWith(cleanTerm)) score += 5;
      const matchedTokens = queryTokens.filter((token) => new RegExp(\`\\\\b\${token}\\\\b\`, "i").test(nameLower));
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
  const productList = productsToCheck.map((p, i) => \`\${i + 1}. [\${p.id}] \${p.name}\`).join("\\n");

  const prompt = \`You are a product relevance validator for a e-commerce search agent.

User's query: "\${userQuery}"

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
\${productList}

Respond ONLY with valid JSON: {"kept_items":[{"id":"id1","score":95}],"reason":"one-line explanation"}\`;

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

    let text = (result.text || "{}").trim().replace(/\`\`\`json/i, "").replace(/\`\`\`/g, "").trim();
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

    console.log(\`[LLM Validator] "\${userQuery.substring(0, 40)}": kept \${filtered.length}/\${productsToCheck.length}. Reason: \${parsed?.reason || "n/a"}\`);
    return combined;
  } catch (err) {
    console.error(\`[LLM Validator] Failed for "\${userQuery.substring(0, 40)}":\`, (err as Error).message);
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
    if (char === "\\\\") {
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
    isAgeRestricted, historySnippet, sessionContext, country, currency, criteria
  } = ctx;
  
  const send = streamContext.send.bind(streamContext);
  const streamWords = streamContext.streamWords.bind(streamContext);
  const createMcpContext = streamContext.createMcpContext.bind(streamContext);
  const controller = streamContext; // allows controller.close()
  const hasSelectedProducts = fetchedSelectedProducts.length > 0;
  let session = await prisma.chatSession.findUnique({ where: { id: sessionId } });

`;

const footer = `
}
`;

fs.writeFileSync('src/lib/chat/handlers/shop.ts', header + block + footer);
console.log("Shop extraction done!");
