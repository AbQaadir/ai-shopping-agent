/**
 * intent.ts
 * ---------------------------------------------------------------------------
 * Phase 1 — Extraction & Cleanup
 *
 * Intent classification logic extracted from the route.ts monolith.
 * The classifier Gemini prompt is copied verbatim from route.ts lines 300–403.
 * ---------------------------------------------------------------------------
 */

import { findRelevantCategories } from "@/lib/categories";
import { config } from "@/lib/config";
import { ruleBasedIntent, type Intent } from "@/lib/nlp";
import { GoogleGenAI } from "@google/genai";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchTermConfig {
  term: string;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface IntentClassification {
  intent: Intent;
  isRelated: boolean;
  isAgeRestricted: boolean;
  searchTerms: SearchTermConfig[];
  historyTarget: string | null;
  historyTimeline: string | null;
}

// ── classifyIntent ─────────────────────────────────────────────────────────

/**
 * Classify the user's intent using a Gemini LLM call.
 *
 * - Runs local RACR (Category Matcher) first to provide taxonomy hints.
 * - Returns a typed `IntentClassification` instead of setting local let vars.
 * - Falls back gracefully to the rule-based intent if the LLM call fails.
 *
 * Extracted from route.ts lines 282–418.
 */
export async function classifyIntent(
  message: string,
  historySnippet: string,
  hasSelectedProducts: boolean,
  ai: GoogleGenAI,
  model: string
): Promise<IntentClassification> {
  // Short-circuit: if the UI explicitly sent selected products, it's "product" intent
  if (hasSelectedProducts) {
    return {
      intent: "product",
      isRelated: true,
      isAgeRestricted: false,
      searchTerms: [],
      historyTarget: null,
      historyTimeline: null,
    };
  }

  // Start with the rule-based intent as a fallback baseline
  let intent: Intent = ruleBasedIntent(message);
  let isRelated = true;
  let llmSearchTerms: SearchTermConfig[] = [];
  let historyTarget: string | null = null;
  let historyTimeline: string | null = null;
  let isAgeRestricted = false;

  try {
    // Run local Category Matcher (RACR) to get matching store categories
    const matchedCats = findRelevantCategories(message, 3);
    const matchedCategoriesText =
      matchedCats.length > 0
        ? matchedCats.map((c) => `- ${c.slug} (Path: ${c.path})`).join("\n")
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
      model,
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
    if (
      parsed?.intent &&
      ["product", "category_browse", "delivery", "service", "qa", "order_history"].includes(
        parsed.intent
      )
    ) {
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
    if (
      llmSearchTerms.length === 0 &&
      parsed?.searchQuery &&
      typeof parsed.searchQuery === "string"
    ) {
      llmSearchTerms = [
        { term: parsed.searchQuery.trim().toLowerCase(), minPrice: null, maxPrice: null },
      ];
    }

    console.log(
      `[Intent] "${message.substring(0, 60)}" → ${intent} (isRelated: ${isRelated})`
    );
  } catch (err) {
    console.error("[Intent] classification failed:", (err as Error).message);
  }

  return {
    intent,
    isRelated,
    isAgeRestricted,
    searchTerms: llmSearchTerms,
    historyTarget,
    historyTimeline,
  };
}
