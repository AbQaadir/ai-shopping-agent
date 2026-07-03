"use client";

import React from "react";
import { Package, MapPin, ShoppingBag, MessageSquare, Receipt } from "lucide-react";
import type { TrackingResult } from "@/types/sourcing";

interface TrackingCardProps {
  tracking: TrackingResult;
}

export default function TrackingCard({ tracking }: TrackingCardProps) {
  // Map raw MCP status strings to emoji icons
  const statusIcons: Record<string, string> = {
    pending: "⏳",
    packed: "📦",
    dispatched: "🚚",
    in_transit: "🚚",
    out_for_delivery: "🛵",
    delivered: "✅",
    failed: "❌",
  };

  // Human-readable display reference: prefer our DB ref, fallback to MCP orderId
  const displayRef = tracking.displayOrderRef || tracking.orderId;

  // Determine the status label — use the raw string (may be "Delivered", "In Transit", etc.)
  const statusLabel = tracking.currentStatus.replace(/_/g, " ");
  const statusKey = tracking.currentStatus.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-blue-600" />
          <span className="text-xs font-extrabold text-slate-700">Order Tracking</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 font-mono">#{displayRef}</span>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Current Status ───────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcons[statusKey] || "📦"}</span>
          <div>
            <div className="text-sm font-extrabold text-slate-800 capitalize">
              {statusLabel}
            </div>
            {tracking.estimatedDelivery && (
              <div className="text-[10px] text-slate-500 font-medium">
                Expected: {tracking.estimatedDelivery}
              </div>
            )}
          </div>
        </div>

        {/* ── Items from DB ────────────────────────────────────────── */}
        {tracking.displayItems && tracking.displayItems.length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 mb-2">
              <ShoppingBag size={11} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Items Ordered</span>
            </div>
            {tracking.displayItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 truncate max-w-[65%]">
                  {item.quantity > 1 && (
                    <span className="text-blue-600 font-bold mr-1">{item.quantity}×</span>
                  )}
                  {item.name}
                </span>
                <span className="text-[10px] font-bold text-slate-500 font-mono whitespace-nowrap">
                  Rs. {(item.priceLKR * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
            {/* Order total */}
            {tracking.displayTotalLKR !== undefined && (
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 mt-1.5">
                <div className="flex items-center gap-1">
                  <Receipt size={10} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total</span>
                </div>
                <span className="text-xs font-extrabold text-blue-700 font-mono">
                  Rs. {tracking.displayTotalLKR.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Gift / Personal Message from DB ──────────────────────── */}
        {tracking.displayPersonalMessage && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
            <MessageSquare size={11} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide block mb-0.5">
                Gift Message
              </span>
              <span className="text-xs text-amber-800 font-medium italic">
                &ldquo;{tracking.displayPersonalMessage}&rdquo;
              </span>
            </div>
          </div>
        )}

        {/* ── Progress Timeline from MCP ───────────────────────────── */}
        {tracking.steps && tracking.steps.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              Live Progress
            </div>
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
          </div>
        )}

      </div>
    </div>
  );
}
