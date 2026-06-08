export type Intent = "product" | "delivery" | "import" | "service" | "qa";

// ── URL Detection (for import intent) ──────────────────────────────────────
export function extractUrlFromMessage(message: string): string | null {
  const urlRegex = /https?:\/\/[^\s]+/i;
  const match = message.match(urlRegex);
  return match ? match[0] : null;
}

// ── Price extraction for import queries ────────────────────────────────────
export function extractUsdPrice(message: string): number | undefined {
  const match = message.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (match) return parseFloat(match[1].replace(",", ""));
  const wordMatch = message.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:usd|dollars?)/i);
  if (wordMatch) return parseFloat(wordMatch[1].replace(",", ""));
  return undefined;
}

// ── City extraction for delivery queries ───────────────────────────────────
export function extractCityFromMessage(message: string): string | null {
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
export function extractOrderId(message: string): string | null {
  const match = message.match(/\b(KAP-?[A-Z0-9]{6,12}|order[:\s#]*([A-Z0-9-]{6,15}))\b/i);
  return match ? (match[2] || match[1]).toUpperCase() : null;
}

// ── Date extraction (simple) ───────────────────────────────────────────────
export function extractDate(message: string): string {
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
export function ruleBasedIntent(message: string): Intent {
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
