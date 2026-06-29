"use client";

import { useSourcing } from "@/context/SourcingContext";
import type { InlineProduct } from "@/types/sourcing";
import { cleanProductTitle } from "@/lib/product";
import { ArrowRight, Paperclip, Square, X, Search, Plus, Send } from "lucide-react";
import React, { useRef, useState, useEffect } from "react";

interface ChatInputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSubmit: (overrideText?: string) => void;
  isGenerating: boolean;
  onStopGeneration?: () => void;
  selectedProducts: InlineProduct[];
  onToggleSelectProduct: (product: InlineProduct) => void;
  chatHistory?: { role: "user" | "assistant"; content: string }[];
  isCheckoutActive?: boolean;
}

export default function ChatInputArea({
  inputText,
  setInputText,
  onSubmit,
  isGenerating,
  onStopGeneration,
  selectedProducts,
  onToggleSelectProduct,
  chatHistory = [],
  isCheckoutActive = false,
}: ChatInputAreaProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { handleAddToCart, handleBuyProduct, handleOrderCart, isSharedReadOnly, setSelectedProducts } = useSourcing();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const autocompleteCache = useRef<Record<string, string[]>>({});
  const hasFetchedForCurrentInput = useRef(false);
  const fetchedSuggestionsForInput = useRef<string[]>([]);

  useEffect(() => {
    const tx = textareaRef.current;
    if (tx) {
      tx.style.height = "auto";
      tx.style.height = `${tx.scrollHeight}px`;
    }
  }, [inputText]);

  useEffect(() => {
    const hasUserHistory = chatHistory.some((h) => h.role === "user");
    const words = inputText.trim().split(/\s+/).filter(Boolean);

    if (!inputText || words.length < 4 || words.length > 7 || isGenerating || hasUserHistory) {
      setSuggestions([]);
      setShowDropdown(false);
      setSelectedIndex(-1);
      hasFetchedForCurrentInput.current = false;
      fetchedSuggestionsForInput.current = [];
      return;
    }

    if (hasFetchedForCurrentInput.current) {
      if (fetchedSuggestionsForInput.current.length > 0) {
        setSuggestions(fetchedSuggestionsForInput.current);
        setShowDropdown(true);
      }
      return;
    }

    hasFetchedForCurrentInput.current = true;

    const controller = new AbortController();
    const fetchSuggestions = async () => {
      try {
        const res = await fetch("/api/chat/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputText,
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const suggestionsList = data.suggestions || [];
          fetchedSuggestionsForInput.current = suggestionsList;

          if (suggestionsList.length > 0) {
            setSuggestions(suggestionsList);
            setShowDropdown(true);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Autocomplete fetch error:", err);
        }
      }
    };

    fetchSuggestions();

    return () => {
      controller.abort();
    };
  }, [inputText, chatHistory, isGenerating]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        setInputText(suggestions[selectedIndex]);
        setShowDropdown(false);
        setSelectedIndex(-1);
        return;
      }
      if (e.key === "Escape" || e.key === "Tab") {
        setShowDropdown(false);
        setSelectedIndex(-1);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };



  const handleCompareClick = () => {
    if (selectedProducts.length === 0) return;
    
    onSubmit(inputText.trim() ? inputText : "Compare these products");
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 select-none z-20">
      <div className="max-w-3xl mx-auto w-full relative group">
        {/* Autocomplete Dropdown floating below the input card */}
        {showDropdown && suggestions.length > 0 && (
          <div 
            className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-md rounded-xl border border-slate-100 shadow-[0_12px_30px_rgba(0,0,0,0.06),0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col p-1.5 z-30 animate-fadeInScale"
          >
            {suggestions.map((suggestion, index) => {
              const queryTrim = inputText.trim();
              const queryLower = queryTrim.toLowerCase();
              const suggLower = suggestion.toLowerCase();
              const hasPrefix = suggLower.startsWith(queryLower);
              const prefix = hasPrefix ? suggestion.substring(0, queryTrim.length) : "";
              const suffix = hasPrefix ? suggestion.substring(queryTrim.length) : suggestion;

              return (
                <button
                  key={index}
                  onMouseDown={(e) => e.preventDefault()} // Prevents textarea blur
                  onClick={() => {
                    setInputText(suggestion);
                    setShowDropdown(false);
                    setSelectedIndex(-1);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-3.5 py-2.5 text-sm rounded-lg transition-all duration-150 flex items-center justify-between group cursor-pointer ${
                    selectedIndex === index
                      ? "bg-[#402970]/5 text-[#402970] font-semibold"
                      : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Search 
                      size={13} 
                      className={`shrink-0 transition-colors ${
                        selectedIndex === index ? "text-[#402970]" : "text-slate-400 group-hover:text-[#402970]/60"
                      }`} 
                    />
                    <span className="truncate">
                      {hasPrefix ? (
                        <>
                          <span className="text-slate-400 font-normal">{prefix}</span>
                          <span className={`font-semibold ${selectedIndex === index ? "text-[#402970]" : "text-slate-850"}`}>
                            {suffix}
                          </span>
                        </>
                      ) : (
                        <span className={`font-semibold ${selectedIndex === index ? "text-[#402970]" : "text-slate-700"}`}>
                          {suggestion}
                        </span>
                      )}
                    </span>
                  </div>
                  {selectedIndex === index && (
                    <span className="text-[10px] text-[#402970] font-bold bg-[#402970]/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 animate-fadeIn select-none">
                      Select
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        
        {isCheckoutActive && !isGenerating && !isSharedReadOnly && (
          <button
            onClick={() => onSubmit("continue checkout")}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute -top-11 right-1.5 bg-[#402970] text-white hover:bg-[#33205a] active:scale-95 transition-all duration-300 px-4 py-2 rounded-full text-xs font-bold shadow-[0_4px_12px_rgba(64,41,112,0.25)] hover:shadow-[0_6px_20px_rgba(64,41,112,0.35)] flex items-center gap-1.5 cursor-pointer z-30 animate-fadeInScale group/resume"
          >
            <span>Resume Checkout</span>
            <ArrowRight size={13} className="transition-transform group-hover/resume:translate-x-0.5" />
          </button>
        )}

        {/* Background glow for chat input */}
        <div className={`absolute -inset-1 bg-gradient-to-r from-[#402970] to-purple-500 blur-lg transition-all duration-300 pointer-events-none rounded-[28px] ${
          isFocused ? "opacity-40" : "opacity-20 group-hover:opacity-30"
        }`} />

        <div className={`w-full bg-white flex flex-col transition-all duration-300 border relative rounded-[24px] ${
          selectedProducts.length > 0 
            ? "p-3.5" 
            : "py-1.5 pl-2 pr-1.5"
        } ${
          isFocused
            ? "border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
            : "border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)]"
        }`}>
          {/* Selected products row */}
          <div
            className={`grid transition-[grid-template-rows,opacity,margin,padding] duration-300 ease-in-out w-full border-slate-100 ${
              selectedProducts.length > 0
                ? "grid-rows-[1fr] opacity-100 pb-2.5 mb-3 border-b"
                : "grid-rows-[0fr] opacity-0 pb-0 mb-0 border-b-0"
            }`}
          >
            <div className="overflow-hidden flex flex-col gap-2.5">
              <div className="flex flex-row gap-3 overflow-x-auto pb-1 scrollbar-thin">
                {selectedProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center gap-2 bg-slate-50 border border-slate-100/85 rounded-xl p-1.5 pr-3 relative group max-w-[200px] shrink-0"
                  >
                    {/* Absolute close button */}
                    <button
                      onClick={() => onToggleSelectProduct(prod)}
                      className="absolute -top-1 -right-1 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full p-0.5 shadow-sm border border-slate-200 cursor-pointer transition-colors z-10"
                      title="Remove product"
                    >
                      <X size={10} />
                    </button>

                    {/* Thumbnail */}
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name || prod.title || "Product"}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-lg select-none">{prod.image || "🛍️"}</span>
                      )}
                    </div>

                    {/* Title */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2 truncate-line-clamp break-words">
                        {cleanProductTitle(prod.name || prod.title)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Suggestion Pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    handleAddToCart(selectedProducts);
                    setSelectedProducts([]);
                  }}
                  className="px-3.5 py-1.5 bg-[#402970] text-white hover:bg-[#402970]/90 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                >
                  Add to Cart →
                </button>
                {selectedProducts.length === 1 ? (
                  <>
                    <button
                      onClick={() => handleBuyProduct(selectedProducts[0])}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Order →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleOrderCart(selectedProducts)}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Order →
                    </button>
                    <button
                      onClick={handleCompareClick}
                      className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Compare →
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Input Row */}
          <div className={`w-full flex items-center gap-2 ${
            selectedProducts.length > 0 ? "px-1 py-0.5" : ""
          } ${isSharedReadOnly ? "opacity-60 pointer-events-none" : ""}`}>
            <button
              disabled={true}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 transition-all cursor-not-allowed shrink-0 relative"
              title="File attachment disabled"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                setTimeout(() => {
                  setShowDropdown(false);
                  setSelectedIndex(-1);
                }, 150);
              }}
              placeholder={isSharedReadOnly ? "Read-only mode..." : "Ask follow-up..."}
              disabled={isSharedReadOnly}
              rows={1}
              className="flex-1 resize-none border-none outline-none text-slate-700 placeholder-slate-400 bg-transparent text-sm py-1.5 leading-normal max-h-[120px] overflow-y-auto scrollbar-none"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            />

            <button
              onClick={isGenerating ? onStopGeneration : () => onSubmit()}
              onMouseDown={(e) => e.preventDefault()}
              disabled={isSharedReadOnly || (!isGenerating && !inputText.trim())}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                isGenerating
                  ? "bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                  : inputText.trim()
                    ? "bg-[#402970] hover:bg-[#33205a] text-white cursor-pointer shadow-sm"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
            >
              {isGenerating ? (
                <Square size={10} fill="currentColor" strokeWidth={0} />
              ) : (
                <Send size={14} className="ml-[1px]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
