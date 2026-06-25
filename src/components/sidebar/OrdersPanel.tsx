"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  X,
  Package,
  RefreshCw,
  MapPin,
  CalendarDays,
  Truck,
  Gift,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { TrackingResult } from "@/types/sourcing";

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  priceLKR: number;
  imageUrl?: string | null;
}

interface OrderData {
  id: string;
  userId: string;
  status: string;
  totalLKR: number;
  kaprukaRef: string | null;
  deliveryDate: string | null;
  personalMessage: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface OrdersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pending: { 
      label: "Pending", 
      icon: <Clock size={11} className="shrink-0" />, 
      className: "bg-amber-50 text-amber-700 border-amber-200/60" 
    },
    processing: { 
      label: "Processing", 
      icon: <Loader2 size={11} className="animate-spin shrink-0" />, 
      className: "bg-blue-50 text-blue-700 border-blue-200/60" 
    },
    completed: { 
      label: "Delivered", 
      icon: <CheckCircle size={11} className="shrink-0" />, 
      className: "bg-emerald-50 text-emerald-700 border-emerald-200/60" 
    },
    cancelled: { 
      label: "Cancelled", 
      icon: <XCircle size={11} className="shrink-0" />, 
      className: "bg-rose-50 text-rose-700 border-rose-200/60" 
    },
  };
  const { label, icon, className } = cfg[status] ?? { 
    label: status, 
    icon: <AlertCircle size={11} className="shrink-0" />, 
    className: "bg-slate-50 text-slate-600 border-slate-200/60" 
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${className}`}>
      {icon}
      {label}
    </span>
  );
}

// ── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 animate-pulse space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-16" />
      </div>
      <div className="flex items-center justify-between gap-4 p-2 bg-slate-50/50 rounded-xl border border-slate-100/40">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-slate-100" />
          <div className="space-y-1.5">
            <div className="h-3 bg-slate-100 rounded w-40" />
            <div className="h-2 bg-slate-100 rounded w-20" />
          </div>
        </div>
        <div className="h-3 bg-slate-100 rounded w-16" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="h-3 bg-slate-100 rounded w-1/4" />
        <div className="h-4 bg-slate-100 rounded w-20" />
      </div>
    </div>
  );
}

// ── Tracking Timeline ────────────────────────────────────────────────────────

function TrackingTimeline({ tracking }: { tracking: TrackingResult }) {
  const steps = tracking.steps || [];

  return (
    <div className="mt-4 p-4.5 bg-slate-50 rounded-2xl border border-slate-100/80 animate-fadeIn">
      <div className="flex items-center gap-3 mb-4.5 pb-3 border-b border-slate-200/50">
        <div className="w-8 h-8 rounded-lg bg-[#402970]/10 flex items-center justify-center text-[#402970] shrink-0">
          <Truck size={14} />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>Status:</span>
            <span className="font-black text-[#402970] uppercase tracking-wider text-[10px] bg-[#402970]/5 px-2 py-0.5 rounded-md">
              {tracking.currentStatus.replace(/_/g, " ")}
            </span>
          </div>
          {tracking.estimatedDelivery && (
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Est. Delivery: {tracking.estimatedDelivery}</div>
          )}
        </div>
      </div>

      {steps.length > 0 ? (
        <div className="relative pl-6 border-l-2 border-slate-200/85 space-y-5 ml-2.5">
          {steps.map((step, i) => {
            const isLatest = i === 0;
            return (
              <div key={i} className="relative">
                {/* Stepper Dot Indicator */}
                <span className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white flex items-center justify-center transition-colors ${
                  isLatest ? "border-[#402970] ring-4 ring-[#402970]/10" : "border-slate-300"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLatest ? "bg-[#402970]" : "bg-slate-300"}`} />
                </span>

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-slate-400">{step.timestamp}</span>
                  <h6 className={`text-xs font-bold leading-normal ${isLatest ? "text-slate-850 font-extrabold" : "text-slate-600"}`}>
                    {step.description}
                  </h6>
                  {step.location && (
                    <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                      <MapPin size={9} className="text-[#402970]" />
                      <span>{step.location}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 text-center py-2 font-medium">
          No detailed tracking steps available yet.
        </div>
      )}
    </div>
  );
}

// ── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onTrack,
  trackingState,
}: {
  order: OrderData;
  onTrack: (kaprukaRef: string, orderId: string) => void;
  trackingState?: TrackingResult | "loading" | "error";
}) {
  const [expanded, setExpanded] = useState(false);
  const isDelivered = order.status === "completed";

  const formattedDate = order.deliveryDate
    ? new Date(order.deliveryDate + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short",
      })
    : null;

  const formattedCreated = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const handleTrackClick = () => {
    if (order.kaprukaRef) {
      onTrack(order.kaprukaRef, order.id);
      setExpanded(true);
    }
  };

  return (
    <div className="bg-white border border-slate-100/80 rounded-2xl p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-[#402970]/30 flex flex-col gap-4">
      {/* Top Header Row */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-500 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md">
            {order.kaprukaRef ? `#${order.kaprukaRef}` : `#${order.id.slice(0, 8).toUpperCase()}`}
          </span>
          <span className="text-[10px] text-slate-300 font-bold">•</span>
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400">Ordered {formattedCreated}</span>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Products list (one below another) */}
      <div className="flex flex-col gap-2.5">
        {order.items.map((item, index) => (
          <div key={item.id || index} className="flex items-center justify-between gap-4 p-2.5 bg-slate-50/60 rounded-xl border border-slate-100/80 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.productName}
                  className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <Package size={16} className="text-slate-400" />
                </div>
              )}
              <div className="min-w-0">
                <h5 className="text-[11px] sm:text-xs font-extrabold text-slate-700 truncate max-w-[220px] sm:max-w-[420px]">
                  {item.productName}
                </h5>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  Qty: {item.quantity} × Rs. {item.priceLKR.toLocaleString()}
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-[#402970] shrink-0">
              Rs. {(item.priceLKR * item.quantity).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Row: Delivery dates, message, and grand total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="flex flex-col gap-1.5 min-w-0">
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
              <CalendarDays size={12} className="text-[#402970]/70" />
              <span>Deliver by: <span className="text-slate-800 font-extrabold">{formattedDate}</span></span>
            </div>
          )}
          {order.personalMessage && (
            <div className="flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-50/50 border border-rose-100/50 px-2 py-0.5 rounded-lg w-fit">
              <Gift size={10} className="text-rose-500 shrink-0" />
              <span className="italic font-bold">"{order.personalMessage}"</span>
            </div>
          )}
        </div>
        <div className="text-left sm:text-right shrink-0">
          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Total Amount</span>
          <span className="text-base font-black text-[#402970]">
            Rs. {order.totalLKR.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tracking actions */}
      {!isDelivered && order.kaprukaRef && (
        <div className="pt-3 border-t border-slate-100/60 flex items-center justify-between">
          <button
            onClick={handleTrackClick}
            disabled={trackingState === "loading"}
            className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#402970] hover:bg-[#301e54] rounded-lg px-4 py-2 transition-all cursor-pointer outline-none disabled:opacity-50 shadow-sm active:scale-[0.98]"
          >
            {trackingState === "loading" ? (
              <Loader2 size={12} className="animate-spin text-white" />
            ) : (
              <Truck size={12} className="text-white" />
            )}
            Track Delivery Status
          </button>
          {trackingState && trackingState !== "loading" && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer outline-none transition-colors border-none bg-transparent"
            >
              {expanded ? "Hide Details" : "Show Details"}
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      )}

      {/* Tracking error */}
      {trackingState === "error" && (
        <div className="flex items-center gap-1.5 text-[10px] text-rose-500 font-bold bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl">
          <AlertCircle size={12} />
          Tracking is currently unavailable for this order reference.
        </div>
      )}

      {/* Inline tracking timeline */}
      {expanded && trackingState && trackingState !== "loading" && trackingState !== "error" && (
        <TrackingTimeline tracking={trackingState as TrackingResult} />
      )}
    </div>
  );
}

// ── Main Orders Panel ─────────────────────────────────────────────────────────

export default function OrdersPanel({ isOpen, onClose }: OrdersPanelProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<
    Record<string, TrackingResult | "loading" | "error">
  >({});

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders?userId=${user.id}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data);
    } catch {
      setError("Could not load your orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchOrders();
    }
  }, [isOpen, user?.id, fetchOrders]);

  const handleTrack = async (kaprukaRef: string, orderId: string) => {
    setTrackingData((prev) => ({ ...prev, [orderId]: "loading" }));
    try {
      const res = await fetch(`/api/track?kaprukaRef=${encodeURIComponent(kaprukaRef)}`);
      if (!res.ok) throw new Error("Not found");
      const data: TrackingResult = await res.json();
      setTrackingData((prev) => ({ ...prev, [orderId]: data }));
    } catch {
      setTrackingData((prev) => ({ ...prev, [orderId]: "error" }));
    }
  };

  const activeOrders = orders.filter((o) => o.status === "pending" || o.status === "processing");
  const deliveredOrders = orders.filter((o) => o.status === "completed");

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-end sm:items-center justify-end sm:justify-center animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close orders"
      />

      {/* Modal Container */}
      <div className="relative w-full sm:max-w-4xl sm:mx-4 max-h-[90vh] sm:max-h-[85vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slideUp sm:animate-fadeInScale border border-slate-100/80">
        
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 shrink-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9.5 h-9.5 rounded-xl bg-[#402970]/8 flex items-center justify-center border border-[#402970]/15 text-[#402970]">
              <Package size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-tight">
                My Orders
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                {orders.length === 0
                  ? "No orders found"
                  : `Total orders: ${orders.length}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              title="Refresh orders"
              className="p-2 text-slate-400 hover:text-[#402970] hover:bg-[#402970]/5 rounded-lg transition-all cursor-pointer outline-none disabled:opacity-40"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer outline-none"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-slate-50/30">
          {/* Loading state */}
          {loading && orders.length === 0 && (
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-sm text-slate-600 font-medium">{error}</p>
              <button
                onClick={fetchOrders}
                className="text-xs text-[#402970] font-bold hover:underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <div className="p-5 bg-[#402970]/5 rounded-2xl">
                <Package size={40} className="text-[#402970]/40" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-700">No orders yet</h3>
              <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
                You haven't placed any orders yet. Start shopping!
              </p>
              <button
                onClick={onClose}
                className="mt-1 text-xs text-white bg-[#402970] hover:bg-[#2e1f52] px-5 py-2.5 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Browse Products
              </button>
            </div>
          )}

          {/* Active Orders */}
          {!loading && activeOrders.length > 0 && (
            <div className="space-y-3.5">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">
                Active Orders
              </h3>
              <div className="flex flex-col gap-4">
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onTrack={handleTrack}
                    trackingState={trackingData[order.id]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Delivered Orders */}
          {!loading && deliveredOrders.length > 0 && (
            <div className="space-y-3.5">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">
                Delivered
              </h3>
              <div className="flex flex-col gap-4">
                {deliveredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onTrack={handleTrack}
                    trackingState={trackingData[order.id]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
