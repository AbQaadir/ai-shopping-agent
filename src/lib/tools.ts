/**
 * tools.ts
 * ---------------------------------------------------------------------------
 * 5-Pillar Tool Layer for the Kapuruka AI Agent.
 *
 * Each Pillar maps to a group of tools. Tools call the Kapruka MCP server
 * via mcpClient.ts (Pillars 1–2) or implement custom logic (Pillars 3–5).
 *
 * Pillar 1 — Domestic E-Commerce  (MCP: search, details, checkout)
 * Pillar 2 — Grasshoppers Logistics (MCP: delivery check, tracking, cities)
 * Pillar 3 — Partner Central / SME  (MCP search + SME tagging)
 * Pillar 4 — Cross-Border Import    (Custom: LKR landed cost estimator)
 * Pillar 5 — Services Platform      (Custom: stub service provider registry)
 * ---------------------------------------------------------------------------
 */

import {
  searchProducts,
  getProduct,
  createOrder,
  checkDelivery,
  trackOrder,
  listDeliveryCities,
  KaprukaProduct,
  KaprukaOrderResult,
  KaprukaDeliveryResult,
  KaprukaTrackingResult,
  KaprukaCity,
} from "./mcpClient";

// Re-export shared types so API route can use them
export type {
  KaprukaProduct,
  KaprukaOrderResult,
  KaprukaDeliveryResult,
  KaprukaTrackingResult,
  KaprukaCity,
};

// ── Pillar 1 — Domestic E-Commerce ────────────────────────────────────────

/**
 * Search Kapruka's live catalog via MCP.
 * SME products are tagged with isSME = true for Pillar 3 highlighting.
 */
export async function pillar1_searchProducts(
  query: string,
  options: { maxPriceLKR?: number; category?: string; smeFirst?: boolean } = {}
): Promise<KaprukaProduct[]> {
  const result = await searchProducts(query, {
    category: options.category,
    maxPrice: options.maxPriceLKR,
    inStockOnly: false,
  });

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

  return products.slice(0, 8);
}

/**
 * Fetch full product details by Kapruka product ID.
 */
export async function pillar1_getProductDetails(
  productId: string
): Promise<KaprukaProduct | null> {
  const result = await getProduct(productId);
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
  productId: string,
  quantity: number,
  recipient: { name: string; phone: string; address: string; city: string }
): Promise<KaprukaOrderResult | null> {
  const result = await createOrder(productId, quantity, recipient);
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
  isPerishable = false
): Promise<KaprukaDeliveryResult | null> {
  const result = await checkDelivery(city, date, isPerishable);
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
  orderId: string
): Promise<KaprukaTrackingResult | null> {
  const result = await trackOrder(orderId);
  if (!result.success || !result.data) {
    console.error("[Pillar2] trackOrder failed:", result.error);
    return null;
  }
  return result.data;
}

/**
 * Search for valid Grasshoppers delivery cities by partial name.
 */
export async function pillar2_findCity(partialName: string): Promise<KaprukaCity[]> {
  const result = await listDeliveryCities(partialName);
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
export async function pillar3_searchSMEProducts(query: string): Promise<KaprukaProduct[]> {
  return pillar1_searchProducts(query, { smeFirst: true });
}

// ── Pillar 4 — Cross-Border Import Cost Estimator ─────────────────────────

export interface ImportEstimateResult {
  originalUrl: string;
  productTitle: string;
  usdPrice: number;
  usdToLkrRate: number;
  cifValueLKR: number;        // CIF value (includes shipping estimate)
  customsDutyLKR: number;     // HS-category customs duty
  customsDutyPct: number;
  palLKR: number;             // Port & Airport Levy — 10%
  cessLKR: number;            // CESS — 2.5%
  vatLKR: number;             // VAT on (CIF + all duties) — 18%
  totalLandedLKR: number;
  breakdown: string;
  disclaimer: string;
}

/**
 * Sri Lanka standard import duty rates by broad product category.
 * Source: Sri Lanka Customs Tariff (general reference rates, 2024).
 * These are indicative — actual rates depend on 6-digit HS code.
 */
const SL_DUTY_RATES: Record<string, number> = {
  electronics: 0.0,        // Most electronics: 0% customs (but PAL + CESS + VAT apply)
  clothing: 0.30,          // Garments: 30%
  footwear: 0.30,          // Footwear: 30%
  toys: 0.15,              // Toys: 15%
  books: 0.0,              // Books: exempt
  cosmetics: 0.30,         // Cosmetics: 30%
  food: 0.20,              // Processed food: ~20%
  furniture: 0.15,         // Furniture: 15%
  sports: 0.15,            // Sports goods: 15%
  jewelry: 0.30,           // Jewelry: 30%
  tools: 0.10,             // Hand tools: 10%
  appliances: 0.10,        // Home appliances: 10%
  general: 0.15,           // General / unknown: 15% (conservative estimate)
};

/** Detect broad SL HS category from URL and product title keywords */
function detectProductCategory(url: string, title: string): { category: string; dutyPct: number } {
  const combined = `${url} ${title}`.toLowerCase();
  if (/laptop|phone|tablet|computer|camera|headphone|speaker|tv|monitor|smart/.test(combined)) {
    return { category: "Electronics", dutyPct: SL_DUTY_RATES.electronics };
  }
  if (/shirt|dress|trouser|jeans|clothing|apparel|jacket|coat|hoodie/.test(combined)) {
    return { category: "Clothing", dutyPct: SL_DUTY_RATES.clothing };
  }
  if (/shoe|boot|sneaker|sandal|footwear/.test(combined)) {
    return { category: "Footwear", dutyPct: SL_DUTY_RATES.footwear };
  }
  if (/toy|game|lego|puzzle|doll|action figure/.test(combined)) {
    return { category: "Toys", dutyPct: SL_DUTY_RATES.toys };
  }
  if (/book|novel|textbook|kindle/.test(combined)) {
    return { category: "Books", dutyPct: SL_DUTY_RATES.books };
  }
  if (/cream|serum|makeup|lipstick|perfume|cosmetic|beauty/.test(combined)) {
    return { category: "Cosmetics", dutyPct: SL_DUTY_RATES.cosmetics };
  }
  if (/food|snack|supplement|vitamin|protein/.test(combined)) {
    return { category: "Food & Supplements", dutyPct: SL_DUTY_RATES.food };
  }
  if (/sofa|chair|desk|bed|furniture|table/.test(combined)) {
    return { category: "Furniture", dutyPct: SL_DUTY_RATES.furniture };
  }
  if (/watch|ring|necklace|bracelet|gold|silver|jewelry/.test(combined)) {
    return { category: "Jewelry", dutyPct: SL_DUTY_RATES.jewelry };
  }
  if (/washer|dryer|refrigerator|oven|microwave|appliance/.test(combined)) {
    return { category: "Appliances", dutyPct: SL_DUTY_RATES.appliances };
  }
  return { category: "General Goods", dutyPct: SL_DUTY_RATES.general };
}

/**
 * Estimate Sri Lanka landed cost for an imported product.
 * Uses live USD→LKR rate approximation + SL standard duty schedule.
 *
 * Calculation order (per Sri Lanka Customs):
 *   1. CIF value = (USD price × LKR rate) + estimated freight
 *   2. Customs Duty = CIF × duty rate
 *   3. PAL = CIF × 10%
 *   4. CESS = CIF × 2.5%
 *   5. VAT = (CIF + Duty + PAL + CESS) × 18%
 *   6. Total = CIF + Duty + PAL + CESS + VAT
 */
export async function pillar4_estimateImportCost(
  url: string,
  manualUsdPrice?: number
): Promise<ImportEstimateResult | null> {
  // USD → LKR rate (approximate fixed rate — in production use a live FX API)
  const USD_TO_LKR = 325;
  // Estimated international freight & insurance (flat Rs. 3000 for small parcels)
  const FREIGHT_LKR = 3000;

  // Try to extract a price and title from the URL if no manual price provided
  let usdPrice = manualUsdPrice || 0;
  let productTitle = "Imported Product";

  if (!usdPrice) {
    // Attempt simple price extraction from URL query params (Amazon pattern)
    try {
      const urlObj = new URL(url);
      const title = urlObj.searchParams.get("title") || urlObj.pathname.split("/").filter(Boolean).join(" ");
      productTitle = title.replace(/-/g, " ").replace(/_/g, " ").substring(0, 80) || "Imported Product";
    } catch {
      // Ignore URL parse errors
    }
    // Default to a reasonable mid-range estimate if price unknown
    usdPrice = 50;
    productTitle = "Product from " + (url.includes("amazon") ? "Amazon" : url.includes("walmart") ? "Walmart" : url.includes("ebay") ? "eBay" : "external store");
  }

  const { category, dutyPct } = detectProductCategory(url, productTitle);

  const cifValueLKR = usdPrice * USD_TO_LKR + FREIGHT_LKR;
  const customsDutyLKR = Math.round(cifValueLKR * dutyPct);
  const palLKR = Math.round(cifValueLKR * 0.10);
  const cessLKR = Math.round(cifValueLKR * 0.025);
  const vatBase = cifValueLKR + customsDutyLKR + palLKR + cessLKR;
  const vatLKR = Math.round(vatBase * 0.18);
  const totalLandedLKR = Math.round(cifValueLKR + customsDutyLKR + palLKR + cessLKR + vatLKR);

  const breakdown = [
    `CIF Value (USD ${usdPrice.toFixed(2)} × ${USD_TO_LKR} + freight): LKR ${cifValueLKR.toLocaleString()}`,
    `Customs Duty (${(dutyPct * 100).toFixed(0)}% — ${category}): LKR ${customsDutyLKR.toLocaleString()}`,
    `Port & Airport Levy (PAL 10%): LKR ${palLKR.toLocaleString()}`,
    `CESS (2.5%): LKR ${cessLKR.toLocaleString()}`,
    `VAT (18% on total): LKR ${vatLKR.toLocaleString()}`,
    `──────────────────────────────────`,
    `Total Landed Cost: LKR ${totalLandedLKR.toLocaleString()}`,
  ].join("\n");

  const disclaimer =
    "⚠️ This estimate is based on standard Sri Lanka Customs duty rates (2024) and an approximate USD/LKR exchange rate. " +
    "Actual duties depend on the exact HS code, declared customs value, and prevailing exchange rates. " +
    "This is not an official Kapruka or Sri Lanka Customs quote.";

  return {
    originalUrl: url,
    productTitle,
    usdPrice,
    usdToLkrRate: USD_TO_LKR,
    cifValueLKR,
    customsDutyLKR,
    customsDutyPct: dutyPct,
    palLKR,
    cessLKR,
    vatLKR,
    totalLandedLKR,
    breakdown,
    disclaimer,
  };
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

  const skipWords = ["find", "show", "me", "want", "need", "get", "the", "and", "for", "with", "under", "below"];
  const words = lowercase.split(/\s+/).filter((w) => w.length > 2 && !skipWords.includes(w));
  criteria.keywords = words;

  return criteria;
}
