"use client";

import type { InlineProduct } from "@/types/sourcing";
import { Box, Check, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

interface ThinkingStep {
  step: string;
  status: "running" | "completed";
  content: string;
  durationMs?: number;
  terms?: string[]; // parallel search terms — renders individual capsules
}

interface ThinkingPanelProps {
  steps: ThinkingStep[];
  activeToolCall?: { name: string; args: unknown } | null;
  activeToolCalls?: Array<{ name: string; args: unknown }>; // for parallel search display
  isGenerating: boolean;
  hasText: boolean;
  inlineProducts?: InlineProduct[];
  activeQueryText?: string;
  onViewDetails?: (products: InlineProduct[], queryHint?: string) => void; // opens product modal from thought panel
}

// Maps step keys to B2B capsule badge titles
function getStepBadge(stepKey: string): string | null {
  const badgeMap: Record<string, string> = {
    searching_kapruka: "Product search",
    sme_filter: "SME filtering",
    checking_delivery: "Delivery check",
    tracking_order: "Order tracking",
    calculating_import: "Import calculator",
    finding_providers: "Service search",
    google_search_query: "Google Search",
  };
  return badgeMap[stepKey] || null;
}

// Maps tool call names to B2B capsule badge titles
function getToolBadge(toolName: string): string | null {
  const toolMap: Record<string, string> = {
    kapruka_search_products: "Product search",
    kapruka_search_products_sme: "SME filtering",
    kapruka_check_delivery: "Delivery check",
    kapruka_track_order: "Order tracking",
    kapruka_import_estimate: "Import calculator",
    kapruka_service_search: "Service search",
    google_search: "Google Search",
  };
  return toolMap[toolName] || null;
}

// Extracts quote strings or keywords array from content text
function extractQueryFromContent(content: string, fallback: string): string {
  const match = content.match(/"([^"]+)"/);
  if (match && match[1]) {
    return match[1];
  }
  const bracketMatch = content.match(/Keywords:\s*\[([^\]]+)\]/);
  if (bracketMatch && bracketMatch[1]) {
    return bracketMatch[1];
  }
  return fallback;
}

// Helper to extract clean query string or value from tool call arguments
function getToolCallQuery(toolName: string, args: any): string | null {
  if (!args) return null;
  const params = args.params || args;
  
  if (toolName === "kapruka_search_products" || toolName === "kapruka_search_products_sme") {
    return params.query || params.q || null;
  }
  if (toolName === "kapruka_check_delivery" || toolName === "kapruka_list_delivery_cities" || toolName === "kapruka_service_search") {
    return params.city || params.query || null;
  }
  if (toolName === "kapruka_track_order") {
    return params.order_id || params.order_number || null;
  }
  if (toolName === "kapruka_import_estimate") {
    return params.url || null;
  }
  return null;
}

export default function ThinkingPanel({
  steps,
  activeToolCall,
  activeToolCalls,
  isGenerating,
  hasText,
  inlineProducts,
  activeQueryText = "",
  onViewDetails,
}: ThinkingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Auto-expand when generating
  const showContent = isGenerating || !isCollapsed;

  // Filter out duplicate log items
  const visibleSteps = steps.filter(s => s.content && s.step !== "generating_response");

  // Filter products for a specific search term, handling plural/singular mismatches
  const filterProductsForTerm = (term: string): InlineProduct[] => {
    if (!inlineProducts) return [];
    
    const getStems = (word: string): string[] => {
      const w = word.toLowerCase();
      const stems = [w];
      if (w.endsWith("ies") && w.length > 3) {
        stems.push(w.slice(0, -3) + "y");
      } else if (w.endsWith("s") && w.length > 3) {
        stems.push(w.slice(0, -1));
      }
      return stems;
    };

    const words = term.trim().split(/\s+/).flatMap(getStems);
    return inlineProducts.filter(p => {
      const name = (p.name || p.title || "").toLowerCase();
      return words.some(w => name.includes(w));
    });
  };

  // Convert raw search term back to a natural capitalised name
  const cleanQueryName = (term: string): string => {
    const words = term.trim().split(/\s+/);
    if (words.length === 2) {
      return `${words[1]} ${words[0]}`.replace(/\b\w/g, c => c.toUpperCase());
    }
    return term.replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="w-full select-none pb-2 transition-all duration-300">
      {/* ── Header State Toggle ── */}
      {isGenerating ? (
        <div className="w-full">
          {/* Active Header */}
          <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium py-1.5 select-none">
            <Loader2 size={13} className="text-[#402970] animate-spin shrink-0" />
            <span>Working on your task</span>
          </div>
          {/* Linear Progress Bar */}
          <div className="w-full h-[2px] bg-slate-100/80 relative overflow-hidden rounded-full mt-1.5 mb-4">
            <div className="absolute top-0 bottom-0 left-0 bg-[#402970] rounded-full animate-progress-slide" style={{ width: "30%" }} />
          </div>
        </div>
      ) : (
        /* Completed/Interactive Collapsible Header */
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 cursor-pointer text-[#858585] hover:text-slate-700 text-xs font-semibold py-1.5 transition-colors duration-200 select-none"
        >
          <span>Show thought process</span>
          <ChevronDown
            size={13}
            className={`text-[#858585] transition-transform duration-300 ease-in-out shrink-0 ${
              showContent ? "rotate-180" : "rotate-0"
            }`}
          />
        </div>
      )}

      {/* ── Content Area with CSS Grid Expand/Collapse Animation ── */}
      <div
        className={`grid ${
          showContent
            ? "grid-rows-[1fr] opacity-100 pointer-events-auto mt-2"
            : "grid-rows-[0fr] opacity-0 pointer-events-none mt-0"
        }`}
        style={{
          transitionProperty: "grid-template-rows, opacity, margin-top",
          transitionDuration: "300ms",
          transitionTimingFunction: "ease-in-out",
        }}
      >
        <div className="overflow-hidden space-y-3 pb-1">
          {/* Bullet Checklist Point */}
          <div className="flex items-center gap-2 pt-0.5">
            {isGenerating ? (
              <div className="w-2.5 h-2.5 rounded-full bg-[#402970] shrink-0 mx-1 animate-pulse" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#402970] flex items-center justify-center shrink-0">
                <Check size={10} className="text-white stroke-[3.5]" />
              </div>
            )}
            <span className="text-[13px] font-bold text-slate-800">
              Getting everything ready
            </span>
          </div>

          {/* Timeline Connector and Content */}
          <div className="border-l border-slate-100 ml-2 pl-6 space-y-4">

            {/* Render each dynamic step from the LLM */}
            {visibleSteps.map((step, idx) => {
              const badge = getStepBadge(step.step);
              const query = extractQueryFromContent(step.content, activeQueryText);
              const isSearchStep = step.step === "searching_kapruka" && step.status === "completed";
              const hasTerms = isSearchStep && step.terms && step.terms.length > 0;

              return (
                <div key={idx} className="space-y-2.5 animate-step-enter">
                  <p className="text-slate-600 text-[13px] font-medium leading-relaxed pr-2">
                    {step.content}
                  </p>

                  {/* Individual parallel search term capsules (Mark 1) */}
                  {hasTerms ? (
                    <div className="flex flex-col gap-1.5">
                      {step.terms!.map((term, tIdx) => {
                        const filtered = filterProductsForTerm(term);
                        return (
                          <div
                            key={tIdx}
                            className="p-1.5 bg-slate-50 border border-slate-100/50 rounded-full flex items-center justify-between gap-3 max-w-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="bg-white border border-slate-200/60 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shadow-xs shrink-0 select-none">
                                <Box size={13} className="text-[#402970] shrink-0" />
                                <span>Product search</span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold select-none shrink-0">
                                <Check size={11} className="stroke-[3]" />
                                <span>Completed</span>
                              </div>
                            </div>
                            {onViewDetails && filtered.length > 0 && (
                              <button
                                onClick={() => onViewDetails(filtered, cleanQueryName(term))}
                                className="text-[11px] font-extrabold text-[#402970] hover:underline cursor-pointer select-none pr-3"
                              >
                                View details
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : badge ? (
                    /* Fallback: single tool capsule (non-parallel steps) */
                    <div className="p-1.5 bg-slate-50 border border-slate-100/50 rounded-full flex items-center justify-between gap-4 max-w-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] transition-all">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 truncate min-w-0">
                        <div className="bg-white border border-slate-200/60 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shadow-xs shrink-0 select-none">
                          <Box size={13} className="text-[#402970] shrink-0" />
                          <span>{badge}</span>
                        </div>
                        {query && (
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-[350px]">
                            {query}
                          </span>
                        )}
                      </div>
                      {onViewDetails && inlineProducts && inlineProducts.length > 0 && (step.step === "searching_kapruka" || step.step === "sme_filter") && (
                        <button
                          onClick={() => onViewDetails(inlineProducts, query || activeQueryText || "Products")}
                          className="text-[11px] font-extrabold text-[#402970] hover:underline cursor-pointer select-none pr-3 shrink-0"
                        >
                          View details
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* Active running tool call(s) — handles both single and parallel */}
            {isGenerating && (() => {
              // Build a deduplicated list of active tool calls to display
              const callsToShow: Array<{ name: string; args: unknown }> = [];
              // Prefer the plural activeToolCalls if provided
              if (activeToolCalls && activeToolCalls.length > 0) {
                activeToolCalls.forEach(c => {
                  if (!callsToShow.some(x => x.name === c.name && (x.args as Record<string, unknown>)?.query === (c.args as Record<string, unknown>)?.query)) {
                    callsToShow.push(c);
                  }
                });
              } else if (activeToolCall) {
                callsToShow.push(activeToolCall);
              }

              // Only show calls not already represented in completed steps
              const completedBadges = steps.map(s => getStepBadge(s.step)).filter(Boolean);
              const filteredCalls = callsToShow.filter(c => !completedBadges.includes(getToolBadge(c.name)));

              if (filteredCalls.length === 0) return null;

              // Single call: existing style
              if (filteredCalls.length === 1) {
                const call = filteredCalls[0];
                const badge = getToolBadge(call.name);
                const toolQuery = getToolCallQuery(call.name, call.args);
                return badge ? (
                  <div className="space-y-2.5 animate-step-enter">
                    <p className="text-slate-600 text-[13px] font-medium leading-relaxed pr-2">
                      Running task {badge}...
                    </p>
                    <div className="p-1.5 bg-slate-50 border border-slate-100/50 rounded-full flex items-center justify-between gap-4 max-w-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 truncate min-w-0">
                        <div className="bg-white border border-slate-200/60 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shadow-xs shrink-0 select-none">
                          <Box size={13} className="text-[#402970] shrink-0" />
                          <span>{badge}</span>
                        </div>
                        {toolQuery && (
                          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-[350px]">
                            {toolQuery}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null;
              }

              // Multiple parallel calls: show stacked capsule rows
              return (
                <div className="space-y-2.5 animate-step-enter">
                  <p className="text-slate-600 text-[13px] font-medium leading-relaxed pr-2">
                    Running <span className="font-bold text-[#402970]">{filteredCalls.length} parallel</span> product searches...
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {filteredCalls.map((call, idx) => {
                      const badge = getToolBadge(call.name);
                      return badge ? (
                        <div
                          key={idx}
                          className="p-1.5 bg-slate-50 border border-slate-100/50 rounded-full flex items-center justify-between gap-4 max-w-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] animate-fadeIn"
                          style={{ animationDelay: `${idx * 60}ms` }}
                        >
                          <div className="bg-white border border-slate-200/60 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shadow-xs shrink-0 select-none">
                            <Box size={13} className="text-[#402970] shrink-0 animate-pulse" />
                            <span>{badge}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#402970] font-semibold select-none shrink-0 pr-3">
                            <Loader2 size={11} className="animate-spin text-[#402970]" />
                            <span>Searching...</span>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Shimmer Skeletons during active state */}
            {isGenerating && (
              <div className="space-y-2.5 pt-2 animate-pulse pr-4">
                <div className="h-3.5 bg-slate-100/80 rounded-full w-[45%]" />
                <div className="h-3.5 bg-slate-100/80 rounded-full w-[90%]" />
                <div className="h-3.5 bg-slate-100/80 rounded-full w-[75%]" />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
