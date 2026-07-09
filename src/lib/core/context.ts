/**
 * context.ts
 * ---------------------------------------------------------------------------
 * Phase 2 — Context Manager
 *
 * Builds a rich, relevance-scored ContextWindow for each incoming message.
 * Replaces the naive "last 6 messages" approach in route.ts with:
 *
 *   1. Relevance-scored history — selects the most contextually relevant
 *      messages from the last 20, not just the most recent 6.
 *   2. Product memory — a sliding window of the last ~15 products shown
 *      across recent assistant turns, so the agent always knows what's
 *      "on screen".
 *   3. Conversation goal — a persistent JSON object in ChatSession.metadata
 *      that tracks the user's high-level intent across the whole session.
 * ---------------------------------------------------------------------------
 */

import { prisma } from "@/lib/db";
import type { KaprukaProduct } from "@/lib/mcpClient";

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Persistent conversation-level goal, stored in `ChatSession.metadata`.
 * Updated after each assistant turn.
 */
export interface ConversationGoal {
  /** Short description of what the user is trying to accomplish. */
  primaryIntent: string;
  /** Budget in LKR, if mentioned. */
  budget?: number;
  /** Who the item is for, if mentioned (e.g. "mother", "friend"). */
  recipient?: string;
  /** Steps already completed this session. */
  completedSteps: string[];
  /** Steps still pending. */
  pendingSteps: string[];
  /** ISO timestamp of the last update. */
  lastUpdated: string;
}

/**
 * The context window passed to all agents and the intent classifier.
 * Replaces the simple `historySnippet: string` that was previously passed around.
 */
export interface ContextWindow {
  /**
   * Relevance-scored message history formatted for LLM prompts.
   * Format: "ROLE: content (truncated)" joined by newlines.
   */
  historySnippet: string;

  /**
   * The last ~15 unique products shown in recent assistant messages.
   * Gives agents product memory without re-fetching from MCP.
   */
  productMemory: KaprukaProduct[];

  /**
   * The current conversation goal, or null if none has been inferred yet.
   */
  goal: ConversationGoal | null;

  /**
   * The raw ChatMessage objects, for agents that need full structured data.
   */
  rawMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    products: unknown;
    thoughtProcess: unknown;
  }>;
}

// ── Relevance Scoring ───────────────────────────────────────────────────────

/**
 * Compute a keyword-overlap relevance score between the current message
 * and a historical message. Higher = more relevant.
 *
 * Uses simple tokenization: split on whitespace, lowercase, filter tokens
 * >= 3 chars, and count intersection. Normalized by current message token count.
 */
function computeRelevanceScore(currentMessage: string, historicalContent: string): number {
  const tokenize = (text: string): Set<string> =>
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    );

  const currentTokens = tokenize(currentMessage);
  const historicalTokens = tokenize(historicalContent);

  if (currentTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of currentTokens) {
    if (historicalTokens.has(token)) overlap++;
  }

  return overlap / currentTokens.size;
}

// ── Product Memory Extractor ────────────────────────────────────────────────

/**
 * Scan recent assistant messages and extract up to `maxProducts` unique
 * products (deduped by id). Handles both flat arrays and product-group arrays.
 */
function extractProductMemory(
  messages: Array<{ products: unknown }>,
  maxProducts = 15
): KaprukaProduct[] {
  const seen = new Set<string>();
  const products: KaprukaProduct[] = [];

  for (const msg of messages) {
    if (!msg.products || products.length >= maxProducts) break;

    let parsed: unknown;
    try {
      parsed =
        typeof msg.products === "string"
          ? JSON.parse(msg.products)
          : msg.products;
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) continue;

    // Handle both flat product arrays and product-group arrays
    let flat: unknown[];
    if (parsed.length > 0 && typeof (parsed[0] as any)?.products !== "undefined") {
      // Product groups: [{ title, products: [...] }]
      flat = (parsed as Array<{ products: unknown[] }>).flatMap((g) => g.products ?? []);
    } else {
      flat = parsed;
    }

    for (const item of flat) {
      if (!item || typeof (item as any).id !== "string") continue;
      const p = item as KaprukaProduct;
      if (!seen.has(p.id) && products.length < maxProducts) {
        seen.add(p.id);
        products.push(p);
      }
    }
  }

  return products;
}

// ── Goal Management ─────────────────────────────────────────────────────────

/**
 * Read the current ConversationGoal from `ChatSession.metadata`.
 * Returns null if no goal has been set yet.
 */
export async function getConversationGoal(
  sessionId: string
): Promise<ConversationGoal | null> {
  try {
    const session = await (prisma.chatSession as any).findUnique({
      where: { id: sessionId },
      select: { metadata: true },
    });

    if (!session?.metadata) return null;

    const raw =
      typeof session.metadata === "string"
        ? JSON.parse(session.metadata)
        : session.metadata;

    if (!raw || typeof raw !== "object" || !raw.goal) return null;
    return raw.goal as ConversationGoal;
  } catch {
    return null;
  }
}

/**
 * Persist an updated ConversationGoal into `ChatSession.metadata`.
 * Merges with any existing metadata (non-destructive).
 */
export async function updateConversationGoal(
  sessionId: string,
  update: Partial<ConversationGoal>
): Promise<void> {
  try {
    const existing = await getConversationGoal(sessionId);

    const merged: ConversationGoal = {
      primaryIntent: update.primaryIntent ?? existing?.primaryIntent ?? "",
      budget: update.budget ?? existing?.budget,
      recipient: update.recipient ?? existing?.recipient,
      completedSteps: [
        ...(existing?.completedSteps ?? []),
        ...(update.completedSteps ?? []),
      ].slice(-10), // Keep last 10 to prevent unbounded growth
      pendingSteps: update.pendingSteps ?? existing?.pendingSteps ?? [],
      lastUpdated: new Date().toISOString(),
    };

    // Read full metadata and merge goal in
    const session = await (prisma.chatSession as any).findUnique({
      where: { id: sessionId },
      select: { metadata: true },
    });
    const currentMeta =
      session?.metadata && typeof session.metadata === "object"
        ? (session.metadata as Record<string, unknown>)
        : {};

    await (prisma.chatSession as any).update({
      where: { id: sessionId },
      data: {
        metadata: { ...currentMeta, goal: merged },
      },
    });
  } catch (err) {
    // Non-fatal — goal tracking is best-effort
    console.warn("[Context] Failed to update conversation goal:", err);
  }
}

// ── Main Context Builder ────────────────────────────────────────────────────

/**
 * Build a rich ContextWindow for the current turn.
 *
 * @param sessionId       - The chat session ID (used to fetch goal from DB)
 * @param currentMessage  - The user's current message (used for relevance scoring)
 * @param historyMessages - All messages for the session (ordered oldest → newest)
 */
export async function buildContextWindow(
  sessionId: string,
  currentMessage: string,
  historyMessages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    products: unknown;
    thoughtProcess: unknown;
  }>
): Promise<ContextWindow> {
  // Exclude the most recent user message (the current one being processed)
  const priorMessages = historyMessages.slice(0, -1);

  // ── 1. Relevance-scored history ──────────────────────────────────────────
  // Take the last 20 messages and score each against the current message.
  // Select the top 8 most relevant (instead of the last 6 regardless of relevance).
  const HISTORY_POOL = 20;
  const HISTORY_SELECT = 8;
  const MAX_CONTENT_LENGTH = 200;

  const pool = priorMessages.slice(-HISTORY_POOL);

  const scored = pool.map((msg) => ({
    msg,
    score: computeRelevanceScore(currentMessage, msg.content),
  }));

  // Sort by score desc, then take top N, then re-sort by original chronological order
  const topMessages = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, HISTORY_SELECT)
    .sort(
      (a, b) =>
        new Date(a.msg.createdAt).getTime() - new Date(b.msg.createdAt).getTime()
    )
    .map(({ msg }) => msg);

  const historySnippet = topMessages
    .map(
      (m) =>
        `${m.role.toUpperCase()}: ${m.content.substring(0, MAX_CONTENT_LENGTH)}`
    )
    .join("\n");

  // ── 2. Product memory ────────────────────────────────────────────────────
  // Scan the last 5 assistant messages that have products attached.
  const recentAssistantMsgs = priorMessages
    .filter((m) => m.role === "assistant" && m.products != null)
    .slice(-5);

  const productMemory = extractProductMemory(recentAssistantMsgs);

  // ── 3. Conversation goal ─────────────────────────────────────────────────
  const goal = await getConversationGoal(sessionId);

  return {
    historySnippet,
    productMemory,
    goal,
    rawMessages: priorMessages,
  };
}
