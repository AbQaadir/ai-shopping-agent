"use client";

import React, { useRef, useState } from "react";
import { Paperclip, ArrowRight, X, Square } from "lucide-react";
import type { InlineProduct } from "@/types/sourcing";

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
}: ChatInputAreaProps) {
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 select-none z-20">
      <div className="max-w-3xl mx-auto w-full">
        <div className={`w-full bg-white rounded-2xl p-3 flex flex-col gap-2 transition-all duration-300 border ${
          isFocused || selectedProducts.length > 0
            ? "border-[#402970] shadow-[0_4px_20px_rgba(64,41,112,0.12)]" 
            : "border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.08)]"
        }`}>

          {/* Selected products row */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-col gap-3 pb-3 border-b border-slate-100 animate-fadeIn">
              <div className="flex flex-row gap-3 overflow-x-auto pb-1 scrollbar-thin">
                {selectedProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center gap-2 bg-slate-100/90 border border-slate-200/50 rounded-xl p-1.5 pr-3 relative group max-w-[200px] shrink-0"
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
                        {prod.name || prod.title || "Product"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Suggestion Pills */}
              <div className="flex flex-wrap gap-2">
                {selectedProducts.length === 1 ? (
                  <>
                    <button
                      onClick={() => onSubmit("Chat now")}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Chat now →
                    </button>
                    <button
                      onClick={() => onSubmit("Order this")}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Order this →
                    </button>
                    <button
                      onClick={() => onSubmit("Send inquiry")}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Send inquiry →
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onSubmit("Compare")}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Compare →
                    </button>
                    <button
                      onClick={() => onSubmit("Get quotes")}
                      className="px-3.5 py-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/10 text-[#402970] rounded-full text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 select-none"
                    >
                      Get quotes →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Textarea */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="ask follow-up..."
            rows={2}
            className="w-full resize-none border-none outline-none text-slate-700 placeholder-slate-400 bg-transparent text-sm px-1 leading-relaxed min-h-[44px]"
          />

          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600 animate-fadeIn">
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button 
                    onClick={() => onRemoveFile(idx)} 
                    className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Controls row */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <button
              onClick={() => fileInputRef.current?.click()}
              onMouseDown={(e) => e.preventDefault()}
              className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-500 transition-all cursor-pointer"
              title="Attach files"
            >
              <Paperclip size={14} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              multiple 
            />
            <button
              onClick={isGenerating ? onStopGeneration : () => onSubmit()}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!isGenerating && !inputText.trim() && attachedFiles.length === 0}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isGenerating
                  ? "bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                  : inputText.trim() || attachedFiles.length > 0
                    ? "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                    : "bg-[#e2e8f0] text-white cursor-not-allowed opacity-80"
              }`}
            >
              {isGenerating ? (
                <Square size={10} fill="currentColor" strokeWidth={0} />
              ) : (
                <ArrowRight size={14} strokeWidth={2.5} />
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
