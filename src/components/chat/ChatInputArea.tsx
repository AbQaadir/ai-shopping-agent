"use client";

import React, { useRef, useState } from "react";
import { Paperclip, ArrowUp, X, Square } from "lucide-react";
import type { InlineProduct } from "@/types/sourcing";

interface ChatInputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  attachedFiles: File[];
  onRemoveFile: (index: number) => void;
  onAttachFile: (files: File[]) => void;
  onSubmit: () => void;
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
          isFocused 
            ? "border-[#402970]/35 shadow-[0_4px_20px_rgba(64,41,112,0.1)]" 
            : "border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.08)]"
        }`}>

          {/* Selected products row */}
          {selectedProducts.length > 0 && (
            <div className="flex flex-col gap-2 pb-2 border-b border-slate-100 animate-fadeIn">
              <div className="flex flex-wrap gap-1.5">
                {selectedProducts.map((prod) => (
                  <div
                     key={prod.id}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                  >
                    <span className="text-sm select-none">{prod.image}</span>
                    <span className="truncate max-w-[160px] font-medium leading-none">
                      {((prod.name || prod.title) ?? "").length > 28
                        ? `${((prod.name || prod.title) ?? "").substring(0, 28)}…`
                        : ((prod.name || prod.title) ?? "Product")}
                    </span>
                    <button
                      onClick={() => onToggleSelectProduct(prod)}
                      className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <button
                  onClick={() => alert(`Comparing ${selectedProducts.length} items side-by-side.`)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded transition-all cursor-pointer shadow-sm"
                >
                  Compare →
                </button>
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
            placeholder="Ask follow-up…"
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
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              title="Attach files"
            >
              <Paperclip size={15} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              multiple 
            />
            <button
              onClick={isGenerating ? onStopGeneration : onSubmit}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!isGenerating && !inputText.trim() && attachedFiles.length === 0}
              className={`p-2 rounded-full flex items-center justify-center transition-all ${
                isGenerating
                  ? "bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                  : inputText.trim() || attachedFiles.length > 0
                    ? "bg-slate-900 hover:bg-slate-700 text-white cursor-pointer"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
              }`}
            >
              {isGenerating ? (
                <Square size={12} fill="currentColor" strokeWidth={0} />
              ) : (
                <ArrowUp size={15} strokeWidth={2.5} />
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
