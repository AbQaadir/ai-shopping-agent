"use client";

import React from "react";
import { Package, MapPin } from "lucide-react";
import type { TrackingResult } from "@/types/sourcing";

interface TrackingCardProps {
  tracking: TrackingResult;
}

export default function TrackingCard({ tracking }: TrackingCardProps) {
  const statusIcons: Record<string, string> = {
    pending: "⏳",
    packed: "📦",
    dispatched: "🚚",
    in_transit: "🚚",
    out_for_delivery: "🛵",
    delivered: "✅",
    failed: "❌",
  };

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-blue-600" />
          <span className="text-xs font-extrabold text-slate-700">Order Tracking</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 font-mono">#{tracking.orderId}</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{statusIcons[tracking.currentStatus.toLowerCase()] || "📦"}</span>
          <div>
            <div className="text-sm font-extrabold text-slate-800 capitalize">
              {tracking.currentStatus.replace(/_/g, " ")}
            </div>
            {tracking.estimatedDelivery && (
              <div className="text-[10px] text-slate-500 font-medium">
                Expected: {tracking.estimatedDelivery}
              </div>
            )}
          </div>
        </div>

        {tracking.steps && tracking.steps.length > 0 && (
          <div className="space-y-3 border-l-2 border-slate-100 pl-4 ml-2">
            {tracking.steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-white border-2 border-slate-300 top-0.5" />
                <div className="text-[10px] font-bold text-slate-400">{step.timestamp}</div>
                <div className="text-xs font-semibold text-slate-700">{step.description}</div>
                {step.location && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <MapPin size={9} />
                    {step.location}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
