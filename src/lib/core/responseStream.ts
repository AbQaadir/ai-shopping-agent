/**
 * responseStream.ts
 * ---------------------------------------------------------------------------
 * Phase 5 — Main Response Streaming
 *
 * Generates the final natural language response using the LLM, grounded
 * in the context, goal, and the results of the Tool Planner.
 * ---------------------------------------------------------------------------
 */

import type { GoogleGenAI } from "@google/genai";
import type { ContextWindow } from "./context";
import type { IntentClassification } from "./intent";
import type { ToolResults } from "./types";
import type { CheckoutState } from "@/lib/checkoutContext";
import { streamWords } from "./streamHelpers";

function generateFallback(intent: IntentClassification["intent"]): string {
  switch (intent) {
    case "product":
      return "I found some matching products on Kapruka. Click 'Buy Now' to start checkout.";
    case "category_browse":
      return "I found some product categories on Kapruka. Please browse them below.";
    case "delivery":
      return "I can check Kapruka Grasshoppers delivery availability and rates to any Sri Lankan city.";
    case "service":
      return "I can connect you with verified home service technicians in your area.";
    case "qa":
      return "Kapruka accepts Credit/Debit cards, bank transfers, and cash on delivery for select areas.";
    case "order_history":
      return "I found your past purchases. Click on any product to view details.";
    default:
      return "I'm here to help you shop on Kapruka. What are you looking for today?";
  }
}

export async function streamMainResponse(
  message: string,
  intent: IntentClassification,
  context: ContextWindow,
  toolResults: ToolResults,
  checkoutState: CheckoutState | null,
  send: (payload: Record<string, unknown>) => void,
  ai: GoogleGenAI | null,
  model: string,
  isAgeRestricted: boolean
): Promise<string> {
  if (!ai) {
    const fallback = generateFallback(intent.intent);
    await streamWords(fallback, send);
    return fallback;
  }

  // Build the system prompt using context
  let systemPrompt = `You are the Kapruka Shopping Assistant, a helpful AI that helps users find products, check delivery, and track orders in Sri Lanka.
Maintain a friendly, professional tone. Keep responses brief (under 3 sentences unless explaining a complex policy). Do not use Markdown formatting for lists unless necessary.`;

  if (checkoutState && checkoutState.phase !== "cancelled" && checkoutState.phase !== "confirmed") {
    systemPrompt += `\n[Active Checkout Context]\nThe user is currently in the middle of a checkout flow (Phase: ${checkoutState.phase}). Do not try to initiate a new checkout.`;
  }

  if (context.goal) {
    systemPrompt += `\n[Conversation Goal]\nUser's main goal: ${context.goal.primaryIntent}`;
  }

  if (isAgeRestricted) {
    systemPrompt += `\n[Age Restriction]\nThis product is age-restricted. Remind the user that ID verification is required upon delivery.`;
  }

  // Summarize tool results for the LLM
  let toolResultsSummary = "";
  if (toolResults.results.length > 0) {
    toolResultsSummary = toolResults.results.map((r) => {
      let summary: string = r.status;
      if (r.status === "success" && Array.isArray(r.data)) {
        summary = `Success (${r.data.length} items found)`;
      } else if (r.status === "error") {
        summary = `Error: ${r.error}`;
      }
      return `${r.toolName}: ${summary}`;
    }).join("\n");
  } else {
    toolResultsSummary = "No tools were executed for this turn.";
  }

  const prompt = `${systemPrompt}

[Conversation History]
${context.historySnippet || "No previous history."}

[Tool Execution Results]
${toolResultsSummary}

User's message: "${message}"

Respond directly to the user based on the tool results and their query. Do not mention that you used tools. Just provide the answer.`;

  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents: prompt,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        send({ type: "text", content: text });
      }
    }
    return fullResponse;
  } catch (err) {
    console.error("[ResponseStream] Failed to stream response:", err);
    const fallback = generateFallback(intent.intent);
    await streamWords(fallback, send);
    return fallback;
  }
}
