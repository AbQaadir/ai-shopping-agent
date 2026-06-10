"use client";

import type { InlineProduct, Message } from "@/types/sourcing";
import {
  Check,
  ChevronLeft,
  Share2
} from "lucide-react";
import { useEffect, useState } from "react";
import ChatInputArea from "./ChatInputArea";
import ChatMessageTimeline from "./ChatMessageTimeline";
import ProductCatalogModal from "./ProductCatalogModal";

interface ChatWorkspaceProps {
  activeHistoryId?: string;
  messages: Message[];
  isGenerating: boolean;
  onSend: (text: string, files: File[]) => void;
  onBackToLanding: () => void;
  activeQueryText: string;
  onStopGeneration?: () => void;
  onBuyProduct?: (product: InlineProduct) => void;
}

export default function ChatWorkspace({
  activeHistoryId,
  messages,
  isGenerating,
  onSend,
  onBackToLanding,
  activeQueryText,
  onStopGeneration,
  onBuyProduct
}: ChatWorkspaceProps) {
  const [inputText, setInputText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<InlineProduct[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Reset internal states when activeHistoryId changes to avoid unmounting ChatWorkspace
  useEffect(() => {
    setInputText("");
    setAttachedFiles([]);
    setSelectedProducts([]);
  }, [activeHistoryId]);

  // Product search modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalProducts, setModalProducts] = useState<InlineProduct[]>([]);
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  const handleViewMoreProducts = (products: InlineProduct[]) => {
    setModalProducts(products);
    // Derive a search query hint from the active query text
    setModalSearchQuery(activeQueryText || "Products");
    setShowProductModal(true);
  };

  const handleShareClick = () => {
    const copyToClipboard = () => {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    };

    if (navigator.share) {
      navigator.share({
        title: `Kapuruka Sourcing: ${activeQueryText || 'AI Sourcing Task'}`,
        text: `Review this AI matched supplier list and conversation history on Kapruka.`,
        url: window.location.href
      }).catch(() => {
        copyToClipboard();
      });
    } else {
      copyToClipboard();
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
          Back  
        </button>
        <button
          onClick={handleShareClick}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
            isCopied
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold shadow-sm scale-95"
              : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          {isCopied ? <Check size={13} className="stroke-[3]" /> : <Share2 size={13} />}
          {isCopied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* ── 2. Body: split-screen chat ── */}
      <div className="flex-1 min-h-0 relative flex flex-row">

        {/* Left Chat Pane */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative w-full">
          {/* Messages */}
          <ChatMessageTimeline
            messages={messages}
            isGenerating={isGenerating}
            activeQueryText={activeQueryText}
            onSampleClick={handleSampleClick}
            onViewMoreProducts={handleViewMoreProducts}
            selectedProductIds={selectedProducts.map(p => p.id)}
            onToggleSelectProduct={handleToggleSelectProduct}
            onBuyProduct={onBuyProduct}
          />

          {/* Bottom spacer so last message clears the gradient + input */}
          <div className="h-36 shrink-0" />
        </div>

        {/* ── Gradient fade — messages dissolve upward into white ── */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 z-10"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 55%)" }}
        />

        {/* ── 3. Pinned input — floats above the gradient ── */}
        <ChatInputArea
          inputText={inputText}
          setInputText={setInputText}
          attachedFiles={attachedFiles}
          onRemoveFile={removeFile}
          onAttachFile={(files) => setAttachedFiles((prev) => [...prev, ...files])}
          onSubmit={handleSubmit}
          isGenerating={isGenerating}
          onStopGeneration={onStopGeneration}
          selectedProducts={selectedProducts}
          onToggleSelectProduct={handleToggleSelectProduct}
        />
        {/* ── end pinned input ── */}

      </div>
      {/* ── end body ── */}

      {/* ── Product Search Modal (floating portal) ── */}
      <ProductCatalogModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        products={modalProducts}
        searchQuery={modalSearchQuery}
        onBuyProduct={onBuyProduct}
        onToggleSelectProduct={handleToggleSelectProduct}
        selectedProductIds={selectedProducts.map((p) => p.id)}
      />

    </div>
  );
}
