import { CATEGORIES_MAP } from "./categoriesMap";

const STOPWORDS = new Set([
  "find", "show", "me", "want", "need", "get", "the", "and", "for", "with", 
  "under", "below", "above", "max", "maximum", "min", "minimum", "less", "than", 
  "please", "search", "list", "rs", "lkr", "rupee", "rupees", "usd", "dollar", 
  "dollars", "price", "budget", "cost", "cheap", "expensive", "about", "around",
  "buy", "purchase", "order", "shop", "shopping", "sourcing", "some", "any", 
  "many", "few", "several", "lot", "lots", "can", "could", "would", "should",
  "like", "have", "has", "had", "go", "going", "item", "items", "product", "products",
  "you", "we", "a", "an", "or", "in", "at", "color", "colour", "colors", "colours",
  "please", "kindly"
]);

/**
 * Category synonyms dictionary to resolve general shopping terms
 * into precise Kapruka category slugs.
 */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  "mobile_phone_accessories": ["case", "cover", "backcover", "casing", "charger", "cable", "tempered", "screen guard", "holder", "stands", "powerbank", "earphone"],
  "mobile_phones": ["smartphone", "iphone", "samsung", "android", "huawei", "xiaomi"],
  "cakes": ["gateau", "cupcake", "brownie", "pastry", "birthday cake", "anniversary cake"],
  "flowers": ["rose", "bouquet", "floral", "blossom", "valentines flowers"],
  "chocolates": ["gift", "hamper", "sweet", "candy", "ferrero", "toblerone", "lindt"],
  "clothing": ["shirt", "t-shirt", "pants", "dress", "frock", "trousers", "saree", "kurta", "sarong", "socks", "jeans"],
  "grocery": ["food", "rice", "spice", "oil", "milk", "tea", "coffee", "biscuit", "noodle"],
  "perfumes": ["cologne", "fragrance", "scent", "spray", "body mist"],
  "kidstoys": ["doll", "lego", "blocks", "board game", "toy car", "puzzle"],
  "jewellery": ["ring", "necklace", "bracelet", "earring", "bangle", "diamond", "gold ring"],
  "cosmetics": ["lipstick", "makeup", "shampoo", "lotion", "sunscreen", "face wash"],
  "liquor": ["beer", "whisky", "wine", "alcohol", "vodka", "gin", "rum"]
};

export interface CategoryMatch {
  slug: string;
  path: string;
  score: number;
}

/**
 * Searches the flat category hierarchy for paths that match the keywords
 * in the user's query. It scores matches based on exact slug matching,
 * substring matching, word boundary matches, and synonym list expansion.
 * 
 * @param queryText The user query (e.g. "gold color phone cases")
 * @param limit The maximum number of category matches to return
 * @returns Array of matched categories sorted by relevance score descending
 */
export function findRelevantCategories(queryText: string, limit = 3): CategoryMatch[] {
  if (!queryText || typeof queryText !== "string") return [];
  
  const lowercase = queryText.toLowerCase();
  // Strip common punctuation and replace with spaces
  const cleanText = lowercase.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ");
  
  // Extract search tokens, filtering out short words and common stopwords
  const tokens = cleanText
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  
  if (tokens.length === 0) return [];
  
  const matches: CategoryMatch[] = [];
  
  for (const [slug, path] of Object.entries(CATEGORIES_MAP)) {
    const pathLower = path.toLowerCase();
    const slugLower = slug.toLowerCase();
    let score = 0;
    
    // 1. Synonym matching (adds significant weight if synonyms match user query)
    const synonyms = CATEGORY_SYNONYMS[slug];
    if (synonyms) {
      for (const synonym of synonyms) {
        if (cleanText.includes(synonym)) {
          score += 12; // High priority for clear synonyms
        }
      }
    }
    
    for (const token of tokens) {
      // 2. Exact match on the URL slug
      if (slugLower === token) {
        score += 10;
      } else if (slugLower.includes(token)) {
        score += 5;
      }
      
      // 3. Match on the category display path
      if (pathLower.includes(token)) {
        score += 3;
        // Extra weight for exact word boundary match
        const regex = new RegExp(`\\b${token}s?\\b`, "i"); // handle basic plural 's'
        if (regex.test(pathLower)) {
          score += 3;
        }
      }
    }
    
    if (score > 0) {
      matches.push({ slug, path, score });
    }
  }
  
  // Sort by score descending, then by path length (shorter paths are usually cleaner)
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.path.length - b.path.length;
  });
  
  return matches.slice(0, limit);
}
