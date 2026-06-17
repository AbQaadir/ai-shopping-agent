/**
 * Category Browse Agent
 *
 * An LLM-based agent that receives a user's broad or generic shopping query
 * together with the full Kapruka category tree (fetched from MCP) and uses
 * Gemini to select the 1–3 best-matching subcategories with their URLs.
 *
 * The agent builds a compressed, numbered representation of the tree, asks
 * the LLM for structured JSON, groups the categories by concept, and validates 
 * every returned URL against the original tree before handing the result back to the caller.
 */

import { GoogleGenAI } from "@google/genai";

// ── Types ────────────────────────────────────────────────────────────────────

/** A single main category with optional subcategories, as returned by MCP. */
export interface KaprukaCategoryDeep {
  name: string;
  url?: string;
  subcategories?: Array<{
    name: string;
    url?: string;
  }>;
}

/** The structured result returned by {@link categoryBrowseAgent}. */
export interface CategoryBrowseDecision {
  categoryGroups: Array<{
    groupName: string;
    categories: Array<{
      mainCategory: string;
      subcategory: string;
      url: string;
      reason: string;
    }>;
  }>;
  responseIntro: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a compact, numbered string representation of the category tree
 * suitable for inclusion in an LLM prompt.
 */
function buildCompressedCategoryList(categoryTree: KaprukaCategoryDeep[]): string {
  return categoryTree
    .map((cat, idx) => {
      const header = `${idx + 1}. ${cat.name}${cat.url ? ` (${cat.url})` : ""}`;
      const subs = (cat.subcategories ?? [])
        .map((sub) => `   - ${sub.name}${sub.url ? ` (${sub.url})` : ""}`)
        .join("\n");
      return subs ? `${header}\n${subs}` : header;
    })
    .join("\n");
}

/**
 * Collects every valid URL present in the category tree into a `Set` for
 * O(1) existence checks during post-LLM validation.
 */
function collectValidUrls(categoryTree: KaprukaCategoryDeep[]): Set<string> {
  const urls = new Set<string>();
  for (const cat of categoryTree) {
    if (cat.url) urls.add(cat.url);
    for (const sub of cat.subcategories ?? []) {
      if (sub.url) urls.add(sub.url);
    }
  }
  return urls;
}

/**
 * Attempts a simple keyword-based fallback match against the category tree.
 * Returns the first main category (and optionally its best subcategory)
 * whose name partially matches any word in the user's query.
 */
function fallbackMatch(
  message: string,
  categoryTree: KaprukaCategoryDeep[],
): CategoryBrowseDecision {
  const queryWords = message
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const cat of categoryTree) {
    const catNameLower = cat.name.toLowerCase();
    const matched = queryWords.some((w) => catNameLower.includes(w));
    if (!matched) continue;

    // Prefer a matching subcategory if one exists
    const matchingSub = (cat.subcategories ?? []).find((sub) =>
      queryWords.some((w) => sub.name.toLowerCase().includes(w)),
    );

    const pick = matchingSub ?? cat;
    if (!pick.url) continue;

    return {
      categoryGroups: [
        {
          groupName: cat.name,
          categories: [
            {
              mainCategory: cat.name,
              subcategory: matchingSub ? matchingSub.name : "Main Category Page",
              url: pick.url,
              reason: "Keyword fallback match",
            }
          ]
        }
      ],
      responseIntro: `I found a category that might match — take a look!`,
    };
  }

  // Nothing matched at all
  return {
    categoryGroups: [],
    responseIntro:
      "I wasn't able to find a matching category. Could you be a bit more specific about what you're looking for?",
  };
}

// ── Main Agent ───────────────────────────────────────────────────────────────

/**
 * Uses Gemini to select the 1–3 best subcategory URLs from the Kapruka
 * category tree that match the user's broad shopping query.
 *
 * @param message         - The user's natural-language query
 * @param categoryTree    - Full category tree with subcategories (from MCP)
 * @param historySnippet  - Recent conversation history for context
 * @param ai              - Initialised Gemini AI client
 * @param fastModel       - Gemini model identifier to use
 * @returns A {@link CategoryBrowseDecision} with matched categories and an intro
 */
export async function categoryBrowseAgent(
  message: string,
  categoryTree: KaprukaCategoryDeep[],
  historySnippet: string,
  ai: GoogleGenAI,
  fastModel: string,
): Promise<CategoryBrowseDecision> {
  const compressedCategoryList = buildCompressedCategoryList(categoryTree);
  const validUrls = collectValidUrls(categoryTree);

  const prompt = `You are a category matcher for Kapruka, a Sri Lankan e-commerce platform.

Given the user's query and the full catalog category tree below, select the 1–3 BEST subcategory URLs that would contain the products the user is looking for.

RULES:
- Prefer specific subcategories over generic main category pages when available.
- If the query maps to an occasion/theme (diwali, birthday, wedding, graduation), pick the occasion/theme main category page.
- If a main category itself is the best fit (e.g. query is "chocolates" → pick the Chocolates main page), use its URL.
- Maximum 3 selections to keep response fast.
- Each selection MUST include a valid URL from the category tree.
- GROUPING: You must group your selected categories by the broad concept they represent. If the user asks for a single concept (e.g. "flowers"), all selected flower categories should be in ONE single group (e.g. groupName: "Flowers"). If they ask for multiple concepts (e.g. "cakes and flowers"), create separate groups for each.

═══ RECENT CONVERSATION ═══
${historySnippet}

═══ CATEGORY TREE ═══
${compressedCategoryList}

═══ USER QUERY ═══
"${message}"

Respond ONLY as valid JSON:
{
  "categoryGroups": [
    {
      "groupName": "<Broad concept name, e.g. 'Flowers', 'Cakes & Sweets', 'Gift Hampers'>",
      "categories": [
        { "mainCategory": "<main cat name>", "subcategory": "<sub cat name or 'Main Category Page'>", "url": "<exact URL from tree>", "reason": "<1 sentence why>" }
      ]
    }
  ],
  "responseIntro": "<1 sentence intro for the user about what was found>"
}`;

  try {
    const result = await ai.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            categoryGroups: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  groupName: { type: "STRING" },
                  categories: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        mainCategory: { type: "STRING" },
                        subcategory: { type: "STRING" },
                        url: { type: "STRING" },
                        reason: { type: "STRING" },
                      },
                      required: ["mainCategory", "subcategory", "url", "reason"],
                    },
                  },
                },
                required: ["groupName", "categories"],
              },
            },
            responseIntro: { type: "STRING" },
          },
          required: ["categoryGroups", "responseIntro"],
        },
      },
    });

    const raw = (result.text || "{}").trim();
    const parsed: CategoryBrowseDecision = JSON.parse(raw);

    // Validate returned URLs against the real category tree
    const verifiedGroups = [];
    let totalVerified = 0;

    for (const group of parsed.categoryGroups ?? []) {
      const verifiedCategories = (group.categories ?? []).filter((entry) => {
        if (validUrls.has(entry.url)) return true;
        console.error(`[CategoryBrowseAgent] Filtered out invalid URL: "${entry.url}"`);
        return false;
      });

      if (verifiedCategories.length > 0) {
        verifiedGroups.push({
          groupName: group.groupName,
          categories: verifiedCategories
        });
        totalVerified += verifiedCategories.length;
      }
    }

    console.log(
      `[CategoryBrowseAgent] "${message.substring(0, 60)}" → ${totalVerified} categories matched across ${verifiedGroups.length} groups`,
    );

    return {
      categoryGroups: verifiedGroups,
      responseIntro:
        parsed.responseIntro ||
        "Here are the categories I found for your query:",
    };
  } catch (err) {
    console.error(
      "[CategoryBrowseAgent] LLM call failed:",
      (err as Error).message,
    );
    // Attempt a simple keyword fallback before giving up
    return fallbackMatch(message, categoryTree);
  }
}
