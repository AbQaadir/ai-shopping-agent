/**
 * types.ts
 * ---------------------------------------------------------------------------
 * Phase 3 — Shared types for the Decision Engine and Tool Planner layers.
 *
 * These types define the contract between:
 *   Intent Classifier → Decision Engine → Tool Planner → Commerce Tool Broker
 * ---------------------------------------------------------------------------
 */

// ── Tool Execution Plan ──────────────────────────────────────────────────────

/**
 * A single tool to execute as part of a plan.
 */
export interface PlannedTool {
  /** Unique ID for dependency tracking within this plan. */
  id: string;

  /**
   * Tool name — must match a key in the TOOL_REGISTRY (Phase 4).
   * For now, uses the pillar function names as identifiers.
   */
  name: string;

  /** Arguments to pass to the tool function. */
  args: Record<string, unknown>;

  /**
   * If set, this tool runs AFTER the tool with this id completes.
   * Tools with no dependsOn run in parallel (level 0).
   */
  dependsOn?: string;

  /**
   * If true, failure of this tool does not abort the overall plan.
   * Used for "nice to have" enrichment calls.
   */
  optional?: boolean;
}

/**
 * The complete execution plan produced by the Decision Engine.
 * Consumed by the Tool Planner to orchestrate actual tool calls.
 */
export interface ToolExecutionPlan {
  /** Ordered list of tools to execute (dependencies determine sequencing). */
  tools: PlannedTool[];

  /**
   * If set, the agent should ask the user this question BEFORE executing
   * any tools. The Tool Planner returns early with this as the response.
   */
  clarificationNeeded?: string;

  /**
   * Strategy to use if initial search returns insufficient results.
   * Only relevant for plans containing search_products tools.
   */
  searchFallbackStrategy?: "broaden" | "rephrase" | "give_up";

  /**
   * Estimated number of tool calls (for budget tracking).
   * Used by the Decision Engine to trim plans that would exceed limits.
   */
  estimatedCallCount: number;

  /** Human-readable explanation of why this plan was generated. */
  decisionReason: string;
}

// ── Tool Results ──────────────────────────────────────────────────────────────

export type ToolResultStatus = "success" | "empty" | "error";

/**
 * The result of executing a single tool.
 */
export interface ToolResult {
  /** Matches the `id` of the PlannedTool that was executed. */
  toolId: string;

  /** The tool name for logging/observability. */
  toolName: string;

  /** Whether the tool succeeded, returned empty data, or errored. */
  status: ToolResultStatus;

  /** The data returned by the tool (typed by the consuming layer). */
  data: unknown;

  /** Error message if status === "error". */
  error?: string;

  /** Actual execution time in milliseconds. */
  executionMs: number;
}

/**
 * The aggregate results of executing a ToolExecutionPlan.
 * Passed to the main LLM response generator as context.
 */
export interface ToolResults {
  /** All individual tool results. */
  results: ToolResult[];

  /** Total wall-clock time for the entire plan execution. */
  totalMs: number;

  /**
   * Whether the plan was short-circuited by a clarification question.
   * If true, results will be empty and the clarification was streamed to the user.
   */
  clarificationAsked: boolean;
}

// ── SSE Sender Type ──────────────────────────────────────────────────────────

/**
 * The function used to emit SSE events to the client.
 * Passed from route.ts into the Tool Planner.
 */
export type SseSender = (payload: Record<string, unknown>) => void;
