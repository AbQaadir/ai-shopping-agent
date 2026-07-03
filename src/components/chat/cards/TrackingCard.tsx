"use client";

import React, { useState } from "react";
import { MapPin, ShoppingBag, MessageSquare, Receipt, Package2, CheckCircle2, ChevronDown } from "lucide-react";
import type { TrackingResult } from "@/types/sourcing";

interface TrackingCardProps {
  tracking: TrackingResult;
}

// Status badge colours — mirrors the palette used by DeliveryCard / OrderStepBubble
const STATUS_CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  pending:           { label: "Pending",           icon: "⏳", bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-100" },
  packed:            { label: "Packed",            icon: "📦", bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-100"  },
  dispatched:        { label: "Dispatched",        icon: "🚚", bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-100"  },
  in_transit:        { label: "In Transit",        icon: "🚚", bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-100"  },
  out_for_delivery:  { label: "Out for Delivery",  icon: "🛵", bg: "bg-violet-50",  text: "text-violet-700", border: "border-violet-100"},
  delivered:         { label: "Delivered",         icon: "✅", bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-100"},
  failed:            { label: "Failed",            icon: "❌", bg: "bg-red-50",     text: "text-red-600",    border: "border-red-100"   },
};

function getStatusConfig(raw: string) {
  const key = raw.toLowerCase().replace(/[\s-]/g, "_");
  return STATUS_CONFIG[key] ?? { label: raw, icon: "📦", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-100" };
}

export default function TrackingCard({ tracking }: TrackingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getStatusConfig(tracking.currentStatus);
  // Show our internal order ref if available, else fall back to MCP orderId
  const displayRef = tracking.displayOrderRef || tracking.orderId;

  return (
    <div className="space-y-3">

      {/* ── Status row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{status.icon}</span>
          <div>
            <div className="text-sm font-extrabold text-slate-800">{status.label}</div>
            {tracking.estimatedDelivery && (
              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                Expected: {tracking.estimatedDelivery}
              </div>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 ${status.bg} rounded-full border ${status.border}`}>
          <CheckCircle2 size={11} className={status.text} />
          <span className={`text-[10px] font-extrabold ${status.text} font-mono`}>
            #{displayRef}
          </span>
        </div>
      </div>

      {/* ── Items from DB ────────────────────────────────────────────── */}
      {tracking.displayItems && tracking.displayItems.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <ShoppingBag size={11} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Items Ordered
            </span>
          </div>
          {tracking.displayItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 truncate flex-1">
                {item.quantity > 1 && (
                  <span className="text-[#402970] font-bold mr-1">{item.quantity}×</span>
                )}
                {item.name}
              </span>
              <span className="text-[10px] font-bold text-slate-500 font-mono shrink-0">
                Rs.&nbsp;{(item.priceLKR * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
          {/* Total */}
          {tracking.displayTotalLKR !== undefined && (
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 mt-1">
              <div className="flex items-center gap-1">
                <Receipt size={10} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total</span>
              </div>
              <span className="text-xs font-extrabold text-[#402970] font-mono">
                Rs.&nbsp;{tracking.displayTotalLKR.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Gift / Personal Message from DB ──────────────────────────── */}
      {tracking.displayPersonalMessage && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
          <MessageSquare size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide block mb-0.5">
              Gift Message
            </span>
            <span className="text-[11px] font-semibold text-amber-800 italic">
              &ldquo;{tracking.displayPersonalMessage}&rdquo;
            </span>
          </div>
        </div>
      )}

      {/* ── Progress Timeline from MCP ───────────────────────────────── */}
      {tracking.steps && tracking.steps.length > 0 && (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full mb-3 group cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Package2 size={11} className="text-slate-400 group-hover:text-[#402970] transition-colors" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide group-hover:text-[#402970] transition-colors">
                Live Progress
              </span>
            </div>
            {tracking.steps.length > 1 && (
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} 
              />
            )}
          </button>
          <div className="border-l-2 border-slate-100 pl-4 ml-1">
            {/* The collapsible container for older steps */}
            {tracking.steps.length > 1 && (
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                  isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-4 pb-4">
                    {tracking.steps.slice(0, tracking.steps.length - 1).map((step, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-white border-2 border-slate-200 top-0.5" />
                        <div className="text-[10px] font-bold text-slate-400">{step.timestamp}</div>
                        <div className="text-xs font-medium text-slate-600">{step.description}</div>
                        {step.location && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <MapPin size={9} />
                            {step.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Always visible latest step */}
            {(() => {
              const latestStep = tracking.steps[tracking.steps.length - 1];
              return (
                <div className="relative">
                  <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-white border-2 border-[#402970] top-0.5 ring-4 ring-[#402970]/10" />
                  <div className="text-[10px] font-bold text-[#402970]">{latestStep.timestamp}</div>
                  <div className="text-xs font-semibold text-slate-800">{latestStep.description}</div>
                  {latestStep.location && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                      <MapPin size={9} />
                      {latestStep.location}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
