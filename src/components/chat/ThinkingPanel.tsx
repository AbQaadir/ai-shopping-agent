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

function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    intent_routing: "Intent Classification",
    searching_kapruka: "Kapruka Product Search",
    sme_filter: "Local SME Filtering",
    checking_delivery: "Delivery Availability Check",
    tracking_order: "Order Tracking",
    calculating_import: "Import Cost Calculation",
    finding_providers: "Service Provider Search",
    generating_response: "AI Response Generation",
    parsing_specs: "Requirement Parsing",
    searching_suppliers: "Supplier Search",
    verification_checks: "Supplier Verification",
  };
  return labels[step] || step.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  
  // Keep it expanded during active generation
  const showContent = isGenerating || !isCollapsed;

  // Step icon config
  const stepIcons: Record<string, string> = {
    intent_routing: "🧭",
    searching_kapruka: "🔍",
    sme_filter: "🇱🇰",
    checking_delivery: "🚚",
    tracking_order: "📦",
    calculating_import: "🌍",
    finding_providers: "🔧",
    generating_response: "✨",
    parsing_specs: "📋",
    searching_suppliers: "🏭",
    verification_checks: "✅",
  };

  return (
    <div className="w-full select-none pb-2">
      {/* ── 1. Show Thought Process Header ── */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 cursor-pointer text-[#858585] hover:text-slate-700 text-xs font-semibold py-1.5 transition-colors duration-200 select-none"
      >
        {/* Sparkle star matching primary theme color #402970 */}
        <Sparkle size={13} className="text-[#402970] shrink-0" fill="#402970" />
        <span>Show thought process</span>
        <ChevronDown 
          size={13} 
          className={`text-[#858585] transition-transform duration-300 ease-in-out shrink-0 ${
            showContent ? "rotate-180" : "rotate-0"
          }`} 
        />
      </div>

      {/* ── 2. Smooth Collapsible Content Container (CSS Grid animation trick) ── */}
      <div 
        className={`grid ${
          showContent 
            ? "grid-rows-[1fr] opacity-100 pointer-events-auto mt-2" 
            : "grid-rows-[0fr] opacity-0 pointer-events-none mt-0"
        }`}
        style={{
          transitionProperty: "grid-template-rows, opacity, margin-top",
          transitionDuration: "300ms",
          transitionTimingFunction: "ease-in-out"
        }}
      >
        <div className="overflow-hidden pl-6 border-l border-slate-200/80 ml-1.5 space-y-3.5 pb-1">
          {/* Status checklist line matching primary theme color #402970 */}
          <div className="flex items-center gap-2 pt-0.5">
            {isGenerating ? (
              <div className="w-4 h-4 rounded-full bg-[#402970]/10 flex items-center justify-center shrink-0 animate-spin">
                <Loader2 size={10} className="text-[#402970]" />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#402970] flex items-center justify-center shrink-0">
                <Check size={9} className="text-white stroke-[3.5]" />
              </div>
            )}
            <span className="text-[13px] font-bold text-slate-800">
              Getting everything ready
            </span>
          </div>

          {/* Detailed subtitle/action log */}
          <p className="text-slate-600 text-xs font-medium leading-relaxed pr-2">
            Searching for {activeQueryText ? `"${activeQueryText}"` : "products"} on B2B platforms to provide a variety of options for the user.
          </p>

          {/* Capsule-style Tool Sub-Card */}
          {((inlineProducts && inlineProducts.length > 0) || isGenerating) && (
            <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4 max-w-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate min-w-0">
                {/* White capsule badge */}
                <div className="bg-white border border-slate-200/80 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 shadow-xs shrink-0 select-none">
                  <Box size={13} className="text-[#402970] shrink-0" />
                  <span>Product search</span>
                </div>
                <span className="text-slate-600 font-semibold truncate pl-1">
                  {activeQueryText || "Search query"}
                </span>
              </div>
              <button
                onClick={onViewDetails}
                className="text-[#3b82f6] hover:text-[#2563eb] font-bold text-[11px] hover:underline cursor-pointer whitespace-nowrap active:scale-95 pr-2"
              >
                View details
              </button>
            </div>
          )}

          {/* Secondary audit log items (only when expanded + not generating) */}
          {!isGenerating && !isCollapsed && steps.length > 0 && (
            <div className="pt-2.5 border-t border-slate-100/50 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Detailed Log Steps
              </div>
              {steps.map((step, idx) => {
                const icon = stepIcons[step.step] || "⚡";
                return (
                  <div key={idx} className="flex gap-2 items-start text-[11px] text-slate-500">
                    <span className="shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0 text-slate-600">
                      <span className="font-bold text-slate-700">{getStepLabel(step.step)}</span>: {step.content}
                      {step.durationMs != null && step.durationMs > 0 && (
                        <span className="text-[9px] text-slate-400 font-medium ml-1">
                          ({(step.durationMs / 1000).toFixed(1)}s)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
