/**
 * thoughtProcess.ts
 * ---------------------------------------------------------------------------
 * Phase 0 — Type Safety
 *
 * Provides a strongly-typed interface for the `thoughtProcess` JSON column
 * stored on every `ChatMessage`. Previously this was written and read as
 * `any` throughout `route.ts`, making it impossible to catch shape errors
 * at compile time and very fragile to refactor.
 *
 * All code that writes to or reads from `ChatMessage.thoughtProcess` must
 * use `serializeThoughtProcess` and `parseThoughtProcess` respectively.
 * ---------------------------------------------------------------------------
 */

import type { KaprukaTrackingResult } from "@/lib/mcpClient";
import type { CheckoutState } from "@/lib/checkoutContext";

// ── ThoughtProcess Step ────────────────────────────────────────────────────

export type ThoughtStep = {
  step: string;             // e.g. "intent_classifier", "router_agent", "order_agent"
  status: "running" | "completed" | "failed";
  content?: string;         // human-readable summary of what happened
  durationMs?: number;
};

// ── Core ThoughtProcess Interface ──────────────────────────────────────────

/**
 * The structured object persisted in `ChatMessage.thoughtProcess`.
 * This is the SINGLE source of truth for what an assistant message "thought"
 * — used for SSE replay (re-rendering chat on refresh), rollback on message
 * edit, and observability.
 */
export interface ThoughtProcess {
  /** Ordered list of agent/tool steps that ran for this turn. */
  steps: ThoughtStep[];

  /** The classified intent for this turn. */
  intent: string;

  /** LLM-generated follow-up question suggestions (max 3). */
  followUpQuestions?: string[];

  /** URLs returned by Gemini Google Search grounding (qa intent). */
  groundingSources?: string[];

  /**
   * Snapshot of the checkout state AFTER this turn completed.
   * Used by the rollback logic when the user edits a prior message:
   * the last assistant message's `orderFlowStep` is re-applied to
   * restore the `CheckoutSession` to a consistent prior state.
   */
  orderFlowStep?: CheckoutState & {
    /** Legacy compat: confirmedQty was previously called confirmedQuantity. */
    confirmedQuantity?: number;
    /** Delivery check result nested (legacy shape). */
    deliveryCheckResult?: { flatRateLKR?: number };
  };

  /** Live tracking result fetched during a delivery/track intent. */
  trackingResult?: KaprukaTrackingResult;
}

// ── Serialization ──────────────────────────────────────────────────────────

/**
 * Serialize a `ThoughtProcess` into a plain object safe to store in Prisma
 * as `Json`. Using this instead of `JSON.stringify` so callers don't need
 * to handle string encoding themselves.
 */
export function serializeThoughtProcess(
  tp: ThoughtProcess
): Record<string, unknown> {
  return tp as unknown as Record<string, unknown>;
}

// ── Parsing ────────────────────────────────────────────────────────────────

/**
 * Safely parse an unknown value (from Prisma `Json?`) into a `ThoughtProcess`.
 * Returns `null` if the value is missing, not an object, or fails validation.
 *
 * This replaces patterns like:
 *   `const parsed = typeof raw === "string" ? JSON.parse(raw) : raw`
 *   `const orderFlowStep = (parsed as any)?.orderFlowStep`
 */
export function parseThoughtProcess(raw: unknown): ThoughtProcess | null {
  if (!raw) return null;

  let obj: Record<string, unknown>;

  // Prisma can store JSON as a string (rare) or as a parsed object
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      obj = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else {
    return null;
  }

  // Build a validated ThoughtProcess — be permissive about missing fields
  // since old DB rows may not have all fields
  const tp: ThoughtProcess = {
    steps: Array.isArray(obj.steps) ? (obj.steps as ThoughtStep[]) : [],
    intent: typeof obj.intent === "string" ? obj.intent : "product",
  };

  if (Array.isArray(obj.followUpQuestions)) {
    tp.followUpQuestions = obj.followUpQuestions as string[];
  }
  if (Array.isArray(obj.groundingSources)) {
    tp.groundingSources = obj.groundingSources as string[];
  }
  if (obj.orderFlowStep && typeof obj.orderFlowStep === "object") {
    tp.orderFlowStep = obj.orderFlowStep as ThoughtProcess["orderFlowStep"];
  }
  if (obj.trackingResult && typeof obj.trackingResult === "object") {
    tp.trackingResult = obj.trackingResult as KaprukaTrackingResult;
  }

  return tp;
}

// ── Convenience Builders ───────────────────────────────────────────────────

/**
 * Build a minimal `ThoughtProcess` for a checkout / order flow turn.
 * The `orderFlowStep` field is what the rollback mechanism reads to restore
 * the `CheckoutSession` when the user edits a past message.
 */
export function buildOrderFlowThoughtProcess(
  phase: string,
  orderFlowStep: ThoughtProcess["orderFlowStep"]
): ThoughtProcess {
  return {
    steps: [
      {
        step: "order_agent",
        status: "completed",
        content: `Phase: ${phase}`,
        durationMs: 0,
      },
    ],
    intent: "product",
    orderFlowStep,
  };
}

/**
 * Build a `ThoughtProcess` for a standard shop/search/qa turn.
 */
export function buildShopThoughtProcess(params: {
  intent: string;
  steps: ThoughtStep[];
  followUpQuestions?: string[];
  groundingSources?: string[];
  trackingResult?: KaprukaTrackingResult;
}): ThoughtProcess {
  return {
    steps: params.steps,
    intent: params.intent,
    followUpQuestions: params.followUpQuestions,
    groundingSources: params.groundingSources,
    trackingResult: params.trackingResult,
  };
}
