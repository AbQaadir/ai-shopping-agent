"use client";

import React, { useRef, useState } from "react";
import { Paperclip, ArrowUp, X } from "lucide-react";
import PillarSuggestionGrid from "./landing/PillarSuggestionGrid";

interface LandingWorkspaceProps {
  onSend: (text: string, files: File[]) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export default function LandingWorkspace({ onSend, onSuggestionClick }: LandingWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  const handleSubmit = () => {
    if (inputText.trim() || attachedFiles.length > 0) {
      onSend(inputText, attachedFiles);
      setInputText("");
      setAttachedFiles([]);
    }
  };
 
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
 
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };
 
  return (
    <div className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center gap-6 sm:gap-10 relative overflow-hidden">
 
      {/* Background glow */}
      <div className="absolute top-[10%] sm:top-[15%] left-1/2 -translate-x-1/2 w-[320px] sm:w-[700px] h-[180px] sm:h-[350px] bg-gradient-to-tr from-[#402970]/8 to-purple-400/8 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none -z-10" />
 
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto w-full gap-4 sm:gap-6 mt-2 sm:mt-4">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-purple-700 via-[#402970] to-indigo-700 bg-clip-text text-transparent max-w-2xl px-2">
          Sri Lanka&apos;s AI Shopping, Delivery & Services
        </h1>
 
        {/* Prompt input */}
        <div className="w-full relative group px-2 sm:px-0">
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-[#402970] to-purple-500 rounded-[26px] blur-md transition-opacity duration-300 pointer-events-none ${isFocused ? "opacity-15" : "opacity-[0.07] group-hover:opacity-[0.14]"}`} />
          <div className={`w-full bg-white rounded-3xl border transition-all duration-300 p-3.5 sm:p-4 flex flex-col relative ${isFocused ? "border-[#402970]/30 shadow-lg shadow-[#402970]/5" : "border-slate-100 shadow-sm"}`}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder='Try: "Show me birthday cakes under Rs. 3,000" or paste an Amazon link...'
              rows={2}
              className="w-full resize-none border-none outline-none text-slate-700 placeholder-slate-400 bg-transparent text-sm sm:text-[15px] px-1 sm:px-2 py-1 leading-relaxed min-h-[56px] sm:min-h-[72px]"
            />
 
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-2 pb-3 pt-1 border-b border-slate-50">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-medium text-slate-600">
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => setAttachedFiles((p) => p.filter((_, i) => i !== idx))} className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
 
            <div className="flex items-center justify-between pt-2 sm:pt-3 px-1 sm:px-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                onMouseDown={(e) => e.preventDefault()}
                className="p-2 sm:p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
                title="Attach files"
              >
                <Paperclip size={16} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
              <button
                onClick={handleSubmit}
                onMouseDown={(e) => e.preventDefault()}
                disabled={!inputText.trim() && attachedFiles.length === 0}
                className={`p-2 sm:p-2.5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  inputText.trim() || attachedFiles.length > 0
                    ? "bg-[#402970] hover:bg-[#33205a] text-white shadow-md shadow-purple-500/20 active:scale-95"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
 
      {/* 5-Pillar Cards */}
      <PillarSuggestionGrid onSuggestionClick={onSuggestionClick} />
 
      {/* Trust badges */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap text-[9px] sm:text-[10px] font-semibold text-slate-400 px-4">
        <span className="flex items-center gap-1">✅ Live Catalog</span>
        <span className="flex items-center gap-1">🚚 Grasshoppers</span>
        <span className="flex items-center gap-1">🔒 Secure Checkout</span>
        <span className="flex items-center gap-1">🇱🇰 Local SME Brands</span>
      </div>
    </div>
  );
}
