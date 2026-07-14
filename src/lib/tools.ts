/**
 * tools.ts
 * ---------------------------------------------------------------------------
 * 5-Pillar Tool Layer for the Kapruka AI Agent.
 *
 * Each Pillar maps to a group of tools. Tools call the Kapruka MCP server
 * via mcpClient.ts (Pillars 1–2) or implement custom logic (Pillars 3–5).
 *
 * Pillar 1 — Domestic E-Commerce  (MCP: search, details, checkout)
 * Pillar 2 — Grasshoppers Logistics (MCP: delivery check, tracking, cities)
 * Pillar 3 — Partner Central / SME  (MCP search + SME tagging)
 * Pillar 4 — Services Platform      (Custom: stub service provider registry)
 * ---------------------------------------------------------------------------
 */

import {
  searchProducts,
  getProduct,
  createOrder,
  checkDelivery,
  trackOrder,
  listDeliveryCities,
  getCachedCategories,
  MCPContext,
  KaprukaProduct,
  KaprukaOrderResult,
  KaprukaDeliveryResult,
  KaprukaTrackingResult,
  KaprukaCity,
  KaprukaCategoryDeep,
} from "./mcpClient";

import { scrapeProductsFromCategoryUrl, scrapeMultipleCategoryUrls } from "./categoryPageScraper";

// Re-export shared types so API route can use them
export type {
  KaprukaProduct,
  KaprukaOrderResult,
  KaprukaDeliveryResult,
  KaprukaTrackingResult,
  KaprukaCity,
  KaprukaCategoryDeep,
};

// Re-export functions for category browse
export { getCachedCategories, scrapeMultipleCategoryUrls };

// ── Pillar 1 — Domestic E-Commerce ────────────────────────────────────────

/**
 * Search Kapruka's live catalog via MCP.
 * SME products are tagged with isSME = true for Pillar 3 highlighting.
 */
export async function pillar1_searchProducts(
  query: string,
  options: { maxPriceLKR?: number; smeFirst?: boolean; currency?: string } = {},
  mcpContext?: MCPContext
): Promise<KaprukaProduct[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }
  const result = await searchProducts(trimmedQuery, {
    maxPrice: options.maxPriceLKR,
    inStockOnly: false,
    currency: options.currency,
  }, mcpContext);

  if (!result.success || !result.data) {
    console.error("[Pillar1] searchProducts failed:", result.error);
    return [];
  }

  let products = result.data;

  // Pillar 3 SME tagging: heuristic — tag products from local/artisan categories
  if (options.smeFirst) {
    const smeKeywords = [
      "handmade", "artisan", "local", "traditional", "ceylon", "batik",
      "craft", "sme", "small", "homemade", "natural", "organic", "sri lanka"
    ];
    products = products.map((p) => {
      const combined = `${p.name} ${p.category || ""} ${p.description || ""}`.toLowerCase();
      const isSME = smeKeywords.some((kw) => combined.includes(kw));
      return { ...p, isSME };
    });
    // Sort SME products first
    products.sort((a, b) => (b.isSME ? 1 : 0) - (a.isSME ? 1 : 0));
  }

  return products.slice(0, 50);
}

/**
 * Fetch full product details by Kapruka product ID.
 */
export async function pillar1_getProductDetails(
  productId: string,
  mcpContext?: MCPContext
): Promise<KaprukaProduct | null> {
  const result = await getProduct(productId, mcpContext);
  if (!result.success || !result.data) {
    console.error("[Pillar1] getProduct failed:", result.error);
    return null;
  }
  return result.data;
}

/**
 * Create a guest checkout order on Kapruka.
 * Returns a 60-min locked click-to-pay URL.
 */
export async function pillar1_createOrderLink(
  productIdOrItems: string | Array<{ productId: string; quantity: number }>,
  quantityOrRecipient: number | { name: string; phone: string; address: string; city: string },
  recipientDetail?: { name: string; phone: string; address: string; city: string },
  deliveryDate?: string,   // YYYY-MM-DD — passed through to kapruka_create_order
  giftMessage?: string,    // optional gift message — passed as gift_message to MCP
  mcpContext?: MCPContext
): Promise<KaprukaOrderResult | null> {
  const result = await createOrder(productIdOrItems as any, quantityOrRecipient as any, recipientDetail as any, deliveryDate, giftMessage, mcpContext);
  if (!result.success || !result.data) {
    console.error("[Pillar1] createOrder failed:", result.error);
    return null;
  }
  return result.data;
}

// ── Pillar 2 — Grasshoppers Logistics ─────────────────────────────────────

/**
 * Verify delivery availability to a Sri Lankan city on a given date.
 */
export async function pillar2_checkDelivery(
  city: string,
  date: string,
  productId: string,
  mcpContext?: MCPContext
): Promise<KaprukaDeliveryResult | null> {
  const result = await checkDelivery(city, date, productId, mcpContext);
  if (!result.success || !result.data) {
    console.error("[Pillar2] checkDelivery failed:", result.error);
    return null;
  }
  return result.data;
}

/**
 * Get live order tracking status and step timeline.
 */
export async function pillar2_trackOrder(
  orderId: string,
  mcpContext?: MCPContext
): Promise<KaprukaTrackingResult | null> {
  const result = await trackOrder(orderId, mcpContext);
  if (!result.success || !result.data) {
    console.error("[Pillar2] trackOrder failed:", result.error);
    return null;
  }
  return result.data;
}

/**
 * Search for valid Grasshoppers delivery cities by partial name.
 */
export async function pillar2_findCity(partialName: string, mcpContext?: MCPContext): Promise<KaprukaCity[]> {
  const result = await listDeliveryCities(partialName, mcpContext);
  if (!result.success || !result.data) {
    console.error("[Pillar2] listDeliveryCities failed:", result.error);
    return [];
  }
  return result.data;
}

// ── Pillar 3 — Partner Central / SME ──────────────────────────────────────

/**
 * Search products with SME/local artisan prioritisation.
 * Thin wrapper over Pillar 1 search with smeFirst = true.
 */
export async function pillar3_searchSMEProducts(
  query: string,
  options: { maxPriceLKR?: number; limit?: number; currency?: string } = {},
  mcpContext?: MCPContext
): Promise<KaprukaProduct[]> {
  return pillar1_searchProducts(query, { smeFirst: true, maxPriceLKR: options.maxPriceLKR, currency: options.currency }, mcpContext);
}



// ── Pillar 5 — Services Platform ───────────────────────────────────────────

export type ServiceCategory =
  | "electrical"
  | "plumbing"
  | "ac_repair"
  | "cleaning"
  | "pest_control"
  | "painting"
  | "carpentry"
  | "unknown";

export interface ServiceProvider {
  id: string;
  name: string;
  category: ServiceCategory;
  specialization: string;
  rating: number;        // 1–5
  reviewCount: number;
  experienceYears: number;
  coverageAreas: string[];
  pricingLKR: string;    // e.g. "Rs. 1,500 – 5,000 per visit"
  phone: string;         // Masked for stub
  verified: boolean;
  responseTime: string;  // e.g. "Within 2 hours"
}

/** Stub service provider registry — realistic Sri Lankan service providers */
const SERVICE_REGISTRY: Record<ServiceCategory, ServiceProvider[]> = {
  electrical: [
    {
      id: "sv-elec-001", name: "Nimal Electrical Services", category: "electrical",
      specialization: "Domestic wiring, MCB panels, fault diagnosis",
      rating: 4.8, reviewCount: 142, experienceYears: 12,
      coverageAreas: ["Colombo", "Gampaha", "Kalutara"],
      pricingLKR: "Rs. 1,500 – 6,000 per visit",
      phone: "+94 77 *** ****", verified: true, responseTime: "Within 2 hours",
    },
    {
      id: "sv-elec-002", name: "Lanka Power Solutions", category: "electrical",
      specialization: "Solar installations, 3-phase wiring, generator setups",
      rating: 4.6, reviewCount: 89, experienceYears: 8,
      coverageAreas: ["Colombo", "Kandy", "Galle"],
      pricingLKR: "Rs. 2,000 – 15,000 per visit",
      phone: "+94 71 *** ****", verified: true, responseTime: "Same day",
    },
    {
      id: "sv-elec-003", name: "Suresh Home Electricals", category: "electrical",
      specialization: "Plug repairs, fan/light fittings, socket replacement",
      rating: 4.4, reviewCount: 56, experienceYears: 6,
      coverageAreas: ["Colombo", "Nugegoda", "Maharagama"],
      pricingLKR: "Rs. 800 – 3,000 per visit",
      phone: "+94 76 *** ****", verified: false, responseTime: "Within 3 hours",
    },
  ],
  plumbing: [
    {
      id: "sv-plmb-001", name: "Dinesh Plumbing & Maintenance", category: "plumbing",
      specialization: "Pipe leaks, water pump repair, tank cleaning",
      rating: 4.7, reviewCount: 203, experienceYears: 15,
      coverageAreas: ["Colombo", "Sri Jayawardenepura", "Kelaniya"],
      pricingLKR: "Rs. 1,200 – 5,000 per visit",
      phone: "+94 77 *** ****", verified: true, responseTime: "Within 1 hour",
    },
    {
      id: "sv-plmb-002", name: "CoolFlow Plumbing Services", category: "plumbing",
      specialization: "Bathroom fittings, kitchen sinks, shower installations",
      rating: 4.5, reviewCount: 118, experienceYears: 9,
      coverageAreas: ["Colombo", "Gampaha", "Kandy"],
      pricingLKR: "Rs. 1,500 – 7,000 per visit",
      phone: "+94 70 *** ****", verified: true, responseTime: "Same day",
    },
    {
      id: "sv-plmb-003", name: "AquaFix Lanka", category: "plumbing",
      specialization: "Emergency leak repairs, drain unblocking",
      rating: 4.3, reviewCount: 74, experienceYears: 5,
      coverageAreas: ["Colombo", "Mount Lavinia"],
      pricingLKR: "Rs. 900 – 4,000 per visit",
      phone: "+94 75 *** ****", verified: false, responseTime: "Within 45 min",
    },
  ],
  ac_repair: [
    {
      id: "sv-ac-001", name: "CoolBreeze AC Services", category: "ac_repair",
      specialization: "All AC brands, gas refill, PCB repair, full servicing",
      rating: 4.9, reviewCount: 312, experienceYears: 18,
      coverageAreas: ["Colombo", "Kandy", "Galle", "Negombo"],
      pricingLKR: "Rs. 2,500 – 12,000 per service",
      phone: "+94 77 *** ****", verified: true, responseTime: "Same day",
    },
    {
      id: "sv-ac-002", name: "IceCold HVAC Lanka", category: "ac_repair",
      specialization: "Commercial & residential AC, duct cleaning",
      rating: 4.7, reviewCount: 187, experienceYears: 12,
      coverageAreas: ["Colombo", "Gampaha", "Kalutara"],
      pricingLKR: "Rs. 3,000 – 20,000 per service",
      phone: "+94 71 *** ****", verified: true, responseTime: "Within 2 hours",
    },
    {
      id: "sv-ac-003", name: "Saman Aircon Repairs", category: "ac_repair",
      specialization: "Budget AC repairs, remote sensor fixes, filter cleaning",
      rating: 4.2, reviewCount: 93, experienceYears: 7,
      coverageAreas: ["Colombo", "Nugegoda", "Dehiwela"],
      pricingLKR: "Rs. 1,500 – 6,000 per service",
      phone: "+94 76 *** ****", verified: false, responseTime: "Next morning",
    },
  ],
  cleaning: [
    {
      id: "sv-clean-001", name: "SparkleClean Pro", category: "cleaning",
      specialization: "Deep cleaning, carpet shampooing, sofa & mattress cleaning",
      rating: 4.8, reviewCount: 275, experienceYears: 10,
      coverageAreas: ["Colombo", "Gampaha", "Kandy", "Galle"],
      pricingLKR: "Rs. 3,000 – 15,000 per session",
      phone: "+94 77 *** ****", verified: true, responseTime: "Scheduled",
    },
    {
      id: "sv-clean-002", name: "CleanSweep Lanka", category: "cleaning",
      specialization: "Home & office cleaning, post-construction cleanup",
      rating: 4.5, reviewCount: 134, experienceYears: 6,
      coverageAreas: ["Colombo", "Sri Jayawardenepura"],
      pricingLKR: "Rs. 2,000 – 10,000 per session",
      phone: "+94 70 *** ****", verified: true, responseTime: "Same day available",
    },
  ],
  pest_control: [
    {
      id: "sv-pest-001", name: "PestGuard Lanka", category: "pest_control",
      specialization: "Termite control, cockroach/mosquito treatment, rodent management",
      rating: 4.7, reviewCount: 198, experienceYears: 14,
      coverageAreas: ["Colombo", "Gampaha", "Kalutara", "Kandy"],
      pricingLKR: "Rs. 2,000 – 8,000 per treatment",
      phone: "+94 77 *** ****", verified: true, responseTime: "Within 24 hours",
    },
    {
      id: "sv-pest-002", name: "EcoSafe Pest Solutions", category: "pest_control",
      specialization: "Eco-friendly treatments, bed bug removal",
      rating: 4.4, reviewCount: 87, experienceYears: 6,
      coverageAreas: ["Colombo", "Negombo"],
      pricingLKR: "Rs. 3,000 – 10,000 per treatment",
      phone: "+94 71 *** ****", verified: true, responseTime: "Scheduled",
    },
  ],
  painting: [
    {
      id: "sv-paint-001", name: "ColorPro Painting Services", category: "painting",
      specialization: "Interior & exterior painting, texture finishes, waterproofing",
      rating: 4.6, reviewCount: 156, experienceYears: 11,
      coverageAreas: ["Colombo", "Gampaha", "Kandy"],
      pricingLKR: "Rs. 15 – 45 per sq ft",
      phone: "+94 77 *** ****", verified: true, responseTime: "Scheduled",
    },
  ],
  carpentry: [
    {
      id: "sv-carp-001", name: "Master Craft Carpentry", category: "carpentry",
      specialization: "Custom furniture, door & window repairs, built-in wardrobes",
      rating: 4.7, reviewCount: 121, experienceYears: 16,
      coverageAreas: ["Colombo", "Gampaha", "Sri Jayawardenepura"],
      pricingLKR: "Rs. 2,000 – 20,000 per job",
      phone: "+94 77 *** ****", verified: true, responseTime: "By appointment",
    },
  ],
  unknown: [],
};

/**
 * Detect service category from user message.
 */
export function pillar5_detectServiceCategory(query: string): ServiceCategory {
  const q = query.toLowerCase();
  if (/electric|wiring|socket|plug|fuse|mcb|switch|light.*not work|power|short circuit/.test(q))
    return "electrical";
  if (/plumb|pipe|leak|tap|toilet|flush|drain|water pump|tank/.test(q))
    return "plumbing";
  if (/ac|air con|air-con|cooling|hvac|refrigerant|gas refill|aircon/.test(q))
    return "ac_repair";
  if (/clean|dust|mop|vacuum|sofa clean|carpet|mattress clean/.test(q))
    return "cleaning";
  if (/pest|cockroach|termite|rat|mosquito|bed bug|ant infestation/.test(q))
    return "pest_control";
  if (/paint|repaint|wall color|exterior paint|primer/.test(q))
    return "painting";
  if (/carpent|furniture|door.*stuck|wardrobe|cabinet|wood|joiner/.test(q))
    return "carpentry";
  return "unknown";
}

export interface ServiceSearchResult {
  category: ServiceCategory;
  categoryLabel: string;
  providers: ServiceProvider[];
  needsCityInput: boolean;
  cityPrompt?: string;
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  electrical: "Electrical Repairs",
  plumbing: "Plumbing Services",
  ac_repair: "AC & HVAC Repair",
  cleaning: "Home Cleaning",
  pest_control: "Pest Control",
  painting: "Painting Services",
  carpentry: "Carpentry & Woodwork",
  unknown: "Home Services",
};

/**
 * Search stub service provider registry by category and city.
 */
export async function pillar5_searchServiceProviders(
  category: ServiceCategory,
  city?: string
): Promise<ServiceSearchResult> {
  const label = CATEGORY_LABELS[category] || "Home Services";

  if (!city) {
    return {
      category,
      categoryLabel: label,
      providers: [],
      needsCityInput: true,
      cityPrompt: `To find verified ${label.toLowerCase()} technicians near you, please tell me your city or area in Sri Lanka. (e.g., Colombo, Kandy, Galle)`,
    };
  }

  const cityLower = city.toLowerCase();
  let providers = SERVICE_REGISTRY[category] || [];

  // Filter by coverage area if city is provided
  const filtered = providers.filter((p) =>
    p.coverageAreas.some((area) => area.toLowerCase().includes(cityLower) || cityLower.includes(area.toLowerCase()))
  );

  // Fall back to all providers if no match (small registry)
  if (filtered.length === 0 && providers.length > 0) {
    // Return all but note the limited coverage
    return {
      category,
      categoryLabel: label,
      providers: providers.slice(0, 3),
      needsCityInput: false,
      cityPrompt: `Note: Coverage in "${city}" may be limited. Showing nearest available providers.`,
    };
  }

  return {
    category,
    categoryLabel: label,
    providers: filtered.length > 0 ? filtered.slice(0, 3) : providers.slice(0, 3),
    needsCityInput: false,
  };
}

// ── Legacy fallback (kept for QA intent) ──────────────────────────────────

export interface SourcingCriteria {
  category: string;
  keywords: string[];
  maxMOQ?: number;
  maxPrice?: number;
}

/**
 * Legacy requirement parser — still used for general QA intent keyword extraction.
 */
export function parseRequirements(message: string): SourcingCriteria {
  const lowercase = message.toLowerCase();
  const criteria: SourcingCriteria = { category: "general", keywords: [] };

  const priceMatch = lowercase.match(/(?:rs\.?|lkr\.?|rupees?)\s*([\d,]+)/i) ||
    lowercase.match(/under\s+([\d,]+)/i);
  if (priceMatch) {
    criteria.maxPrice = parseInt(priceMatch[1].replace(/,/g, ""), 10);
  }

  // Words that we want to explicitly skip (sourcing verbs, stopwords)
  const skipWords = new Set([
    "find", "show", "me", "want", "need", "get", "the", "and", "for", "with", 
    "under", "below", "above", "max", "maximum", "min", "minimum", "less", "than", 
    "please", "search", "list", "rs", "lkr", "rupee", "rupees", "usd", "dollar", 
    "dollars", "price", "budget", "cost", "cheap", "expensive", "about", "around",
    "buy", "purchase", "order", "shop", "shopping", "sourcing", "some", "any", 
    "many", "few", "several", "lot", "lots", "can", "could", "would", "should",
    "like", "have", "has", "had", "go", "going", "item", "items", "product", "products",
    "you", "we"
  ]);

  // Strip punctuation and split into words
  const cleanMessage = lowercase.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ");
  const rawWords = cleanMessage.split(/\s+/).filter(Boolean);

  const keywords = rawWords.filter((w) => {
    // Length must be > 2
    if (w.length <= 2) return false;
    // Must not be in skipWords
    if (skipWords.has(w)) return false;
    // Must not be purely numeric
    if (/^\d+$/.test(w)) return false;
    return true;
  });

  criteria.keywords = keywords;
  return criteria;
}

// ── Pillar 6 — Category Browse ────────────────────────────────────────────

/**
 * Browse a Kapruka category page by URL.
 * Primary: scrapes the HTML page for product data.
 * Fallback: if scraping fails or returns 0 results, searches via MCP.
 */
export async function pillar6_browseCategory(
  categoryUrl: string,
  categoryName: string,
  options: { currency?: string, country?: string } = {},
  mcpContext?: MCPContext
): Promise<KaprukaProduct[]> {
  try {
    const products = await scrapeProductsFromCategoryUrl(categoryUrl, { country: options.country });
    if (products.length > 0) {
      // Normalise scraped products to KaprukaProduct shape
      return products.slice(0, 50).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        currency: p.currency || "LKR",
        imageUrl: p.imageUrl,
        url: p.url,
        inStock: p.inStock,
        category: p.category || categoryName,
        description: p.description,
      }));
    }
    console.warn(`[Pillar6] Scrape returned 0 for "${categoryName}", falling back to MCP search`);
    return await pillar1_searchProducts(categoryName, {}, mcpContext);
  } catch (err) {
    console.error(`[Pillar6] Scrape failed for "${categoryName}":`, (err as Error).message);
    return await pillar1_searchProducts(categoryName, {}, mcpContext);
  }
}
