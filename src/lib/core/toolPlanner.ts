/**
 * toolPlanner.ts
 * ---------------------------------------------------------------------------
 * Phase 3 — Tool Planner
 *
 * Executes a ToolExecutionPlan produced by the Decision Engine.
 *
 * Key behaviors:
 *   - Tools with no `dependsOn` run in PARALLEL (Promise.allSettled)
 *   - Tools with `dependsOn` run AFTER their dependency completes
 *   - Emits `tool_call` and `tool_result` SSE events for each tool
 *   - On empty search results, triggers the Decision Engine's fallback strategy
 *   - Collects all results into a ToolResults object for the response generator
 * ---------------------------------------------------------------------------
 */

import {
  pillar1_searchProducts,
  pillar1_getProductDetails,
  pillar2_checkDelivery,
  pillar2_trackOrder,
  pillar5_searchServiceProviders,
  pillar5_detectServiceCategory,
  pillar6_browseCategory,
  type KaprukaProduct,
} from "@/lib/tools";
import { getCachedCategories } from "@/lib/mcpClient";
import type { GoogleGenAI } from "@google/genai";
import type { CheckoutState } from "@/lib/checkoutContext";
import { evaluateSearchResults } from "./decision";
import type {
  PlannedTool,
  ToolExecutionPlan,
  ToolResult,
  ToolResults,
  SseSender,
} from "./types";

// ── Execution Context ────────────────────────────────────────────────────────

/**
 * Runtime context passed into executePlan so tools can access shared resources
 * without global state.
 */
export interface ExecutionContext {
  ai: GoogleGenAI | null;
  fastModel: string;
  checkoutState: CheckoutState | null;
  userId?: string;
  sessionId: string;
  currency?: string;
  country?: string;
  /** The user's original message (for validate_relevance) */
  userMessage: string;
}

// ── Tool Dispatch ────────────────────────────────────────────────────────────

/**
 * Execute a single planned tool and return a ToolResult.
 * All tool logic lives here — the planner is the only caller.
 */
async function dispatchTool(
  tool: PlannedTool,
  ctx: ExecutionContext,
  priorResults: Map<string, ToolResult>
): Promise<ToolResult> {
  const startMs = Date.now();

  const makeResult = (
    status: ToolResult["status"],
    data: unknown,
    error?: string
  ): ToolResult => ({
    toolId: tool.id,
    toolName: tool.name,
    status,
    data,
    error,
    executionMs: Date.now() - startMs,
  });

  try {
    switch (tool.name) {
      case "search_products": {
        const { query, options = {} } = tool.args as {
          query: string;
          options?: { maxPriceLKR?: number; currency?: string };
        };
        const products = await pillar1_searchProducts(query, {
          maxPriceLKR: options.maxPriceLKR,
          currency: options.currency ?? ctx.currency,
        });
        return makeResult(products.length > 0 ? "success" : "empty", products);
      }

      case "get_product": {
        const { productId } = tool.args as { productId: string };
        const product = await pillar1_getProductDetails(productId);
        return makeResult(product ? "success" : "empty", product);
      }

      case "check_delivery": {
        const { city, date, productId } = tool.args as {
          city: string;
          date: string;
          productId: string;
        };
        const result = await pillar2_checkDelivery(city, date, productId);
        return makeResult(result ? "success" : "empty", result);
      }

      case "track_order": {
        const { orderId } = tool.args as { orderId: string };
        const result = await pillar2_trackOrder(orderId);
        return makeResult(result ? "success" : "empty", result);
      }

      case "search_services": {
        const { category, city } = tool.args as {
          category: string;
          city?: string;
        };
        const serviceCategory = pillar5_detectServiceCategory(category);
        const result = await pillar5_searchServiceProviders(serviceCategory, city);
        return makeResult("success", result);
      }

      case "browse_category": {
        const { url, name } = tool.args as { url: string; name: string };
        const products = await pillar6_browseCategory(url, name, {
          currency: ctx.currency,
          country: ctx.country,
        });
        return makeResult(products.length > 0 ? "success" : "empty", products);
      }

      case "list_categories": {
        const categories = await getCachedCategories();
        return makeResult(categories.length > 0 ? "success" : "empty", categories);
      }

      case "validate_relevance": {
        // validate_relevance injects results from a prior search tool
        if (!ctx.ai) {
          // No AI available — return source tool's data as-is
          const { sourceToolId } = tool.args as { sourceToolId: string };
          const sourceResult = priorResults.get(sourceToolId);
          return makeResult("success", sourceResult?.data ?? []);
        }

        const { query, sourceToolId } = tool.args as {
          query: string;
          sourceToolId: string;
        };
        const sourceResult = priorResults.get(sourceToolId);
        const products = (sourceResult?.data ?? []) as KaprukaProduct[];

        if (products.length === 0) {
          return makeResult("empty", []);
        }

        // Dynamic import to avoid circular dep — searchHelpers is created in Phase 1
        try {
          const { llmValidateRelevance } = await import("./searchHelpers");
          const validated = await llmValidateRelevance(
            products,
            query,
            ctx.ai,
            ctx.fastModel
          );
          return makeResult(
            validated.length > 0 ? "success" : "empty",
            validated
          );
        } catch {
          // searchHelpers not yet available (Phase 1 not done) — pass through
          return makeResult("success", products);
        }
      }

      default:
        return makeResult("error", null, `Unknown tool: ${tool.name}`);
    }
  } catch (err) {
    return makeResult("error", null, (err as Error).message);
  }
}

import { getMCPServerCapabilities } from "@/lib/mcpClient";

// ── Plan Executor ────────────────────────────────────────────────────────────

/**
 * Execute a ToolExecutionPlan produced by the Decision Engine.
 *
 * Algorithm:
 *   1. If clarificationNeeded → stream the question, return empty results
 *   2. Group tools by dependency level (DAG topological order)
 *   3. For each level: run all tools in parallel (Promise.allSettled)
 *   4. Emit tool_call / tool_result SSE events around each call
 *   5. For search tools: evaluate results and retry once if insufficient
 *   6. Return all ToolResults
 *
 * @param plan  - The plan to execute
 * @param send  - SSE emitter (emits tool_call / tool_result events)
 * @param ctx   - Runtime execution context
 */
export async function executePlan(
  plan: ToolExecutionPlan,
  send: SseSender,
  ctx: ExecutionContext
): Promise<ToolResults> {
  const globalStart = Date.now();

  // Phase 4.3: Cross-validate MCP capabilities
  try {
    const capabilities = await getMCPServerCapabilities();
    const serverToolNames = new Set(capabilities.map(c => c.name));
    
    // Dynamic import to avoid circular dep
    const { TOOL_REGISTRY } = await import("@/lib/tools");
    for (const t of plan.tools) {
       const def = TOOL_REGISTRY[t.name];
       if (def?.mcpToolName && !serverToolNames.has(def.mcpToolName)) {
         console.warn(`[ToolPlanner] Warning: Plan requires ${def.mcpToolName} but it is not advertised by the MCP server.`);
       }
    }
  } catch (err) {
    console.warn("[ToolPlanner] MCP capabilities check failed", err);
  }

  // ── Handle clarification ─────────────────────────────────────────────────
  if (plan.clarificationNeeded) {
    // Stream clarification as regular text
    const words = plan.clarificationNeeded.split(" ");
    for (let i = 0; i < words.length; i++) {
      send({
        type: "text",
        content: words[i] + (i < words.length - 1 ? " " : ""),
      });
      await new Promise((r) => setTimeout(r, 22));
    }

    return {
      results: [],
      totalMs: Date.now() - globalStart,
      clarificationAsked: true,
    };
  }

  if (plan.tools.length === 0) {
    return {
      results: [],
      totalMs: 0,
      clarificationAsked: false,
    };
  }

  // ── Build dependency levels ──────────────────────────────────────────────
  // Level 0 = no dependsOn, Level 1 = depends on level 0, etc.
  type Level = PlannedTool[];
  const levels: Level[] = [];
  const toolById = new Map<string, PlannedTool>(
    plan.tools.map((t) => [t.id, t])
  );

  const getLevel = (tool: PlannedTool): number => {
    if (!tool.dependsOn) return 0;
    const parent = toolById.get(tool.dependsOn);
    return parent ? getLevel(parent) + 1 : 0;
  };

  for (const tool of plan.tools) {
    const lvl = getLevel(tool);
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(tool);
  }

  // ── Execute level by level ───────────────────────────────────────────────
  const allResults: ToolResult[] = [];
  const resultMap = new Map<string, ToolResult>();

  for (const levelTools of levels) {
    // Emit tool_call events for all tools in this level
    for (const tool of levelTools) {
      send({
        type: "tool_call",
        toolName: tool.name,
        toolId: tool.id,
        args: tool.args,
      });
    }

    // Run all tools in this level in parallel
    const settled = await Promise.allSettled(
      levelTools.map((tool) => dispatchTool(tool, ctx, resultMap))
    );

    for (let i = 0; i < settled.length; i++) {
      const tool = levelTools[i];
      const outcome = settled[i];

      let result: ToolResult;
      if (outcome.status === "fulfilled") {
        result = outcome.value;
      } else {
        result = {
          toolId: tool.id,
          toolName: tool.name,
          status: "error",
          data: null,
          error: outcome.reason?.message ?? "Unknown error",
          executionMs: 0,
        };
      }

      allResults.push(result);
      resultMap.set(result.toolId, result);

      // Emit tool_result event
      send({
        type: "tool_result",
        toolId: result.toolId,
        toolName: result.toolName,
        status: result.status,
        executionMs: result.executionMs,
        resultSummary:
          result.status === "error"
            ? result.error
            : Array.isArray(result.data)
            ? `${(result.data as unknown[]).length} items`
            : result.data != null
            ? "success"
            : "empty",
      });
    }
  }

  // ── Search fallback (retry once if results insufficient) ─────────────────
  if (plan.searchFallbackStrategy && plan.searchFallbackStrategy !== "give_up") {
    // Gather all product results from search tools
    const searchResults = allResults
      .filter((r) => r.toolName === "search_products" || r.toolName === "validate_relevance")
      .flatMap((r) => (Array.isArray(r.data) ? (r.data as KaprukaProduct[]) : []));

    const evaluation = evaluateSearchResults(searchResults, plan, 1);

    if (evaluation === "retry_broader" || evaluation === "retry_rephrase") {
      console.log(`[ToolPlanner] Search insufficient (${searchResults.length} results). Retrying with strategy: ${evaluation}`);

      // Build a simplified retry plan
      const retryTools = plan.tools
        .filter((t) => t.name === "search_products")
        .map((t): PlannedTool => {
          const retryArgs = { ...t.args } as {
            query: string;
            options?: { maxPriceLKR?: number };
          };
          if (evaluation === "retry_rephrase") {
            // Remove price filter and simplify query
            retryArgs.options = {};
          } else if (evaluation === "retry_broader") {
            // Keep query but remove price filter
            retryArgs.options = {
              ...((retryArgs.options as { maxPriceLKR?: number }) ?? {}),
              maxPriceLKR: undefined,
            };
          }
          return { ...t, id: t.id + "_retry", args: retryArgs };
        });

      if (retryTools.length > 0) {
        send({
          type: "thought",
          step: "search_retry",
          status: "running",
          content: `Broadening search (${evaluation})...`,
        });

        const retrySettled = await Promise.allSettled(
          retryTools.map((tool) => dispatchTool(tool, ctx, resultMap))
        );

        for (let i = 0; i < retrySettled.length; i++) {
          const outcome = retrySettled[i];
          if (outcome.status === "fulfilled") {
            const result = outcome.value;
            allResults.push(result);
            resultMap.set(result.toolId, result);
          }
        }
      }
    }
  }

  return {
    results: allResults,
    totalMs: Date.now() - globalStart,
    clarificationAsked: false,
  };
}

// ── Convenience Helpers ──────────────────────────────────────────────────────

/**
 * Extract all KaprukaProduct arrays from ToolResults.
 * Merges results from all search/validate tools, deduped by id.
 */
export function extractProductsFromResults(results: ToolResults): KaprukaProduct[] {
  const seen = new Set<string>();
  const products: KaprukaProduct[] = [];

  for (const result of results.results) {
    if (result.status !== "success") continue;
    if (!Array.isArray(result.data)) continue;

    for (const item of result.data as KaprukaProduct[]) {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id);
        products.push(item);
      }
    }
  }

  return products;
}

/**
 * Get the result for a specific tool by name (first match).
 */
export function getToolResult(results: ToolResults, toolName: string): ToolResult | undefined {
  return results.results.find((r) => r.toolName === toolName);
}
