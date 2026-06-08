"use client";

import React from "react";

interface PillarSuggestionGridProps {
  onSuggestionClick: (suggestion: string) => void;
}

const PILLARS = [
  {
    icon: "🛍️",
    label: "Search local products",
    hint: "Show me chocolate cakes under Rs. 3,000",
    color: "from-violet-50 to-purple-50",
    border: "border-violet-100",
    iconBg: "bg-violet-100",
  },
  {
    icon: "🚚",
    label: "Check delivery to my city",
    hint: "Can you deliver flowers to Kandy tomorrow?",
    color: "from-emerald-50 to-teal-50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100",
  },
  {
    icon: "🇱🇰",
    label: "Find local Sri Lankan brands",
    hint: "Show me handmade gifts from local artisans",
    color: "from-amber-50 to-orange-50",
    border: "border-amber-100",
    iconBg: "bg-amber-100",
  },
  {
    icon: "🌍",
    label: "Estimate Amazon import cost",
    hint: "https://amazon.com/dp/B0EXAMPLE — what will it cost in Sri Lanka?",
    color: "from-blue-50 to-sky-50",
    border: "border-blue-100",
    iconBg: "bg-blue-100",
  },
  {
    icon: "🔧",
    label: "Book a home repair service",
    hint: "My AC is not working, need a technician in Colombo",
    color: "from-rose-50 to-red-50",
    border: "border-rose-100",
    iconBg: "bg-rose-100",
  },
];

export default function PillarSuggestionGrid({ onSuggestionClick }: PillarSuggestionGridProps) {
  return (
    <div className="w-full px-2 sm:px-0">
      <p className="text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 sm:mb-5">
        5 Ways I Can Help You
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {PILLARS.map((pillar, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(pillar.hint)}
            onMouseDown={(e) => e.preventDefault()}
            className={`flex flex-col items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-2xl border bg-gradient-to-br ${pillar.color} ${pillar.border} hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-left cursor-pointer group`}
          >
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${pillar.iconBg} flex items-center justify-center text-base sm:text-lg shadow-sm`}>
              {pillar.icon}
            </div>
            <span className="text-[11px] sm:text-xs font-extrabold text-slate-700 leading-tight group-hover:text-slate-900 transition-colors">
              {pillar.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
