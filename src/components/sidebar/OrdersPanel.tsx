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
  const cfg: Record<string, { label: string; className: string }> = {
    pending: { label: "⏳ Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
    processing: { label: "🔵 Processing", className: "bg-blue-50 text-blue-700 border-blue-200" },
    completed: { label: "✅ Delivered", className: "bg-green-50 text-green-700 border-green-200" },
    cancelled: { label: "❌ Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
  };
  const { label, className } = cfg[status] ?? { label: status, className: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${className}`}>
      {label}
    </span>
  );
}

// ── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-slate-100 rounded w-3/4" />
          <div className="h-2.5 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded w-full mb-1.5" />
      <div className="h-2 bg-slate-100 rounded w-2/3" />
    </div>
  );
}

// ── Tracking Timeline ────────────────────────────────────────────────────────

function TrackingTimeline({ tracking }: { tracking: TrackingResult }) {
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
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{statusIcons[tracking.currentStatus.toLowerCase()] ?? "📦"}</span>
        <div>
          <div className="text-xs font-extrabold text-slate-700 capitalize">
            {tracking.currentStatus.replace(/_/g, " ")}
          </div>
          {tracking.estimatedDelivery && (
            <div className="text-[10px] text-slate-400">Expected: {tracking.estimatedDelivery}</div>
          )}
        </div>
      </div>
      {tracking.steps && tracking.steps.length > 0 && (
        <div className="space-y-2.5 border-l-2 border-slate-100 pl-3.5 ml-1">
          {tracking.steps.map((step, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[19px] w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300 top-0.5" />
              <div className="text-[10px] font-bold text-slate-400">{step.timestamp}</div>
              <div className="text-[11px] font-semibold text-slate-700">{step.description}</div>
              {step.location && (
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <MapPin size={8} />
                  {step.location}
                </div>
              )}
            </div>
          ))}
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
  const firstItem = order.items[0];
  const extraItems = order.items.length - 1;
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
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs transition-shadow hover:shadow-sm">
      {/* Top row: thumbnail + info + status */}
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div className="relative shrink-0">
          {firstItem?.imageUrl ? (
            <img
              src={firstItem.imageUrl}
              alt={firstItem.productName}
              className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-white"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Package size={20} className="text-slate-400" />
            </div>
          )}
          {extraItems > 0 && (
            <div className="absolute -bottom-1 -right-1 bg-[#402970] text-white text-[9px] font-extrabold rounded-full px-1.5 py-0.5 leading-none">
              +{extraItems}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-extrabold text-slate-800 truncate max-w-[160px]">
              {firstItem?.productName ?? "Order"}
              {extraItems > 0 ? ` + ${extraItems} more` : ""}
            </h4>
            <StatusBadge status={order.status} />
          </div>

          <div className="mt-1.5 space-y-1">
            <div className="text-sm font-extrabold text-[#402970]">
              Rs. {order.totalLKR.toLocaleString()}
            </div>

            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <CalendarDays size={9} />
              {formattedDate ? (
                <span>Deliver by <span className="font-bold text-slate-600">{formattedDate}</span></span>
              ) : (
                <span>Ordered {formattedCreated}</span>
              )}
            </div>

            {order.kaprukaRef && (
              <div className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5 inline-block">
                #{order.kaprukaRef}
              </div>
            )}

            {order.personalMessage && (
              <div className="flex items-start gap-1 text-[10px] text-slate-400 font-medium">
                <Gift size={9} className="mt-0.5 text-rose-400 shrink-0" />
                <span className="italic truncate max-w-[180px]">"{order.personalMessage}"</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isDelivered && order.kaprukaRef && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleTrackClick}
            disabled={trackingState === "loading"}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[#402970] hover:text-[#2e1f52] border border-[#402970]/20 bg-[#402970]/5 hover:bg-[#402970]/10 rounded-lg px-3 py-1.5 transition-all cursor-pointer outline-none disabled:opacity-50"
          >
            {trackingState === "loading" ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Truck size={11} />
            )}
            Track Order
          </button>
          {trackingState && trackingState !== "loading" && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer outline-none transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Hide" : "Show"}
            </button>
          )}
        </div>
      )}

      {/* Tracking error */}
      {trackingState === "error" && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-500 font-medium">
          <AlertCircle size={10} />
          Tracking unavailable right now
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[400px] max-w-full bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#402970]/10 text-[#402970] rounded-xl">
              <Package size={16} />
            </span>
            <h2 className="text-sm font-extrabold text-slate-800">My Orders</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={loading}
              title="Refresh orders"
              className="p-1.5 text-slate-400 hover:text-[#402970] hover:bg-[#402970]/5 rounded-lg transition-all cursor-pointer outline-none disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer outline-none"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Loading state */}
          {loading && orders.length === 0 && (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <AlertCircle size={32} className="text-red-400" />
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
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="p-4 bg-[#402970]/5 rounded-2xl">
                <Package size={36} className="text-[#402970]/40" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-700">No orders yet</h3>
              <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                You haven't placed any orders yet. Start shopping!
              </p>
              <button
                onClick={onClose}
                className="mt-1 text-xs text-white bg-[#402970] hover:bg-[#2e1f52] px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer"
              >
                Browse Products
              </button>
            </div>
          )}

          {/* Active Orders */}
          {!loading && activeOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">
                Active Orders
              </h3>
              {activeOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onTrack={handleTrack}
                  trackingState={trackingData[order.id]}
                />
              ))}
            </div>
          )}

          {/* Delivered Orders */}
          {!loading && deliveredOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">
                Delivered
              </h3>
              {deliveredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onTrack={handleTrack}
                  trackingState={trackingData[order.id]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
