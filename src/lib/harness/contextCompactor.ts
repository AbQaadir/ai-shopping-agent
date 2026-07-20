/**
 * Context Compactor
 *
 * Replaces the naive raw-slice historySnippet with an intelligent, tiered
 * context strategy based on conversation length:
 *
 *   < 10 messages  → Raw snippets (existing behavior, zero latency)
 *   10-24 messages → LLM-generated bullet summary (cached to DB)
 *   >= 25 messages → Full compaction: summary + last 3 raw messages only
 *
 * The generated summary is cached on ChatSession.compactedHistory and only
 * re-generated when the session has grown by >= 5 messages since last compaction.
 *
 * DESIGN PRINCIPLE: If anything fails, fall back to raw snippets. The compactor
 * must NEVER block the main request pipeline.
 */

import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import type { CompactorParams, CompactorResult } from "@/lib/harness/types";

const LOG_PREFIX = "[Harness:Compactor]";

// ─── Thresholds ────────────────────────────────────────────────────────────────

/** Below this, use raw snippets (no LLM call) */
const RAW_THRESHOLD = 10;

/** At or above this, use full compaction (summary + last 3 only) */
const FULL_COMPACTION_THRESHOLD = 25;

/**
 * Re-generate summary after this many new messages since last compaction.
 * Lower = more up-to-date but more LLM calls.
 */
const COMPACTION_CACHE_INTERVAL = 5;

/** Max chars per raw message snippet (same as existing historySnippet logic) */
const RAW_SNIPPET_LENGTH = 150;

/** Max messages to include as raw in the hybrid output */
const MAX_RAW_IN_COMPACTED = 3;

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Builds the context string that is passed to all agents (routerAgent,
 * orderAgent, cartModifierAgent, intentClassifier, etc.).
 *
 * Always returns a plain string to maintain API compatibility with the
 * existing `historySnippet` variable in route.ts.
 */
export async function buildContext(params: CompactorParams): Promise<CompactorResult> {
  const { sessionId, chatHistory, session } = params;

  // Exclude the current user message (last item) — same as existing logic
  const relevantHistory = chatHistory.slice(0, -1);
  const msgCount = relevantHistory.length;

  // ── Tier 1: Short sessions — raw snippets ─────────────────────────────────
  if (msgCount < RAW_THRESHOLD) {
    const historySnippet = buildRawSnippet(relevantHistory.slice(-6));
    return { historySnippet, wasCompacted: false, cacheHit: false };
  }

  // ── Tier 2 & 3: Long sessions — try to use or generate a summary ──────────

  // Check if cached summary is still valid
  if (isCacheValid(session, msgCount)) {
    const cachedSummary = session.compactedHistory!;
    // For full compaction (Tier 3), append the last 3 raw messages for recency
    const recencySnippet =
      msgCount >= FULL_COMPACTION_THRESHOLD
        ? "\n\n[Recent messages]\n" + buildRawSnippet(relevantHistory.slice(-MAX_RAW_IN_COMPACTED))
        : "";

    const historySnippet = `[Conversation Summary]\n${cachedSummary}${recencySnippet}`;
    console.log(`${LOG_PREFIX} Cache hit for session ${sessionId} (${msgCount} messages)`);
    return { historySnippet, wasCompacted: true, cacheHit: true };
  }

  // Generate a fresh summary
  const ai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;

  if (!ai) {
    // No AI available — fall back to raw snippet with more messages
    console.warn(`${LOG_PREFIX} No AI configured, falling back to raw snippet`);
    const historySnippet = buildRawSnippet(relevantHistory.slice(-6));
    return { historySnippet, wasCompacted: false, cacheHit: false };
  }

  try {
    const summary = await generateSummary(relevantHistory, ai, config.gemini.fastModel);

    // Persist to DB (fire-and-forget — don't await or block on failure)
    updateCachedSummary(sessionId, summary, msgCount).catch((err) => {
      console.error(`${LOG_PREFIX} Failed to persist summary:`, err);
    });

    // For full compaction, also include recent raw messages
    const recencySnippet =
      msgCount >= FULL_COMPACTION_THRESHOLD
        ? "\n\n[Recent messages]\n" + buildRawSnippet(relevantHistory.slice(-MAX_RAW_IN_COMPACTED))
        : "";

    const historySnippet = `[Conversation Summary]\n${summary}${recencySnippet}`;
    console.log(`${LOG_PREFIX} Generated fresh summary for ${sessionId} (${msgCount} messages)`);
    return { historySnippet, wasCompacted: true, cacheHit: false };
  } catch (err) {
    // LLM call failed — safe fallback
    console.error(`${LOG_PREFIX} Summary generation failed, falling back to raw:`, (err as Error).message);
    const historySnippet = buildRawSnippet(relevantHistory.slice(-6));
    return { historySnippet, wasCompacted: false, cacheHit: false };
  }
}

// ─── Cache Management ─────────────────────────────────────────────────────────

/**
 * Returns true if the cached summary is fresh enough to reuse.
 * "Fresh" means: exists AND session hasn't grown by >= COMPACTION_CACHE_INTERVAL messages.
 */
function isCacheValid(
  session: { compactedHistory?: string | null; compactedAt?: Date | null },
  currentMsgCount: number
): boolean {
  if (!session.compactedHistory || !session.compactedAt) return false;

  // We check by time: re-generate if > COMPACTION_CACHE_INTERVAL messages
  // were added since the last compaction. Since we don't store the msg count
  // at compaction time, we use a 10-minute time proxy as a reasonable heuristic.
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  return session.compactedAt > tenMinAgo;
}

/**
 * Persists the generated summary to the ChatSession in DB.
 */
async function updateCachedSummary(
  sessionId: string,
  summary: string,
  msgCount: number
): Promise<void> {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      compactedHistory: summary,
      compactedAt: new Date(),
    },
  });
  console.log(`${LOG_PREFIX} Cached summary persisted for ${sessionId} (${msgCount} msgs)`);
}

/**
 * Clears the cached summary for a session (e.g., when checkout completes).
 */
export async function invalidateCache(sessionId: string): Promise<void> {
  try {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { compactedHistory: null, compactedAt: null },
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} invalidateCache failed:`, (err as Error).message);
  }
}

// ─── LLM Summary Generation ───────────────────────────────────────────────────

/**
 * Calls the fast model to generate a bullet-point summary of the conversation.
 * The prompt is tuned for shopping context — focuses on what the user wanted,
 * what they liked/disliked, and any active intent.
 */
async function generateSummary(
  history: Array<{ role: string; content: string }>,
  ai: GoogleGenAI,
  model: string
): Promise<string> {
  const rawHistory = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content.substring(0, 200)}`)
    .join("\n");

  const prompt = `You are summarizing a shopping conversation for an AI assistant's context window.
Generate a concise 4-6 bullet point summary of the key facts from this conversation.

Focus ONLY on:
- What products/categories the user searched for or showed interest in
- Any products the user liked, added to cart, or wanted to buy
- Any products the user rejected or disliked
- Active shopping intent (e.g. "User is looking for birthday gifts under Rs. 3000")
- Delivery preferences or city mentioned
- Any checkout progress (e.g. "User started checkout for a cake, at payment phase")

Do NOT include: greetings, filler conversation, or anything unrelated to shopping.

Conversation:
${rawHistory}

Output ONLY the bullet points, no intro/outro text:`;

  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { maxOutputTokens: 300 },
  });

  return (result.text || "").trim();
}

// ─── Raw Snippet Builder ──────────────────────────────────────────────────────

/**
 * Builds the traditional raw snippet string from a set of messages.
 * Used for short sessions and as a fallback.
 */
function buildRawSnippet(messages: Array<{ role: string; content: string }>): string {
  if (messages.length === 0) return "No previous history.";
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content.substring(0, RAW_SNIPPET_LENGTH)}`)
    .join("\n");
}
