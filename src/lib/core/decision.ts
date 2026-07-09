/**
 * decision.ts
 * ---------------------------------------------------------------------------
 * Phase 3 — Decision Engine
 *
 * The core new intelligence layer. Sits between the Intent Classifier and
 * Tool Planner and answers three questions before any tool is called:
 *
 *   1. SUFFICIENCY: Does the agent have enough information to act, or should
 *      it ask a clarifying question first?
 *
 *   2. TOOL SELECTION: Which tools need to run, and in what order/parallel?
 *      Produces a ToolExecutionPlan.
 *
 *   3. EVIDENCE EVALUATION: After results come back, are they good enough
 *      or should we retry with a broader/rephrased query?
 *
 * This mirrors the internal loop in Claude Code: "Do I have enough context
 * to act?" → "Which MCP tools do I need?" → "Did I get good results?"
 * ---------------------------------------------------------------------------
 */

import type { Intent } from "@/lib/nlp";
import type { CheckoutState } from "@/lib/checkoutContext";
import type { RouterAction } from "@/lib/agents/routerAgent";
import type { ContextWindow } from "./context";
import type { IntentClassification } from "./intent";
import type { KaprukaProduct } from "@/lib/mcpClient";
import type { PlannedTool, ToolExecutionPlan } from "./types";

// ── Information Sufficiency Check ───────────────────────────────────────────

interface SufficiencyResult {
  sufficient: boolean;
  clarificationQuestion?: string;
}

/**
 * Determines whether the agent has enough information to proceed with tool
 * execution, or whether it should ask the user a clarifying question first.
 *
 * Rules are deterministic (no LLM call needed) — just pattern matching on
 * intent, context, and router action.
 */
function checkInformationSufficiency(
  intent: IntentClassification,
  context: ContextWindow,
  routerAction: RouterAction
): SufficiencyResult {
  // Checkout actions always have enough info — the OrderAgent handles ambiguity
  if (
    routerAction === "checkout_continue" ||
    routerAction === "checkout_cancel" ||
    routerAction === "cart_modify"
  ) {
    return { sufficient: true };
  }

  // checkout_start: need at least one product in context or explicitly selected
  if (routerAction === "checkout_start" || routerAction === "checkout_start_with_address") {
    if (context.productMemory.length === 0) {
      return {
        sufficient: false,
        clarificationQuestion:
          "Which product would you like to order? You can search for it first and then tap 'Order'.",
      };
    }
    return { sufficient: true };
  }

  // Product search: need at least one search term
  if (intent.intent === "product" && routerAction === "shop") {
    if (intent.searchTerms.length === 0) {
      return {
        sufficient: false,
        clarificationQuestion:
          "What product are you looking for? Give me a keyword and I'll search right away! 🔍",
      };
    }
    return { sufficient: true };
  }

  // Delivery: need a city or order ID somewhere
  if (intent.intent === "delivery" && routerAction === "shop") {
    // If neither a city nor an order ID is mentioned in the message,
    // and there's no prior context, ask for clarification
    // (We use a lightweight check — the actual extraction happens in route.ts)
    // Allow through — city extraction happens downstream; don't gate on it here
    return { sufficient: true };
  }

  // Service: need a service type to be detectable — handled downstream
  if (intent.intent === "service") {
    return { sufficient: true };
  }

  // Category browse: always sufficient (LLM picks best category)
  if (intent.intent === "category_browse") {
    return { sufficient: true };
  }

  // QA, order_history: always sufficient
  if (intent.intent === "qa" || intent.intent === "order_history") {
    return { sufficient: true };
  }

  // Pause/shop fallback
  if (routerAction === "checkout_pause") {
    return { sufficient: true };
  }

  return { sufficient: true };
}

import { TOOL_REGISTRY } from "@/lib/tools";

// ── Tool Selection ───────────────────────────────────────────────────────────

let _planIdCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${++_planIdCounter}`;
}

/**
 * Internal un-capped plan builder.
 */
function _buildToolExecutionPlan(
  intent: IntentClassification,
  context: ContextWindow,
  routerAction: RouterAction,
  checkoutState: CheckoutState | null
): ToolExecutionPlan {
  const tools: PlannedTool[] = [];

  // ── Product Search ────────────────────────────────────────────────────────
  if (intent.intent === "product" && (routerAction === "shop" || routerAction === "checkout_pause")) {
    // One search tool per search term (up to 3), all run in parallel
    for (const st of intent.searchTerms.slice(0, 3)) {
      const searchId = nextId("search");
      tools.push({
        id: searchId,
        name: "search_products",
        args: {
          query: st.term,
          options: {
            maxPriceLKR: st.maxPrice ?? undefined,
          },
        },
      });

      // Validate relevance after each search (sequential, depends on search)
      tools.push({
        id: nextId("validate"),
        name: "validate_relevance",
        args: {
          query: st.term,
          // products will be injected by the planner from the search result
          sourceToolId: searchId,
        },
        dependsOn: searchId,
        optional: true,
      });
    }

    return {
      tools,
      searchFallbackStrategy: "broaden",
      estimatedCallCount: intent.searchTerms.length * 2,
      decisionReason: `Product search for: ${intent.searchTerms.map((t) => t.term).join(", ")}`,
    };
  }

  // ── Category Browse ───────────────────────────────────────────────────────
  if (intent.intent === "category_browse" && routerAction === "shop") {
    const listId = nextId("list_cats");
    tools.push({
      id: listId,
      name: "list_categories",
      args: {},
    });
    // Category browse agent is invoked by route.ts after categories are fetched
    // We just plan the category list fetch here

    return {
      tools,
      estimatedCallCount: 1,
      decisionReason: "Category browse — fetching category tree",
    };
  }

  // ── Delivery Check ────────────────────────────────────────────────────────
  if (intent.intent === "delivery" && routerAction === "shop") {
    // Actual city/date/product extraction happens in route.ts downstream
    // We signal that delivery tools may be needed
    return {
      tools: [],
      estimatedCallCount: 0,
      decisionReason:
        "Delivery intent — city/order extraction happens in route dispatch",
    };
  }

  // ── Service Search ────────────────────────────────────────────────────────
  if (intent.intent === "service") {
    return {
      tools: [],
      estimatedCallCount: 0,
      decisionReason: "Service intent — category detection in route dispatch",
    };
  }

  // ── QA / Order History ────────────────────────────────────────────────────
  if (intent.intent === "qa" || intent.intent === "order_history") {
    return {
      tools: [],
      estimatedCallCount: 0,
      decisionReason: `${intent.intent} — no pre-tool phase needed`,
    };
  }

  // ── Checkout Start ────────────────────────────────────────────────────────
  if (routerAction === "checkout_start" || routerAction === "checkout_start_with_address") {
    // Fetch fresh stock details for all products in context memory (parallel)
    const cartProducts = context.productMemory.slice(0, 5);
    for (const p of cartProducts) {
      tools.push({
        id: nextId("get_product"),
        name: "get_product",
        args: { productId: p.id },
        optional: true,
      });
    }
    return {
      tools,
      estimatedCallCount: cartProducts.length,
      decisionReason: "Checkout start — validating product stock",
    };
  }

  // ── Checkout Continue / Cancel / Cart Modify ──────────────────────────────
  // These are handled entirely by their respective agents — no pre-planning needed
  if (
    routerAction === "checkout_continue" ||
    routerAction === "checkout_cancel" ||
    routerAction === "cart_modify"
  ) {
    return {
      tools: [],
      estimatedCallCount: 0,
      decisionReason: `${routerAction} — delegated to specialized agent`,
    };
  }

  // ── Default / Fallback ────────────────────────────────────────────────────
  return {
    tools: [],
    estimatedCallCount: 0,
    decisionReason: "No tool pre-planning needed for this action",
  };
}

/**
 * Build a ToolExecutionPlan from the classified intent and router action,
 * and enforce a budget cap to prevent excessive LLM/API calls.
 */
function buildToolExecutionPlan(
  intent: IntentClassification,
  context: ContextWindow,
  routerAction: RouterAction,
  checkoutState: CheckoutState | null
): ToolExecutionPlan {
  const plan = _buildToolExecutionPlan(intent, context, routerAction, checkoutState);

  // Apply Budget Cap
  let totalMs = 0;
  for (const t of plan.tools) {
    const def = TOOL_REGISTRY[t.name];
    if (def && def.estimatedMs) {
      totalMs += def.estimatedMs;
    }
  }

  // If over budget (>6 calls or >8000ms), trim optional tools
  if (plan.estimatedCallCount > 6 || totalMs > 8000) {
    const originalCount = plan.tools.length;
    plan.tools = plan.tools.filter(t => !t.optional);
    const newTotalMs = plan.tools.reduce((sum, t) => sum + (TOOL_REGISTRY[t.name]?.estimatedMs || 0), 0);
    
    plan.decisionReason += ` (Budget capped: dropped ${originalCount - plan.tools.length} optional tools, est. time ${newTotalMs}ms)`;
    plan.estimatedCallCount = plan.tools.length;
  }

  return plan;
}

// ── Evidence Sufficiency ─────────────────────────────────────────────────────

export type SearchEvaluation =
  | "sufficient"
  | "retry_broader"
  | "retry_rephrase"
  | "give_up";

/**
 * Evaluate whether search results are good enough or need a retry.
 * Called by the Tool Planner after initial search results come back.
 *
 * @param results - Products returned from search
 * @param plan    - The plan that was executed
 * @param attempt - Which attempt this is (1-indexed)
 */
export function evaluateSearchResults(
  results: KaprukaProduct[],
  plan: ToolExecutionPlan,
  attempt: number
): SearchEvaluation {
  if (results.length >= 3) {
    return "sufficient";
  }

  if (attempt >= 2) {
    // Give up after 2 attempts regardless
    return "give_up";
  }

  if (results.length === 0) {
    // No results at all — try rephrasing (remove price filter, simplify)
    return "retry_rephrase";
  }

  // 1–2 results — try broadening (don't filter by price, add synonyms)
  return "retry_broader";
}

// ── Main Decision API ────────────────────────────────────────────────────────

/**
 * The main entry point for the Decision Engine.
 *
 * Given the classified intent and routing decision, determines:
 * 1. Whether to ask a clarifying question (clarificationNeeded)
 * 2. Which tools to run and in what order (tools array)
 *
 * @param intent        - Output of the Intent Classifier
 * @param context       - Built by the Context Manager
 * @param routerAction  - Output of the Router Agent
 * @param checkoutState - Current checkout state (if any)
 */
export async function makeDecision(
  intent: IntentClassification,
  context: ContextWindow,
  routerAction: RouterAction,
  checkoutState: CheckoutState | null
): Promise<ToolExecutionPlan> {
  // Step 1: Check if we have enough information to act
  const sufficiency = checkInformationSufficiency(intent, context, routerAction);

  if (!sufficiency.sufficient) {
    return {
      tools: [],
      clarificationNeeded: sufficiency.clarificationQuestion,
      estimatedCallCount: 0,
      decisionReason: "Insufficient information — asking clarifying question",
    };
  }

  // Step 2: Build the tool execution plan
  const plan = buildToolExecutionPlan(intent, context, routerAction, checkoutState);

  // Step 3: Budget cap — trim optional tools if plan is too expensive
  const MAX_TOOL_CALLS = 6;
  if (plan.estimatedCallCount > MAX_TOOL_CALLS) {
    const trimmed = plan.tools.filter((t) => !t.optional);
    console.warn(
      `[Decision] Plan trimmed: ${plan.tools.length} → ${trimmed.length} tools (budget cap: ${MAX_TOOL_CALLS})`
    );
    return {
      ...plan,
      tools: trimmed,
      estimatedCallCount: trimmed.length,
      decisionReason: plan.decisionReason + " (budget-trimmed)",
    };
  }

  return plan;
}
