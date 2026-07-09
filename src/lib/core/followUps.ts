/**
 * followUps.ts
 * ---------------------------------------------------------------------------
 * Phase 5 — Follow-up Generator
 *
 * Extracted from route.ts. Generates context-aware follow-up suggestions
 * for the user based on the intent and the response.
 * ---------------------------------------------------------------------------
 */

import type { GoogleGenAI } from "@google/genai";
import type { Intent } from "@/lib/nlp";

const STATIC_FOLLOW_UPS: Record<Intent, string[]> = {
  product: [
    "Show me products under Rs. 2,000",
    "Filter by local Sri Lankan brands",
    "How do I buy and pay for this?",
  ],
  category_browse: [
    "Show me the best selling ones",
    "Filter by local Sri Lankan brands",
    "Are these available for same day delivery?",
  ],
  delivery: [
    "Can you deliver perishables to Kandy?",
    "What are the delivery charges to Galle?",
    "Track my recent Kapruka order",
  ],
  service: [
    "Find an electrician in Colombo",
    "Book a cleaning service for this weekend",
    "What's the average cost for AC repair?",
  ],
  qa: [
    "What payment methods does Kapruka accept?",
    "How long does standard delivery take?",
    "Can I return a product if it's damaged?",
  ],
  order_history: [
    "What are the products that I ordered previously?",
    "What did I buy last month?",
    "Track my past orders",
  ],
};

export async function generateFollowUps(
  intent: Intent,
  response: string,
  ai: GoogleGenAI | null,
  model: string
): Promise<string[]> {
  if (!ai) {
    return STATIC_FOLLOW_UPS[intent] || [];
  }

  try {
    const prompt = `Based on this assistant response: "${response.substring(0, 300)}..."
Generate 3 short, relevant follow-up questions the user might want to ask next.
Make them concise (under 8 words each) and highly specific to the context.

Respond ONLY with a JSON array of strings: ["question 1", "question 2", "question 3"]`;

    const result = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
    });

    const text = (result.text || "[]").trim();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3);
    }
  } catch (err) {
    console.error("[FollowUps] Failed to generate dynamic follow-ups:", err);
  }

  return STATIC_FOLLOW_UPS[intent] || [];
}
