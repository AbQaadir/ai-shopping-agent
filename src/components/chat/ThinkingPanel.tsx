"use client";

import React, { useState } from "react";
import { Loader2, Check, ChevronDown, ChevronUp, Box } from "lucide-react";
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
  const isDone = !isGenerating && hasText;

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

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalDurationMs = steps.reduce((acc, s) => acc + (s.durationMs || 0), 0);

  // ─── Case A: Active / Generating Loader ───
  if (isGenerating) {
    return (
      <div className="w-full animate-fadeIn pb-4 select-none">
        <div className="px-4 py-4 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4 w-full">
          {/* Header */}
          <div className="flex items-center gap-2.5 text-slate-700 font-bold text-sm">
            <Loader2 size={16} className="text-[#402970] animate-spin" />
            <span className="text-slate-800">Working on your task</span>
          </div>

          <div className="pl-6 space-y-3.5">
            {/* Checklist */}
            <div className="space-y-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-[#402970] animate-pulse" />
                  <span>Getting everything ready</span>
                </div>
                <p className="text-slate-500 text-xs font-medium pl-4 leading-relaxed">
                  Searching for &ldquo;{activeQueryText || 'products'}&rdquo; on Kapruka to provide a variety of options for the user...
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold pl-4">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                <span>Preparing the response</span>
              </div>
            </div>

            {/* Embedded Search Card */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate min-w-0">
                <Box size={14} className="text-[#402970] shrink-0" />
                <span className="shrink-0 text-slate-700">Product search</span>
                <span className="text-slate-300 font-light shrink-0">|</span>
                <span className="text-slate-500 font-medium truncate">
                  {activeQueryText || "Search query"}
                </span>
              </div>
              <button
                onClick={onViewDetails}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer hover:border-slate-300 active:scale-95"
              >
                View details
              </button>
            </div>

            {/* Loading skeletons */}
            <div className="space-y-2 pt-1">
              <div className="h-1.5 bg-slate-100 rounded-full w-full animate-pulse" />
              <div className="h-1.5 bg-slate-100 rounded-full w-[90%] animate-pulse [animation-delay:0.2s]" />
              <div className="h-1.5 bg-slate-100 rounded-full w-[70%] animate-pulse [animation-delay:0.4s]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Case B: Completed / Collapsed State ───
  if (isDone && isCollapsed) {
    return (
      <div className="w-full animate-fadeIn pb-3 select-none">
        <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.015)] space-y-3.5 w-full">
          {/* Header click triggers expand */}
          <div 
            onClick={() => setIsCollapsed(false)}
            className="flex items-start justify-between cursor-pointer group"
          >
            <div className="space-y-1 min-w-0 flex-1 pr-4">
              <div className="flex items-center gap-2 text-[#402970] font-bold text-sm">
                {/* Clean purple checkmark bullet */}
                <div className="w-4 h-4 rounded-full bg-[#402970]/10 flex items-center justify-center shrink-0">
                  <Check size={10} className="text-[#402970] stroke-[3]" />
                </div>
                <span className="text-slate-800">Getting everything ready</span>
              </div>
              <p className="text-slate-500 text-xs font-medium pl-6 leading-relaxed">
                Searching for &ldquo;{activeQueryText || 'products'}&rdquo; to provide a variety of options for the user.
              </p>
            </div>
            
            <button 
              className="p-1 hover:bg-slate-50 border border-transparent hover:border-slate-100 rounded-lg text-slate-400 group-hover:text-slate-600 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold shrink-0 self-center"
            >
              <span>Show steps</span>
              <ChevronDown size={12} />
            </button>
          </div>

          {/* Embedded persistent details sub-card if products matched */}
          {inlineProducts && inlineProducts.length > 0 && (
            <div className="pl-6">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate min-w-0">
                  <Box size={14} className="text-[#402970] shrink-0" />
                  <span className="shrink-0 text-slate-700">Product search</span>
                  <span className="text-slate-300 font-light shrink-0">|</span>
                  <span className="text-slate-500 font-medium truncate">
                    {activeQueryText || "Search query"}
                  </span>
                </div>
                <button
                  onClick={onViewDetails}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer hover:border-slate-300 active:scale-95"
                >
                  View details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Case C: Completed / Expanded State ───
  return (
    <div className="w-full animate-fadeInScale pb-3 select-none">
      <div className="rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        {/* Expanded Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Check size={11} className="text-emerald-600 stroke-[3]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-700">
                Thought Process
              </span>
              {completedCount > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded-full border border-emerald-100">
                  {completedCount} steps · {(totalDurationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(true)}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 border border-slate-100 hover:border-slate-200 px-2 py-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
          >
            <span>Hide steps</span>
            <ChevronUp size={11} />
          </button>
        </div>

        {/* Timeline audit log */}
        <div className="px-4 pt-3.5 pb-4 space-y-3">
          {steps.map((step, idx) => {
            const isRunning = step.status === "running";
            const icon = stepIcons[step.step] || "⚡";
            return (
              <div
                key={`${step.step}-${idx}`}
                className="animate-step-enter flex gap-3 items-start"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Connector */}
                <div className="flex flex-col items-center shrink-0 pt-0.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-500 relative ${
                      isRunning
                        ? "bg-[#402970]/10 border-2 border-[#402970]/30 animate-glow-pulse"
                        : "bg-emerald-50 border-2 border-emerald-200"
                    }`}
                  >
                    {isRunning ? (
                      <Loader2 size={11} className="text-[#402970] animate-spin" />
                    ) : (
                      <span className="text-[11px]">{icon}</span>
                    )}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="w-0.5 h-3 bg-slate-100 mt-1" />
                  )}
                </div>

                {/* Audit step card */}
                <div className="flex-1 min-w-0 rounded-xl px-3 py-2 bg-slate-50/85 border border-slate-100/50">
                  <div className="flex items-center justify-between mb-0.5 relative">
                    <span className="text-[10px] font-bold text-slate-700">
                      {getStepLabel(step.step)}
                    </span>
                    {step.durationMs != null && step.durationMs > 0 && (
                      <span className="text-[9px] font-medium text-slate-400 tabular-nums">
                        {(step.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    {step.content}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Persistent Search sub-card inside expanded steps too */}
          {inlineProducts && inlineProducts.length > 0 && (
            <div className="pl-9 pt-1">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate min-w-0">
                  <Box size={14} className="text-[#402970] shrink-0" />
                  <span className="shrink-0 text-slate-700">Product search</span>
                  <span className="text-slate-300 font-light shrink-0">|</span>
                  <span className="text-slate-500 font-medium truncate">
                    {activeQueryText || "Search query"}
                  </span>
                </div>
                <button
                  onClick={onViewDetails}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer hover:border-slate-300 active:scale-95"
                >
                  View details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
