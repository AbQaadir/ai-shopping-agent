"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useSourcingStore } from "@/store/useSourcingStore";

interface LocationPopoverProps {
  onClose?: () => void;
  align?: "bottom" | "right";
}

const COUNTRIES = [
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
];

export default function LocationPopover({ onClose, align = "bottom" }: LocationPopoverProps) {
  const country = useSourcingStore(state => state.country);
  const setCountry = useSourcingStore(state => state.setCountry);
  const [selectedCountry, setSelectedCountry] = useState(country.toUpperCase());

  const handleSave = () => {
    setCountry(selectedCountry);
    onClose?.();
  };

  return (
    <div className={`absolute w-[320px] bg-white border border-slate-100 rounded-2xl shadow-xl p-5 z-50 animate-fadeIn text-left ${
      align === "right" 
        ? "bottom-0 left-full ml-3" 
        : "top-full left-1/2 -translate-x-1/2 mt-1"
    }`}>
      {/* Arrow indicator pointing up or left */}
      {align === "right" ? (
        <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border-b border-l border-slate-100 rotate-45"></div>
      ) : (
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45"></div>
      )}

      <div className="space-y-4 relative">
        <h4 className="font-extrabold text-slate-800 text-sm">Specify your location</h4>
        <p className="text-slate-500 text-xs leading-relaxed">
          Shipping options and fees vary based on your location
        </p>

        <button 
          onClick={onClose}
          className="w-full bg-[#402970] hover:bg-[#33205a] active:scale-98 text-white text-xs font-bold py-2.5 rounded-full transition-all duration-200 shadow-md shadow-purple-500/10 cursor-pointer"
        >
          Sign in to add address
        </button>

        <div className="flex items-center gap-2 text-slate-350 text-[11px] font-bold select-none justify-center">
          <div className="h-[1px] flex-1 bg-slate-100"></div>
          <span>Or</span>
          <div className="h-[1px] flex-1 bg-slate-100"></div>
        </div>

        {/* Dropdown Input */}
        <div className="space-y-1">
          <label className="text-slate-500 text-[11px] font-bold">Country</label>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg bg-slate-50/50 hover:border-slate-300 transition-all focus-within:border-[#402970] relative">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full appearance-none px-3 py-2 bg-transparent text-xs text-slate-700 font-bold outline-none cursor-pointer"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.code})
                </option>
              ))}
            </select>
            <div className="px-3 flex items-center justify-center pointer-events-none">
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Postal Code Input */}
        <input
          type="text"
          placeholder="Enter ZIP or postal code"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#402970] focus:ring-1 focus:ring-[#402970] transition-all"
        />

        {/* Save Button */}
        <button 
          onClick={handleSave}
          className="w-full bg-[#402970] hover:bg-[#33205a] active:scale-98 text-white text-xs font-bold py-2.5 rounded-full transition-all duration-200 shadow-md shadow-purple-500/10 cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}
