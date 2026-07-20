/**
 * Harness Logger
 *
 * Records every generator-evaluator decision to the HarnessEvalLog table
 * for observability, prompt tuning, and latency analysis.
 *
 * DESIGN PRINCIPLE: Logger failures NEVER crash the main request.
 * All DB writes are fire-and-forget — errors are caught and logged to console.
 *
 * Usage:
 *   import { logEval, getEvalStats } from "@/lib/harness/harnessLogger";
 *   await logEval({ sessionId, messageId, evaluatorType: "search_evaluator", ... });
 */

import { prisma } from "@/lib/db";
import type { HarnessEvalEntry, EvaluatorType } from "@/lib/harness/types";

const LOG_PREFIX = "[Harness:Logger]";

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Writes a single evaluator result to HarnessEvalLog in the DB.
 * Fails silently — a logging failure must never break the user's request.
 */
export async function logEval(entry: HarnessEvalEntry): Promise<void> {
  try {
    await (prisma as any).harnessEvalLog.create({
      data: {
        sessionId: entry.sessionId,
        messageId: entry.messageId,
        evaluatorType: entry.evaluatorType,
        score: entry.score,
        passed: entry.passed,
        feedback: entry.feedback ?? null,
        regenerated: entry.regenerated,
        latencyMs: entry.latencyMs,
        context: entry.context ?? null,
      },
    });

    console.log(
      `${LOG_PREFIX} [${entry.evaluatorType}] score=${entry.score.toFixed(1)} passed=${entry.passed} regen=${entry.regenerated} latency=${entry.latencyMs}ms`
    );
  } catch (err) {
    // Never throw — logging failure is non-fatal
    console.error(`${LOG_PREFIX} Failed to write eval log:`, (err as Error).message);
  }
}

// ─── Read / Analytics ─────────────────────────────────────────────────────────

export interface EvalStats {
  totalEvals: number;
  passRate: number;          // 0.0–1.0
  regenerationRate: number;  // 0.0–1.0
  avgScore: number;
  avgLatencyMs: number;
}

/**
 * Returns aggregate pass/fail stats for a specific evaluator type.
 * Used for tuning score thresholds and monitoring harness performance.
 *
 * @param evaluatorType - Which evaluator to aggregate ("search_evaluator" | ...)
 * @param sinceHours    - Lookback window in hours (default: 24h)
 */
export async function getEvalStats(
  evaluatorType: EvaluatorType,
  sinceHours = 24
): Promise<EvalStats | null> {
  try {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const logs = await (prisma as any).harnessEvalLog.findMany({
      where: {
        evaluatorType,
        createdAt: { gte: since },
      },
      select: {
        score: true,
        passed: true,
        regenerated: true,
        latencyMs: true,
      },
    });

    if (logs.length === 0) return null;

    const passCount = logs.filter((l: any) => l.passed).length;
    const regenCount = logs.filter((l: any) => l.regenerated).length;
    const avgScore = logs.reduce((s: number, l: any) => s + l.score, 0) / logs.length;
    const avgLatencyMs = Math.round(
      logs.reduce((s: number, l: any) => s + l.latencyMs, 0) / logs.length
    );

    return {
      totalEvals: logs.length,
      passRate: passCount / logs.length,
      regenerationRate: regenCount / logs.length,
      avgScore,
      avgLatencyMs,
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} getEvalStats failed:`, (err as Error).message);
    return null;
  }
}

/**
 * Returns the queries/contexts that triggered the most regenerations.
 * Useful for identifying which types of requests consistently fail evaluation.
 *
 * @param evaluatorType - Which evaluator to query
 * @param limit         - Max results to return (default: 10)
 * @param sinceHours    - Lookback window in hours (default: 168h = 1 week)
 */
export async function getTopFailingContexts(
  evaluatorType: EvaluatorType,
  limit = 10,
  sinceHours = 168
): Promise<Array<{ feedback: string | null; score: number; context: unknown }>> {
  try {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const logs = await (prisma as any).harnessEvalLog.findMany({
      where: {
        evaluatorType,
        passed: false,
        createdAt: { gte: since },
      },
      orderBy: { score: "asc" },
      take: limit,
      select: {
        feedback: true,
        score: true,
        context: true,
      },
    });

    return logs;
  } catch (err) {
    console.error(`${LOG_PREFIX} getTopFailingContexts failed:`, (err as Error).message);
    return [];
  }
}

/**
 * Returns overall harness regeneration rate across all evaluator types.
 * A rate > 40% on any evaluator suggests the threshold needs tuning.
 */
export async function getRegenerationRate(sinceHours = 24): Promise<Record<EvaluatorType, number>> {
  const types: EvaluatorType[] = ["search_evaluator", "response_evaluator", "checkout_contract"];
  const result: Record<string, number> = {};

  for (const type of types) {
    const stats = await getEvalStats(type, sinceHours);
    result[type] = stats?.regenerationRate ?? 0;
  }

  return result as Record<EvaluatorType, number>;
}

/**
 * Returns the 95th percentile latency (in ms) for an evaluator type.
 * Useful for monitoring performance regressions.
 */
export async function getP95Latency(evaluatorType: EvaluatorType, sinceHours = 24): Promise<number> {
  try {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const logs = await (prisma as any).harnessEvalLog.findMany({
      where: {
        evaluatorType,
        createdAt: { gte: since },
      },
      select: { latencyMs: true },
      orderBy: { latencyMs: 'asc' },
    });

    if (logs.length === 0) return 0;
    const index = Math.floor(logs.length * 0.95);
    return logs[index].latencyMs;
  } catch (err) {
    console.error(`${LOG_PREFIX} getP95Latency failed:`, (err as Error).message);
    return 0;
  }
}

/**
 * Returns the percentage of evals that failed (0.0 to 1.0) for an evaluator type.
 */
export async function getFailureRate(evaluatorType: EvaluatorType, sinceHours = 24): Promise<number> {
  try {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const logs = await (prisma as any).harnessEvalLog.findMany({
      where: {
        evaluatorType,
        createdAt: { gte: since },
      },
      select: { passed: true },
    });

    if (logs.length === 0) return 0;
    const failCount = logs.filter((l: any) => !l.passed).length;
    return failCount / logs.length;
  } catch (err) {
    console.error(`${LOG_PREFIX} getFailureRate failed:`, (err as Error).message);
    return 0;
  }
}
