"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useSourcingStore } from "@/store/useSourcingStore";

interface LanguagePopoverProps {
  onClose?: () => void;
  align?: "bottom" | "right";
}

const languages = [
  { value: "en", label: "English" },
  { value: "si", label: "සිංහල (Sinhala)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
];

const currencies = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "LKR", label: "LKR - Sri Lankan Rupee" },
];

export default function LanguagePopover({ onClose, align = "bottom" }: LanguagePopoverProps) {
  const currency = useSourcingStore(state => state.currency);
  const setCurrency = useSourcingStore(state => state.setCurrency);
  const [selectedCurrency, setSelectedCurrency] = useState(currency.toUpperCase());
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);

  const handleSave = () => {
    setCurrency(selectedCurrency);
    onClose?.();
  };

  const toggleLanguageDropdown = () => {
    setIsLanguageOpen(!isLanguageOpen);
    setIsCurrencyOpen(false);
  };

  const toggleCurrencyDropdown = () => {
    setIsCurrencyOpen(!isCurrencyOpen);
    setIsLanguageOpen(false);
  };

  return (
    <div className={`absolute w-[320px] bg-white border border-slate-100 rounded-2xl shadow-xl p-5 z-50 animate-fadeIn text-left ${
      align === "right" 
        ? "bottom-0 left-full ml-3" 
        : "top-full left-1/2 -translate-x-1/2 mt-1"
    }`}>
      {/* Arrow indicator pointing up or left */}
      {align === "right" ? (
        <div className="absolute bottom-[18px] -left-1.5 w-3 h-3 bg-white border-b border-l border-slate-100 rotate-45"></div>
      ) : (
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45"></div>
      )}

      <div className="space-y-4 relative">
        <h4 className="font-extrabold text-slate-800 text-sm">Set language and currency</h4>
        <p className="text-slate-500 text-xs leading-relaxed">
          Select your preferred language and currency. You can update the settings at any time.
        </p>

        {/* Language Selector */}
        <div className="space-y-1.5 relative">
          <label className="text-slate-700 text-xs font-semibold">Language</label>
          <button
            type="button"
            onClick={toggleLanguageDropdown}
            className="w-full flex items-center justify-between border border-slate-200 rounded-lg bg-white px-3 py-2 text-xs text-slate-700 font-medium hover:border-slate-350 transition-all outline-none cursor-pointer focus:border-[#402970] relative"
          >
            <span>{languages.find(l => l.value === selectedLanguage)?.label}</span>
            <div className="flex items-center gap-2">
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isLanguageOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          
          {isLanguageOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsLanguageOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-lg shadow-lg py-1 z-20 max-h-48 overflow-y-auto animate-fadeIn select-none">
                {languages.map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => {
                      setSelectedLanguage(lang.value);
                      setIsLanguageOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                      selectedLanguage === lang.value
                        ? "bg-[#402970]/5 text-[#402970] font-bold"
                        : "text-slate-650 hover:bg-slate-50 hover:text-slate-900 font-medium"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Currency Selector */}
        <div className="space-y-1.5 relative">
          <label className="text-slate-700 text-xs font-semibold">Currency</label>
          <button
            type="button"
            onClick={toggleCurrencyDropdown}
            className="w-full flex items-center justify-between border border-slate-200 rounded-lg bg-white px-3 py-2 text-xs text-slate-700 font-medium hover:border-slate-350 transition-all outline-none cursor-pointer focus:border-[#402970] relative"
          >
            <span>{currencies.find(c => c.value === selectedCurrency)?.label}</span>
            <div className="flex items-center gap-2">
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isCurrencyOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          
          {isCurrencyOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsCurrencyOpen(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-100 rounded-lg shadow-lg py-1 z-20 max-h-48 overflow-y-auto animate-fadeIn select-none">
                {currencies.map((curr) => (
                  <button
                    key={curr.value}
                    type="button"
                    onClick={() => {
                      setSelectedCurrency(curr.value);
                      setIsCurrencyOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                      selectedCurrency === curr.value
                        ? "bg-[#402970]/5 text-[#402970] font-bold"
                        : "text-slate-650 hover:bg-slate-50 hover:text-slate-900 font-medium"
                    }`}
                  >
                    {curr.label}
                  </button>
                ))}
              </div>
            </>
          )}
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
