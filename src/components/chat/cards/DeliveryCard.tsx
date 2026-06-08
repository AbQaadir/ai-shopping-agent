"use client";

import React from "react";
import { Truck, MapPin, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { DeliveryResult } from "@/types/sourcing";

interface DeliveryCardProps {
  delivery: DeliveryResult;
}

function formatLKR(amount?: number) {
  if (!amount) return "N/A";
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

export default function DeliveryCard({ delivery }: DeliveryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100">
        <Truck size={14} className="text-emerald-600" />
        <span className="text-xs font-extrabold text-slate-700">Grasshoppers Delivery Check</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-800">{delivery.city}</span>
          </div>
          {delivery.canDeliver ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <CheckCircle size={12} className="text-emerald-600" />
              <span className="text-xs font-extrabold text-emerald-700">Available</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full border border-red-100">
              <XCircle size={12} className="text-red-500" />
              <span className="text-xs font-extrabold text-red-600">Not Available</span>
            </div>
          )}
        </div>

        {delivery.canDeliver && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <div className="text-xl font-extrabold text-[#402970]">
                {formatLKR(delivery.flatRateLKR)}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Flat Delivery Rate</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <div className="text-sm font-extrabold text-slate-800">
                {delivery.deliveryDate || "Tomorrow"}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Estimated Arrival</div>
            </div>
          </div>
        )}

        {delivery.perishableAllowed === false && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-amber-700">
              Perishable items (cakes, fresh flowers) cannot be delivered to this city.
            </p>
          </div>
        )}

        {delivery.warning && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-amber-700">{delivery.warning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
