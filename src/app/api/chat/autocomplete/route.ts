import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Bounded in-memory server cache to return duplicates instantly
interface CacheEntry {
  suggestions: string[];
  timestamp: number;
}
const serverCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache TTL
const MAX_CACHE_SIZE = 1000;

export async function POST(req: NextRequest) {
  try {
    const { inputText } = await req.json().catch(() => ({}));

    if (!inputText || typeof inputText !== "string") {
      return NextResponse.json({ suggestions: [] });
    }

    const words = inputText.trim().split(/\s+/).filter(Boolean);
    if (words.length < 1) {
      return NextResponse.json({ suggestions: [] });
    }

    const cacheKey = inputText.trim().toLowerCase();
    const cached = serverCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json({ suggestions: cached.suggestions });
    }

    const apiKey = config.gemini.apiKey;
    if (!apiKey) {
      // Mock suggestions if API Key is not set, for local test compatibility
      const lowerInput = inputText.toLowerCase().trim();
      const mockCompletions = [
        "some unique plants for my garden",
        "unique gifts for my friends",
        "new items from the Kapruka catalog",
      ];
      const matchingMock = mockCompletions.map((comp) => {
        if (comp.startsWith(lowerInput)) return comp;
        return `${inputText} ${comp}`;
      });
      return NextResponse.json({ suggestions: matchingMock.slice(0, 3) });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = config.gemini.autoCompleteModel;



    const systemInstruction = `You are Kapuruka's AI shopping assistant autocomplete engine.
Your task is to generate 3 realistic, context-appropriate completions of the user's partially typed input.
- Keep completions natural and short (between 3 and 10 words).
- Focus on Sri Lankan B2B wholesale, gifting, cakes, products, local services, or general e-commerce.
- The suggestions MUST start with or build upon the exact text of the user's input, completing their thought.
- Return ONLY a JSON array of strings containing the fully completed sentences.
- Do NOT repeat the user's input exactly as the final suggestions if there is no completion.
- Do NOT provide markdown styling or explanations. Return exactly a JSON array.`;

    const prompt = `
[User partially typed input]
"${inputText}"

Generate 3 completions for the user's input.
Output format MUST be: ["Completion 1", "Completion 2", "Completion 3"]`;

    const result = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        maxOutputTokens: 80,
        temperature: 0.2,
      },
    });

    let responseText = result.text || "[]";
    
    // Clean markdown code blocks if they are present in the response
    if (responseText.includes("```")) {
      responseText = responseText.replace(/```json/i, "").replace(/```/g, "");
    }
    responseText = responseText.trim();
    responseText = extractFirstJsonArray(responseText);

    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch (err) {
      console.error("[Autocomplete API] JSON parse failed:", err, "Response was:", responseText);
    }

    // Save to server-side cache
    if (serverCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = serverCache.keys().next().value;
      if (oldestKey) {
        serverCache.delete(oldestKey);
      }
    }
    serverCache.set(cacheKey, {
      suggestions: suggestions.slice(0, 3),
      timestamp: Date.now()
    });

    return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
  } catch (error) {
    console.error("[Autocomplete API] Critical error:", error);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
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
    if (char === "\\") {
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
