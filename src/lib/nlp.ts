export type Intent = "product" | "delivery" | "service" | "qa" | "category_browse" | "order_history" | "general";



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

  // ── Sinhala / Tamil / Tanglish keyword patterns ────────────────────────

  // Delivery — Sinhala: බෙදාහැරීම (delivery), එවන්න (send), කොහෙද (where)
  // Tamil: டெலிவரி, அனுப்ப (send), எங்கே (where)
  // Romanized: "bedaharima", "evanna", "delivery kiyanawa", "anuppa", "enge"
  if (/බෙදාහැරීම|එවන්න|කොහෙද.*ඕඩරය|ඕඩර.*කොහෙද/i.test(message)) return "delivery";
  if (/டெலிவரி|அனுப்ப|எங்கே.*ஆர்டர்/i.test(message)) return "delivery";
  if (/bedaharima|evanna.*delivery|delivery.*kiyanawa|anuppa|enge.*order/i.test(lower)) return "delivery";

  // Service — Sinhala: අලුත්වැඩියා (repair), කාර්මික (technician), නල කාර්මික (plumber)
  // Tamil: பழுது (repair), தொழிலாளி (worker), குழாய் (pipe)
  if (/අලුත්වැඩියා|කාර්මික|නල.*කාර්මික|විදුලි.*කාර්මික/i.test(message)) return "service";
  if (/பழுது|தொழிலாளி|குழாய்|எலெக்ட்ரீசியன்/i.test(message)) return "service";
  if (/alutwadiya|karmika|nala.*karmika|plumber.*kiyanawa/i.test(lower)) return "service";

  // Product — Sinhala: ගන්න (buy), මිල (price), සොයන්න (search), වට්ටම් (discount)
  // Tamil: வாங்க (buy), விலை (price), தேட (search), தள்ளுபடி (discount)
  // Romanized: "ganna", "mila", "soyanna", "wattam", "vaanga", "vilai"
  if (/ගන්න|මිල|සොයන්න|වට්ටම්|මිලට/i.test(message)) return "product";
  if (/வாங்க|விலை|தேட|தள்ளுபடி/i.test(message)) return "product";
  if (/ganna\b|mila\b|soyanna|wattam|vaanga|vilai|thedi|ona\b.*eka|eka\b.*ganna/i.test(lower)) return "product";

  // QA — Sinhala: ආපසු (return), මුදල් (money/refund), ගෙවීම (payment)
  // Tamil: திரும்ப (return), பணம் (money), கொடுப்பனவு (payment)
  if (/ආපසු|මුදල්.*ආපසු|ගෙවීම|ප්‍රතිපත්ති/i.test(message)) return "qa";
  if (/திரும்ப|பணம்.*திரும்ப|கொடுப்பனவு/i.test(message)) return "qa";

  // ── English keyword patterns ───────────────────────────────────────────

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
