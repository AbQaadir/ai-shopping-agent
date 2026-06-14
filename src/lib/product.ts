/**
 * Sanitizes a product title by cleaning up HTML/UTF-8 decoding corruptions
 * and splitting off subtitle/description details (anything after a dash).
 */
export function cleanProductTitle(rawName: string | undefined | null): string {
  if (!rawName) return "Product";

  // Clean up corrupted UTF-8 byte sequences decoded as Latin1 entities (e.g. N#226;n #8364;n#8220; or &#226;...)
  let cleaned = rawName
    .replace(/[N&]#226;n?\s*[#&]8364;n?\s*[#&]8220;/g, " – ")
    .replace(/&ndash;/g, " – ")
    .replace(/&mdash;/g, " — ");

  // Split by dash to get only the core title if it has a dash separator
  if (cleaned.includes(" – ")) {
    cleaned = cleaned.split(" – ")[0];
  } else if (cleaned.includes(" — ")) {
    cleaned = cleaned.split(" — ")[0];
  } else if (cleaned.includes(" - ")) {
    cleaned = cleaned.split(" - ")[0];
  }

  // Standard title capitalization
  const words = cleaned.trim().split(/\s+/);
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (/^\d+(kg|g|ml|l|oz|pcs|m|cm|mm)$/i.test(word)) {
        return lower;
      }
      if (/^(lkr|usd|eur|sme)$/i.test(word)) {
        return word.toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
