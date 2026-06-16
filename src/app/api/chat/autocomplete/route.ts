import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  try {
    const { inputText, chatHistory } = await req.json().catch(() => ({}));

    if (!inputText || typeof inputText !== "string") {
      return NextResponse.json({ suggestions: [] });
    }

    const words = inputText.trim().split(/\s+/).filter(Boolean);
    if (words.length < 3 || words.length > 5) {
      return NextResponse.json({ suggestions: [] });
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

    // Build chat history snippet for context
    let historySnippet = "";
    if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
      historySnippet = chatHistory
        .slice(-4) // Take last 4 messages (2 turns)
        .map((m: any) => `${m.role.toUpperCase()}: ${m.content.substring(0, 150)}`)
        .join("\n");
    }

    const systemInstruction = `You are Kapuruka's AI shopping assistant autocomplete engine.
Your task is to generate 3 realistic, context-appropriate completions of the user's partially typed input.
- Keep completions natural and short (between 3 and 10 words).
- Focus on Sri Lankan B2B wholesale, gifting, cakes, products, local services, or general e-commerce.
- The suggestions MUST start with or build upon the exact text of the user's input, completing their thought.
- Return ONLY a JSON array of strings containing the fully completed sentences.
- Do NOT repeat the user's input exactly as the final suggestions if there is no completion.
- Do NOT provide markdown styling or explanations. Return exactly a JSON array.`;

    const prompt = `
[Recent Chat History Context]
${historySnippet || "No previous history."}

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
