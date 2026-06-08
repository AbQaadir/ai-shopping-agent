"use client";

import React, { useState } from "react";
import { Loader2, Sparkles, Check, ChevronRight, Box } from "lucide-react";
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
}: ThinkingPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
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

  // Collapsed pill (after generation is done)
  if (isDone && isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 rounded-full text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-all duration-200 cursor-pointer group animate-fadeIn"
      >
        <Sparkles size={10} className="text-[#402970]" />
        <span>Thought process</span>
        <span className="text-slate-300 font-light">·</span>
        <span>{completedCount} steps</span>
        {totalDurationMs > 0 && (
          <>
            <span className="text-slate-300 font-light">·</span>
            <span>{(totalDurationMs / 1000).toFixed(1)}s</span>
          </>
        )}
        <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  return (
    <div className="w-full animate-fadeInScale">
      {/* ── Panel container ── */}
      <div
        className={`rounded-2xl overflow-hidden border transition-all duration-300 ${
          isDone
            ? "border-slate-100 bg-white"
            : "border-[#402970]/15 bg-gradient-to-br from-[#402970]/[0.02] to-purple-50/30"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-2.5 ${
            isDone ? "bg-white border-b border-slate-50" : "bg-gradient-to-r from-[#402970]/5 to-transparent"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {/* Animated icon */}
            {!isDone ? (
              <div className="relative flex items-center justify-center w-6 h-6">
                <div className="absolute inset-0 rounded-full bg-[#402970]/10 animate-ping opacity-50" />
                <div className="w-5 h-5 rounded-full bg-[#402970]/10 flex items-center justify-center animate-glow-pulse">
                  <Sparkles size={10} className="text-[#402970]" />
                </div>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check size={10} className="text-emerald-600 stroke-[3]" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-slate-700">
                {isDone ? "Thought Process" : "Thinking…"}
              </span>
              {!isDone && (
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-[#402970]/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-[#402970]/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 rounded-full bg-[#402970]/60 animate-bounce [animation-delay:300ms]" />
                </div>
              )}
              {isDone && completedCount > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded-full border border-emerald-100">
                  {completedCount} step{completedCount !== 1 ? "s" : ""}
                  {totalDurationMs > 0 && ` · ${(totalDurationMs / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
          </div>

          {isDone && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
            >
              Collapse
            </button>
          )}
        </div>

        {/* Steps body */}
        <div className="px-4 pt-3 pb-4 space-y-2.5">
          {/* Empty state (waiting for first step) */}
          {steps.length === 0 && isGenerating && (
            <div className="flex items-center gap-3 py-1 animate-fadeIn">
              <div className="w-5 h-5 rounded-full bg-slate-100 animate-pulse shrink-0" />
              <div className="h-2.5 bg-slate-100 rounded-full w-48 animate-pulse" />
            </div>
          )}

          {/* Step cards */}
          {steps.map((step, idx) => {
            const isRunning = step.status === "running";
            const icon = stepIcons[step.step] || "⚡";
            return (
              <div
                key={`${step.step}-${idx}`}
                className="animate-step-enter flex gap-3 items-start"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Timeline connector */}
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

                {/* Content */}
                <div
                  className={`flex-1 min-w-0 rounded-xl px-3 py-2.5 transition-all duration-300 relative overflow-hidden ${
                    isRunning
                      ? "bg-[#402970]/5 border border-[#402970]/10"
                      : "bg-slate-50/80 border border-slate-100"
                  }`}
                >
                  {/* Shimmer sweep on running step */}
                  {isRunning && (
                    <div className="absolute inset-0 animate-shimmer pointer-events-none" />
                  )}

                  <div className="flex items-center justify-between mb-1 relative">
                    <span
                      className={`text-[11px] font-extrabold ${
                        isRunning ? "text-[#402970]" : "text-slate-700"
                      }`}
                    >
                      {getStepLabel(step.step)}
                    </span>
                    {!isRunning && step.durationMs != null && step.durationMs > 0 && (
                      <span className="text-[9px] font-semibold text-slate-400 tabular-nums">
                        {(step.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    {isRunning && (
                      <span className="text-[9px] font-bold text-[#402970]/60 animate-pulse">
                        Running…
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] leading-relaxed relative ${
                      isRunning ? "text-[#402970]/70" : "text-slate-500"
                    }`}
                  >
                    {step.content}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Active tool call badge */}
          {activeToolCall && (
            <div className="animate-step-enter flex gap-3 items-center">
              <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-200 flex items-center justify-center shrink-0 animate-glow-pulse">
                <Loader2 size={11} className="text-amber-600 animate-spin" />
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-amber-50/80 border border-amber-100 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700">Calling tool:</span>
                <code className="text-[10px] font-mono bg-amber-100/60 px-1.5 py-0.5 rounded text-amber-800">
                  {activeToolCall.name}
                </code>
              </div>
            </div>
          )}

          {/* Product result badge (inside thinking panel) */}
          {inlineProducts && inlineProducts.length > 0 && (
            <div className="animate-step-enter flex gap-3 items-center">
              <div className="w-6 h-6 rounded-full bg-[#402970]/10 border-2 border-[#402970]/20 flex items-center justify-center shrink-0">
                <Box size={11} className="text-[#402970]" />
              </div>
              <div className="flex-1 flex items-center justify-between gap-2 px-3 py-2 bg-[#402970]/5 border border-[#402970]/10 rounded-xl">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-[#402970]">
                    {inlineProducts.length} products found
                  </span>
                  <span className="text-[10px] text-slate-400">· Kapruka catalog</span>
                </div>
                {onViewDetails && (
                  <button
                    onClick={onViewDetails}
                    className="text-[10px] font-bold text-[#402970] hover:text-[#33205a] px-2 py-1 rounded-lg hover:bg-[#402970]/10 transition-all cursor-pointer whitespace-nowrap"
                  >
                    View details →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
