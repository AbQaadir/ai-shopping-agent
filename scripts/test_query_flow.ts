import { findRelevantCategories } from "../src/lib/categories";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

// 1. Manually parse .env file to load GEMINI_API_KEY and FAST_GEMINI_MODEL
function loadEnv() {
  const envPath = path.join(__dirname, "../.env");
  if (!fs.existsSync(envPath)) {
    console.error("No .env file found!");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      // Strip optional quotes
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  }
}

async function run() {
  loadEnv();

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.FAST_GEMINI_MODEL || "gemini-3.1-flash-lite";

  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env!");
    process.exit(1);
  }

  const query = "I want to buy some traditional Sri Lankan gift hampers";
  console.log(`Query: "${query}"\n`);

  // Step 1: Run local category matcher
  console.log("=== STEP 1: Running Local Category Matcher (RACR) ===");
  const matchedCats = findRelevantCategories(query, 3);
  console.log("Matched Category Candidates:");
  console.log(JSON.stringify(matchedCats, null, 2));

  const matchedCategoriesText = matchedCats.length > 0 
    ? matchedCats.map(c => `- ${c.slug} (Path: ${c.path})`).join("\n")
    : "None found";

  // Step 2: Build the classification prompt
  console.log("\n=== STEP 2: Building Classifier Prompt ===");
  const classifierPrompt = `You are a query classifier and search term extractor for Kapruka (Sri Lankan e-commerce assistant).
Analyze the user query in the context of the recent conversation history, and perform these tasks:

1. Determine user intent ("intent"):
   - "product": User wants to browse, search, compare, or buy products (e.g. "show me phone cases", "buy chocolates", "price of cake").
   - "delivery": User is asking about delivery areas, availability, rates, tracking, or order status (e.g. "can you deliver to Galle?", "track order 12345", "is delivery available tomorrow?").
   - "service": User needs a home service (repair, cleaning, pest control, plumber, electrician, AC repair, carpentry).
   - "qa": General platform questions (returns, policies, general account help) or general knowledge/informational queries that require web search grounding. Note: Do NOT classify any checkout responses, payment method selections for an active order, or checkout confirmations (e.g. cash on delivery) as "qa".

3. Extract focused product search terms and price filters ("searchTerms") as a JSON array of objects matching this schema:
   {
     "term": string (MAX 2 words — the core product noun only. Strip colors/descriptors like "gold", "silver", "black", occasion/verbs/filler words like "wedding", "cheap", "buy", "for me". CRITICAL: Translate generic shopping nouns to local Sri Lankan database listing nouns, especially: "phone case" or "phone cover" -> "backcover" or "cover" or "casing"),
     "minPrice": number | null (minimum price limit specified by user, e.g. "above 5000" -> 5000, "between 2000 and 5000" -> 2000. Set to null if there is no minimum price limit),
     "maxPrice": number | null (maximum price limit specified by user, e.g. "under 3000" -> 3000, "between 2000 and 5000" -> 5000. Set to null if there is no maximum price limit)
   }

   CRITICAL RULES:
   - Do NOT include any currency symbols or conversions in minPrice/maxPrice — just extract the raw numbers as numbers.
   - Extract ONE object per distinct product the user wants (max 3 objects total).
   - If not a product/service intent, set "searchTerms" to [].

[Candidate Store Categories matching query]
${matchedCategoriesText}

[Instructions for translation and noun preparation]
Use the candidate categories above to understand the listing taxonomy and prepare/translate the search query keyword ("term") to match the category's typical product noun (e.g., translate "phone cases" to "backcover" or "cover" or "casing" if the matched category is mobile_phone_accessories, and "cake" or "bento cake" to "cake" or "ribbon cake").

Respond ONLY with JSON matching this structure:
{"intent": "product"|"delivery"|"service"|"qa", "isRelated": boolean, "searchTerms": [{"term": string, "minPrice": number|null, "maxPrice": number|null}], "reason": "brief explanation"}

[Recent Conversation History]
No previous history.

User query to classify: "${query}"`;

  console.log("------------------ PROMPT START ------------------");
  console.log(classifierPrompt);
  console.log("------------------- PROMPT END -------------------");

  // Step 3: Call Gemini API
  console.log("\n=== STEP 3: Calling Gemini API ===");
  console.log(`Model: ${modelName}`);
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: classifierPrompt,
    config: { responseMimeType: "application/json" },
  });

  const responseText = response.text || "{}";
  console.log("Raw Response Text:");
  console.log(responseText);

  // Step 4: Parse & Analyze the response
  console.log("\n=== STEP 4: Parsing and Analyzing Result ===");
  try {
    let cleanText = responseText;
    if (cleanText.includes("```")) {
      cleanText = cleanText.replace(/```json/i, "").replace(/```/g, "");
    }
    cleanText = cleanText.trim();
    const startIdx = cleanText.indexOf("{");
    const endIdx = cleanText.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      cleanText = cleanText.substring(startIdx, endIdx + 1);
    }
    const parsed = JSON.parse(cleanText);
    console.log("Parsed JSON:", JSON.stringify(parsed, null, 2));

    if (parsed.intent === "product" && parsed.searchTerms && parsed.searchTerms.length > 0) {
      console.log("\nResulting Tool Call Parameters to kapruka_search_products:");
      parsed.searchTerms.forEach((t: any, index: number) => {
        console.log(`[Search Term #${index + 1}]`);
        console.log(`- term (q): "${t.term}"`);
        console.log(`- max_price: ${t.maxPrice !== null ? t.maxPrice : "undefined"}`);
      });
    } else {
      console.log("No search terms extracted or intent is not 'product'.");
    }
  } catch (err) {
    console.error("Failed to parse response JSON:", err);
  }
}

run();
