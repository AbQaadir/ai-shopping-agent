"use client";

import React, { useState } from "react";
import { Loader2, Check, ChevronDown, Box, Sparkle } from "lucide-react";
import type { InlineProduct } from "@/types/sourcing";

interface ThinkingStep {
  step: string;
  status: "running" | "completed";
  content: string;
  durationMs?: number;
}

interface ThinkingPanelProps {
  steps: ThinkingStep[];
  activeToolCall?: { name: string; args: unknown } | null;
  isGenerating: boolean;
  hasText: boolean;
  inlineProducts?: InlineProduct[];
  onViewDetails?: () => void;
  activeQueryText?: string;
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

// Checks if the tool has a product details drawer
function hasDetailView(badge: string | null): boolean {
  return badge === "Product search" || badge === "SME filtering";
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

export default function ThinkingPanel({
  steps,
  activeToolCall,
  isGenerating,
  hasText,
  inlineProducts,
  onViewDetails,
  activeQueryText = "",
}: ThinkingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Auto-expand when generating
  const showContent = isGenerating || !isCollapsed;

  // Filter out duplicate log items (e.g. if routing or generating_response has simple text)
  // We want to render them clearly, but if they represent empty templates, we show the ones that contain text.
  const visibleSteps = steps.filter(s => s.content && s.step !== "generating_response");

  return (
    <div className="w-full select-none pb-2 transition-all duration-300">
      {/* ── Header State Toggle ── */}
      {isGenerating ? (
        <div className="w-full">
          {/* Active Header */}
          <div className="flex items-center gap-2 text-slate-500 text-[13px] font-medium py-1.5 select-none">
            <Loader2 size={13} className="text-[#f97316] animate-spin shrink-0" />
            <span>Working on your task</span>
          </div>
          {/* Linear Progress Bar */}
          <div className="w-full h-[2px] bg-slate-100/80 relative overflow-hidden rounded-full mt-1.5 mb-4">
            <div className="absolute top-0 bottom-0 left-0 bg-[#f97316] rounded-full animate-progress-slide" style={{ width: "30%" }} />
          </div>
        </div>
      ) : (
        /* Completed/Interactive Collapsible Header */
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 cursor-pointer text-[#858585] hover:text-slate-700 text-xs font-semibold py-1.5 transition-colors duration-200 select-none"
        >
          <Sparkle size={13} className="text-[#f97316] shrink-0" fill="#f97316" />
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
              <div className="w-2.5 h-2.5 rounded-full bg-[#f97316] shrink-0 mx-1 animate-pulse" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#f97316] flex items-center justify-center shrink-0">
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
              
              return (
                <div key={idx} className="space-y-2.5 animate-fadeIn">
                  <p className="text-slate-600 text-[13px] font-medium leading-relaxed pr-2">
                    {step.content}
                  </p>
                  
                  {badge && (
                    /* Tool Capsule Card */
                    <div className="p-1.5 bg-slate-50 border border-slate-100/50 rounded-full flex items-center justify-between gap-4 max-w-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] transition-all">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 truncate min-w-0">
                        {/* White Badge container */}
                        <div className="bg-white border border-slate-200/60 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shadow-xs shrink-0 select-none">
                          <Box size={13} className="text-[#402970] shrink-0" />
                          <span>{badge}</span>
                        </div>
                        <span className="text-slate-800 font-semibold truncate pl-1">
                          {query}
                        </span>
                      </div>
                      {hasDetailView(badge) && (
                        <button
                          onClick={onViewDetails}
                          className="text-slate-600 hover:text-slate-900 font-bold text-[11px] underline decoration-slate-300 hover:decoration-slate-500 cursor-pointer whitespace-nowrap active:scale-95 pr-3 transition-colors select-none"
                        >
                          View details
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Active running tool call (if not yet recorded as a completed step) */}
            {isGenerating && activeToolCall && !steps.some(s => getStepBadge(s.step) === getToolBadge(activeToolCall.name)) && (
              <div className="space-y-2.5 animate-fadeIn">
                <p className="text-slate-600 text-[13px] font-medium leading-relaxed pr-2">
                  Running task {getToolBadge(activeToolCall.name) || "execution"}...
                </p>
                {getToolBadge(activeToolCall.name) && (
                  <div className="p-1.5 bg-slate-50 border border-slate-100/50 rounded-full flex items-center justify-between gap-4 max-w-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-slate-600 truncate min-w-0">
                      <div className="bg-white border border-slate-200/60 rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shadow-xs shrink-0 select-none">
                        <Box size={13} className="text-[#402970] shrink-0" />
                        <span>{getToolBadge(activeToolCall.name)}</span>
                      </div>
                      <span className="text-slate-800 font-semibold truncate pl-1">
                        {(activeToolCall.args as any)?.query || activeQueryText}
                      </span>
                    </div>
                    {hasDetailView(getToolBadge(activeToolCall.name)) && (
                      <button
                        onClick={onViewDetails}
                        className="text-slate-600 hover:text-slate-900 font-bold text-[11px] underline decoration-slate-300 hover:decoration-slate-500 cursor-pointer whitespace-nowrap active:scale-95 pr-3 transition-colors select-none"
                      >
                        View details
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

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
