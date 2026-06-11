"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useSourcing } from "@/context/SourcingContext";

interface LanguagePopoverProps {
  onClose?: () => void;
  align?: "bottom" | "right";
}

export default function LanguagePopover({ onClose, align = "bottom" }: LanguagePopoverProps) {
  const { currency, setCurrency } = useSourcing();
  const [selectedCurrency, setSelectedCurrency] = useState(currency.toUpperCase());

  const handleSave = () => {
    setCurrency(selectedCurrency);
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
        <h4 className="font-extrabold text-slate-800 text-sm">Set language and currency</h4>
        <p className="text-slate-500 text-xs leading-relaxed">
          Select your preferred language and currency. You can update the settings at any time.
        </p>

        {/* Language Selector */}
        <div className="space-y-1.5">
          <label className="text-slate-700 text-xs font-semibold">Language</label>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-all focus-within:border-[#402970] relative">
            <select className="w-full appearance-none px-3 py-2 bg-transparent text-xs text-slate-700 font-medium outline-none cursor-pointer">
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="zh">中文</option>
            </select>
            <div className="h-5 w-[1px] bg-slate-200 flex-shrink-0"></div>
            <div className="px-3 flex items-center justify-center pointer-events-none">
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Currency Selector */}
        <div className="space-y-1.5">
          <label className="text-slate-700 text-xs font-semibold">Currency</label>
          <div className="flex items-center justify-between border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-all focus-within:border-[#402970] relative">
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full appearance-none px-3 py-2 bg-transparent text-xs text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="LKR">LKR - Sri Lankan Rupee</option>
            </select>
            <div className="h-5 w-[1px] bg-slate-200 flex-shrink-0"></div>
            <div className="px-3 flex items-center justify-center pointer-events-none">
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </div>

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
