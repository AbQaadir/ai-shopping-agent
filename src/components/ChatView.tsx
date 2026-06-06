"use client";

import React, { useState, useRef } from "react";
import { 
  Paperclip, 
  ArrowUp, 
  ChevronLeft, 
  X, 
  Share2, 
  Loader2, 
  Square, 
  Box 
} from "lucide-react";
import ChatTimeline, { InlineProduct, Message } from "./ChatTimeline";
import ProductDetailsPanel from "./ProductDetailsPanel";

interface ChatViewProps {
  messages: Message[];
  isGenerating: boolean;
  onSend: (text: string, files: File[]) => void;
  onBackToLanding: () => void;
  activeQueryText: string;
  onStopGeneration?: () => void;
}

export default function ChatView({
  messages,
  isGenerating,
  onSend,
  onBackToLanding,
  activeQueryText,
  onStopGeneration
}: ChatViewProps) {
  const [inputText, setInputText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<InlineProduct[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (inputText.trim() || attachedFiles.length > 0) {
      onSend(inputText, attachedFiles);
      setInputText("");
      setAttachedFiles([]);
    }
  };

  const handleSampleClick = (sampleText: string) => {
    setInputText(sampleText);
  };

  const handleToggleSelectProduct = (product: InlineProduct) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  return (
    /* Full-height flex column — exactly fills the space below the app header */
    <div className="flex-1 w-full flex flex-col overflow-hidden h-full bg-white">

      {/* ── 1. Thin top bar ── */}
      <div className="h-12 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 select-none">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={14} />
          Product search
        </button>
        <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
          <Share2 size={13} />
          Share
        </button>
      </div>

      {/* ── 2. Body: scrollable messages + pinned input (both inside one relative container) ── */}
      <div className="flex-1 min-h-0 relative flex flex-col">

        {/* Scrollable message area — takes all remaining space */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {showDetails ? (
            <ProductDetailsPanel onClose={() => setShowDetails(false)} />
          ) : (
            <>
              {/* Messages */}
              <ChatTimeline
                messages={messages}
                isGenerating={isGenerating}
                onSampleClick={handleSampleClick}
                onViewDetailsClick={() => setShowDetails(true)}
                selectedProductIds={selectedProducts.map(p => p.id)}
                onToggleSelectProduct={handleToggleSelectProduct}
              />

              {/* "Working on it" loader shown while generating */}
              {isGenerating && (
                <div className="px-6 pb-4 flex justify-start max-w-3xl mx-auto w-full">
                  <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] space-y-4 w-full animate-fadeIn">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                      <Loader2 size={15} className="text-[#ff6600] animate-spin" />
                      <span>Working on your task</span>
                    </div>
                    <div className="pl-5 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-extrabold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-ping" />
                          Getting everything ready
                        </div>
                        <p className="text-slate-500 text-xs font-medium pl-3">
                          Searching for &ldquo;{activeQueryText || 'foldable camping chairs under $15'}&rdquo; on B2B platforms…
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-extrabold pl-3 pt-1 border-t border-slate-50">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600]" />
                          Preparing the response
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate">
                          <Box size={13} className="text-[#ff6600]" />
                          <span>Product search</span>
                          <span className="text-slate-300 font-light">|</span>
                          <span className="text-slate-500 font-medium truncate">
                            {activeQueryText || "foldable camping chair price < 15 USD"}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowDetails(true)}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
                        >
                          View details
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="h-1.5 bg-slate-100 rounded-full w-full animate-pulse" />
                        <div className="h-1.5 bg-slate-100 rounded-full w-5/6 animate-pulse [animation-delay:0.2s]" />
                        <div className="h-1.5 bg-slate-100 rounded-full w-2/3 animate-pulse [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom spacer so last message clears the gradient + input */}
              <div className="h-36" />
            </>
          )}
        </div>

        {/* ── Gradient fade — messages dissolve upward into white ── */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-28"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 55%)" }}
        />

        {/* ── 3. Pinned input — floats above the gradient ── */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 select-none">
          <div className="max-w-3xl mx-auto w-full">
            <div className="w-full bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.09)] p-3 flex flex-col gap-2">

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
                          {prod.title.length > 28 ? `${prod.title.substring(0, 28)}…` : prod.title}
                        </span>
                        <button
                          onClick={() => handleToggleSelectProduct(prod)}
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
                    <button
                      onClick={() => setShowDetails(true)}
                      className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[#ff6600] rounded transition-all cursor-pointer shadow-sm"
                    >
                      Get quotes →
                    </button>
                  </div>
                </div>
              )}

              {/* Textarea */}
              <textarea
                value={inputText}
                onChange={handleTextChange}
                onKeyDown={handleKeyPress}
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
                      <button onClick={() => removeFile(idx)} className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Controls row */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <button
                  onClick={handlePaperclipClick}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                  title="Attach files"
                >
                  <Paperclip size={15} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                <button
                  onClick={isGenerating ? onStopGeneration : handleSubmit}
                  disabled={!isGenerating && !inputText.trim() && attachedFiles.length === 0}
                  className={`p-2 rounded-full flex items-center justify-center transition-all ${
                    isGenerating
                      ? "bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                      : inputText.trim() || attachedFiles.length > 0
                        ? "bg-slate-900 hover:bg-slate-700 text-white cursor-pointer"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {isGenerating
                    ? <Square size={12} fill="currentColor" strokeWidth={0} />
                    : <ArrowUp size={15} strokeWidth={2.5} />
                  }
                </button>
              </div>

            </div>
          </div>
        </div>
        {/* ── end pinned input ── */}

      </div>
      {/* ── end body ── */}

    </div>
  );
}
