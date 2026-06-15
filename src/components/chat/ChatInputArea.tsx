"use client";

import { useSourcing } from "@/context/SourcingContext";
import type { InlineProduct } from "@/types/sourcing";
import { cleanProductTitle } from "@/lib/product";
import { ArrowRight, Paperclip, Square, X, Search, Plus, Send } from "lucide-react";
import React, { useRef, useState, useEffect } from "react";

interface ChatInputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  attachedFiles: File[];
  onRemoveFile: (index: number) => void;
  onAttachFile: (files: File[]) => void;
  onSubmit: (overrideText?: string) => void;
  isGenerating: boolean;
  onStopGeneration?: () => void;
  selectedProducts: InlineProduct[];
  onToggleSelectProduct: (product: InlineProduct) => void;
  chatHistory?: { role: "user" | "assistant"; content: string }[];
}

export default function ChatInputArea({
  inputText,
  setInputText,
  attachedFiles,
  onRemoveFile,
  onAttachFile,
  onSubmit,
  isGenerating,
  onStopGeneration,
  selectedProducts,
  onToggleSelectProduct,
  chatHistory = [],
}: ChatInputAreaProps) {
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleAddToCart } = useSourcing();

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    const hasUserHistory = chatHistory.some((h) => h.role === "user");
    if (!inputText || inputText.trim().length < 4 || isGenerating || hasUserHistory) {
      setSuggestions([]);
      setShowDropdown(false);
      setSelectedIndex(-1);
      return;
    }

    const controller = new AbortController();
    const fetchSuggestions = async () => {
      try {
        const res = await fetch("/api/chat/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputText,
            chatHistory,
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
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

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => {
      clearTimeout(debounceTimer);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAttachFile(Array.from(e.target.files));
    }
  };

  const handleCompareClick = () => {
    if (selectedProducts.length === 0) return;
    
    let promptText = "Please compare the following selected products in detail:\n\n";
    selectedProducts.forEach((prod, index) => {
      const name = prod.name || prod.title || "Unknown Product";
      const priceStr = prod.price ? `Rs. ${prod.price.toLocaleString()}` : (prod.priceDisplay || "N/A");
      const supplier = prod.supplier || "N/A";
      const rating = prod.rating ? `${prod.rating} / 5` : "N/A";
      const years = prod.years ? `${prod.years} years on platform` : "N/A";
      const moq = prod.moq || "N/A";
      const stock = prod.inStock !== false ? "In Stock" : "Out of Stock";
      
      promptText += `${index + 1}. **${name}**\n`;
      promptText += `   - Price: ${priceStr}\n`;
      promptText += `   - Supplier: ${supplier} (${years})\n`;
      promptText += `   - Rating: ${rating}\n`;
      promptText += `   - Min Order Quantity (MOQ): ${moq}\n`;
      promptText += `   - Availability: ${stock}\n`;
      if (prod.description) {
        promptText += `   - Description: ${prod.description}\n`;
      }
      promptText += `\n`;
    });
    
    promptText += "Analyze these items and provide a structured comparison (e.g. comparing cost effectiveness, quality/ratings, and delivery readiness). Conclude with a clear recommendation on which product offers the best value.";
    
    onSubmit(promptText);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 select-none z-20">
      <div className="max-w-3xl mx-auto w-full relative">
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
        <div className={`w-full bg-white flex flex-col transition-all duration-300 border ${
          selectedProducts.length > 0 
            ? "rounded-[24px] p-3.5 gap-3" 
            : "rounded-full py-1.5 pl-4 pr-1.5"
        } ${
          isFocused
            ? "border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
            : "border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)]"
        }`}>
          {/* Selected products row */}
          {selectedProducts.length > 0 && (
            <div className="w-full flex flex-col gap-2.5 pb-2.5 border-b border-slate-100 animate-fadeIn">
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
                  }}
                  className="px-3.5 py-1.5 bg-[#402970] text-white hover:bg-[#402970]/90 rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                >
                  Add to Cart →
                </button>
                {selectedProducts.length === 1 ? (
                  <>
                    <button
                      onClick={() => onSubmit("Order this")}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Order →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onSubmit("Order selected")}
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
          )}

          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-50/50 border border-slate-100/50 rounded-xl self-start animate-fadeIn">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-150 rounded-full text-xs font-medium text-slate-600 animate-fadeIn">
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button
                    onClick={() => onRemoveFile(idx)}
                    className="p-0.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Row */}
          <div className={`w-full flex items-center gap-2 ${
            selectedProducts.length > 0 ? "px-1 py-0.5" : ""
          }`}>
            <button
              onClick={() => fileInputRef.current?.click()}
              onMouseDown={(e) => e.preventDefault()}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-all cursor-pointer shrink-0 relative"
              title="Attach files"
            >
              <Plus size={18} />
              {attachedFiles.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />

            <textarea
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
              placeholder="Ask follow-up..."
              rows={1}
              className="flex-1 resize-none border-none outline-none text-slate-700 placeholder-slate-400 bg-transparent text-sm py-1.5 leading-normal max-h-[120px] overflow-y-auto"
            />

            <button
              onClick={isGenerating ? onStopGeneration : () => onSubmit()}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!isGenerating && !inputText.trim() && attachedFiles.length === 0}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                isGenerating
                  ? "bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                  : inputText.trim() || attachedFiles.length > 0
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
