/**
 * Harness Types
 *
 * Shared TypeScript interfaces for all harness engineering modules.
 * These types are used by: sessionInitializer, contextCompactor,
 * searchEvaluatorAgent, responseEvaluatorAgent, checkoutContracts,
 * and harnessLogger.
 *
 * @see src/lib/harness/README.md for architecture overview
 */

import type { CheckoutPhase } from "@/lib/checkoutContext";

// ─── Evaluator Types ─────────────────────────────────────────────────────────

/** Union of all harness evaluator component names */
export type EvaluatorType =
  | "search_evaluator"
  | "response_evaluator"
  | "checkout_contract";

// ─── Harness Logger ──────────────────────────────────────────────────────────

/** Entry written to HarnessEvalLog in DB after every evaluator run */
export interface HarnessEvalEntry {
  sessionId: string;
  messageId: string;
  evaluatorType: EvaluatorType;
  score: number;           // 0.0–10.0 weighted score
  passed: boolean;         // true if score >= threshold
  feedback?: string;       // evaluator's critique text (used for regeneration)
  regenerated: boolean;    // did this evaluation trigger a regeneration?
  latencyMs: number;       // wall-clock time this evaluator took
  context?: Record<string, unknown>; // extra context (phase, query, intent)
}

// ─── Session Initializer ─────────────────────────────────────────────────────

/** User profile context derived from DB history */
export interface UserProfile {
  savedAddressCount: number;
  preferredCity: string | null;
  pastOrderCategories: string[]; // e.g. ["cakes", "flowers", "electronics"]
  isRepeatCustomer: boolean;
}

/** Structured session context document — generated once per session */
export interface SessionContext {
  /** LLM-inferred goal from user's first message + history */
  sessionGoal: string;

  /** Static profile data loaded from DB */
  userProfile: UserProfile;

  /** Last known state for session resume awareness */
  lastKnownState: {
    phase: string | null;          // active checkout phase if any
    cartSummary: string;           // human-readable cart summary
    unresolvedIntents: string[];   // things user mentioned but didn't complete
  };

  /** ISO timestamp of when this context was generated */
  sessionTimestamp: string;

  /**
   * Only present when user resumes after a 30+ min gap.
   * A warm "welcome back" message that references the last known state.
   */
  resumeMessage?: string;
}

// ─── Context Compactor ───────────────────────────────────────────────────────

/** Input for the context compactor */
export interface CompactorParams {
  sessionId: string;
  chatHistory: Array<{ role: string; content: string; createdAt: Date }>;
  session: {
    compactedHistory?: string | null;
    compactedAt?: Date | null;
  };
}

/** Output from the context compactor — always a plain string snippet for agents */
export interface CompactorResult {
  historySnippet: string;
  wasCompacted: boolean;   // true if LLM was used to generate summary
  cacheHit: boolean;       // true if existing cached summary was reused
}

// ─── Search Evaluator ────────────────────────────────────────────────────────

/** Per-criterion scores for the search evaluator */
export interface SearchCriteriaScores {
  queryMatch: number;           // 0-10: Do results match the user's actual intent?
  diversity: number;            // 0-10: Variety of options?
  priceAppropriateness: number; // 0-10: In range with user's expectations/budget?
  completeness: number;         // 0-10: Enough results to make a decision?
}

/** Full output from searchEvaluatorAgent */
export interface SearchEvaluation {
  overallScore: number;                   // Weighted average: 0.0–10.0
  shouldRegenerate: boolean;              // true if overallScore < SEARCH_EVAL_THRESHOLD
  feedback: string;                       // Evaluator's critique for the generator
  suggestedQueryRefinements: string[];    // 1-3 improved search terms to try
  criteriaScores: SearchCriteriaScores;
  passedCriteria: string[];
  failedCriteria: string[];
}

// ─── Response Evaluator ──────────────────────────────────────────────────────

/** Per-criterion scores for the response evaluator */
export interface ResponseCriteriaScores {
  factualSafety: number;  // 0-10: No wrong claims about prices, policies, dates
  tone: number;           // 0-10: Warm, friendly, consistent with "Buddy" persona
  actionability: number;  // 0-10: Clear next step for the user
  scope: number;          // 0-10: Right length — not bloated or truncated
}

/** Action the response evaluator decides to take */
export type ResponseEvalAction = "stream_as_is" | "append_note" | "regenerate";

/** Full output from responseEvaluatorAgent */
export interface ResponseEvaluation {
  overallScore: number;                   // Weighted average: 0.0–10.0
  action: ResponseEvalAction;
  correctionNote?: string;                // Soft note appended if action === "append_note"
  feedback?: string;                      // Critique for regeneration if action === "regenerate"
  criteriaScores: ResponseCriteriaScores;
}

// ─── Checkout Contracts ──────────────────────────────────────────────────────

/** Pre-negotiated definition-of-done for each checkout phase */
export interface CheckoutPhaseContract {
  /** The checkout phase this contract governs */
  phase: CheckoutPhase;

  /** What the system asked the user in this phase (plain text) */
  systemAsk: string;

  /**
   * What a valid user response looks like.
   * The validator checks these against the user's message.
   */
  acceptanceCriteria: string[];

  /**
   * Words/phrases that signal the user is NOT confirming.
   * The validator uses these to detect hesitation or change-of-mind.
   */
  failureSignals: string[];

  /**
   * Max times to re-ask before fail-open (proceeding anyway).
   * Prevents blocking legitimate users who express themselves differently.
   */
  maxRetries: number;
}

/** Result from the checkout contract validator */
export interface ContractValidationResult {
  satisfied: boolean;       // true = advance phase, false = stay and re-ask
  reason: string;           // brief explanation from the LLM
  retryMessage?: string;    // what to say to the user on retry (generated by LLM)
}
