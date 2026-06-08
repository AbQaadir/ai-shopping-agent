"use client";

import React from "react";
import { Wrench, Star, Phone } from "lucide-react";
import type { ServiceListing } from "@/types/sourcing";

interface ServiceListingCardProps {
  listing: ServiceListing;
  onSampleClick?: (text: string) => void;
}

export default function ServiceListingCard({ listing, onSampleClick }: ServiceListingCardProps) {
  if (listing.needsCityInput) {
    return (
      <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-slate-100">
          <Wrench size={14} className="text-orange-600" />
          <span className="text-xs font-extrabold text-slate-700">{listing.categoryLabel}</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600 font-medium">{listing.cityPrompt}</p>
          <div className="flex flex-wrap gap-2">
            {["Colombo", "Kandy", "Galle", "Negombo", "Kurunegala"].map((city) => (
              <button
                key={city}
                onClick={() => onSampleClick?.(`Find ${listing.categoryLabel.toLowerCase()} in ${city}`)}
                className="px-3 py-1.5 text-xs font-semibold text-[#402970] bg-[#402970]/5 hover:bg-[#402970]/10 border border-[#402970]/10 rounded-full transition-colors cursor-pointer"
              >
                📍 {city}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-orange-600" />
          <span className="text-xs font-extrabold text-slate-700">{listing.categoryLabel}</span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">{listing.providers.length} verified providers</span>
      </div>

      {listing.cityPrompt && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <p className="text-[10px] font-medium text-amber-700">{listing.cityPrompt}</p>
        </div>
      )}

      <div className="p-4 space-y-3">
        {listing.providers.map((provider) => (
          <div key={provider.id} className="border border-slate-100 rounded-xl p-3 hover:border-slate-200 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-extrabold text-slate-800 truncate">{provider.name}</span>
                  {provider.verified && (
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded border border-emerald-100">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{provider.specialization}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 justify-end">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-extrabold text-slate-700">{provider.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400">({provider.reviewCount})</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{provider.experienceYears} yrs exp</div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50">
              <div>
                <div className="text-xs font-bold text-slate-700">{provider.pricingLKR}</div>
                <div className="text-[10px] text-slate-400">⚡ {provider.responseTime}</div>
              </div>
              <a
                href={`tel:${provider.phone.replace(/\s|\*/g, "")}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#402970] hover:bg-[#33205a] text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Phone size={10} />
                Book Now
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
