"use client";

import React from "react";
import { Sparkles, ShoppingBag, Truck, Gift, Wrench } from "lucide-react";

interface PillarSuggestionGridProps {
  onSuggestionClick: (suggestion: string) => void;
}

const PILLARS = [
  {
    icon: <ShoppingBag size={20} className="text-violet-600" />,
    label: "Search products",
    hint: "Show me chocolate cakes under Rs. 3,000",
    color: "from-violet-50/50 to-purple-50/50 hover:from-violet-50 hover:to-purple-50",
    border: "border-violet-100/80 hover:border-violet-200",
    iconBg: "bg-violet-100/80",
    shadow: "hover:shadow-violet-100/40",
  },
  {
    icon: <Truck size={20} className="text-emerald-600" />,
    label: "Check delivery",
    hint: "Can you deliver flowers to Kandy tomorrow?",
    color: "from-emerald-50/50 to-teal-50/50 hover:from-emerald-50 hover:to-teal-50",
    border: "border-emerald-100/80 hover:border-emerald-200",
    iconBg: "bg-emerald-100/80",
    shadow: "hover:shadow-emerald-100/40",
  },
  {
    icon: <Gift size={20} className="text-amber-600" />,
    label: "Local brands",
    hint: "Show me handmade gifts from local Sri Lankan artisans",
    color: "from-amber-50/50 to-orange-50/50 hover:from-amber-50 hover:to-orange-50",
    border: "border-amber-100/80 hover:border-amber-200",
    iconBg: "bg-amber-100/80",
    shadow: "hover:shadow-amber-100/40",
  },
  {
    icon: <Wrench size={20} className="text-rose-600" />,
    label: "Book services",
    hint: "My AC is not working, need a technician in Colombo",
    color: "from-rose-50/50 to-red-50/50 hover:from-rose-50 hover:to-red-50",
    border: "border-rose-100/80 hover:border-rose-200",
    iconBg: "bg-rose-100/80",
    shadow: "hover:shadow-rose-100/40",
  },
];

export default function PillarSuggestionGrid({ onSuggestionClick }: PillarSuggestionGridProps) {
  return (
    <div className="w-full">
      {/* Small uppercase subtitle */}
      <div className="flex items-center justify-center gap-1.5 mb-4 px-4 select-none animate-fadeIn">
        <Sparkles size={12} className="text-[#402970]/60 animate-pulse" />
        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
          Explore Sourcing Options
        </p>
      </div>

      {/* Grid on desktop, horizontal carousel on mobile */}
      <div className="w-full overflow-hidden">
        {/* Mobile Horizontal Carousel */}
        <div className="md:hidden flex overflow-x-auto gap-3.5 pb-4 px-4 snap-x snap-mandatory scrollbar-none scroll-smooth">
          {PILLARS.map((pillar, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(pillar.hint)}
              onMouseDown={(e) => e.preventDefault()}
              className={`w-[260px] shrink-0 snap-start flex flex-col items-start gap-3 p-4 rounded-2xl border bg-gradient-to-br ${pillar.color} ${pillar.border} shadow-[0_2px_8px_rgba(0,0,0,0.02)] active:scale-[0.97] transition-all duration-200 text-left cursor-pointer group`}
            >
              <div className={`w-9 h-9 rounded-xl ${pillar.iconBg} flex items-center justify-center shadow-xs`}>
                {pillar.icon}
              </div>
              <div className="space-y-1">
                <span className="text-[13px] font-bold text-slate-800 leading-tight">
                  {pillar.label}
                </span>
                <p className="text-[11px] text-slate-500 font-medium leading-normal line-clamp-2">
                  {pillar.hint}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid grid-cols-4 gap-4 max-w-4xl mx-auto px-6">
          {PILLARS.map((pillar, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(pillar.hint)}
              onMouseDown={(e) => e.preventDefault()}
              className={`flex flex-col items-start gap-3.5 p-4.5 rounded-2xl border bg-gradient-to-br ${pillar.color} ${pillar.border} shadow-[0_2px_10px_rgba(0,0,0,0.01)] hover:shadow-md ${pillar.shadow} hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 text-left cursor-pointer group`}
            >
              <div className={`w-10 h-10 rounded-xl ${pillar.iconBg} flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform duration-300`}>
                {pillar.icon}
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-bold text-slate-800 group-hover:text-[#402970] transition-colors leading-tight">
                  {pillar.label}
                </span>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed group-hover:text-slate-650 transition-colors">
                  {pillar.hint}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
