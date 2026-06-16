"use client";

import type { InlineProduct, Message } from "@/types/sourcing";
import {
  Check,
  ChevronLeft,
  Share2,
  Menu,
  ShoppingCart
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSourcing } from "@/context/SourcingContext";
import ChatInputArea from "./ChatInputArea";
import ChatMessageTimeline from "./ChatMessageTimeline";
import ProductCatalogModal from "./ProductCatalogModal";
import CartDrawer from "./CartDrawer";

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
  const { selectedProducts, setSelectedProducts, setIsMobileSidebarOpen, cartItems } = useSourcing();
  const [inputText, setInputText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Reset internal states when activeHistoryId changes to avoid unmounting ChatWorkspace
  useEffect(() => {
    setInputText("");
    setAttachedFiles([]);
    setSelectedProducts([]);
  }, [activeHistoryId, setSelectedProducts]);

  // Product search modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalProducts, setModalProducts] = useState<InlineProduct[]>([]);
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  const handleViewMoreProducts = (products: InlineProduct[], queryHint?: string) => {
    setModalProducts(products);
    // Derive a search query hint from the active query text or the queryHint passed in
    setModalSearchQuery(queryHint || activeQueryText || "Products");
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

  const handleSubmit = (overrideText?: string) => {
    const textToSubmit = overrideText !== undefined ? overrideText : inputText;
    if (textToSubmit.trim() || attachedFiles.length > 0) {
      onSend(textToSubmit, attachedFiles);
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
    <div className="flex-1 w-full flex flex-col overflow-hidden h-full bg-white relative">

      {/* Mobile Header Navigation */}
      <header className="md:hidden w-full h-14 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-3 select-none shrink-0 z-20">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all cursor-pointer active:scale-95 outline-none"
            title="Open menu"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={onBackToLanding}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all cursor-pointer active:scale-95 outline-none flex items-center"
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="flex items-center">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Sourcing Session
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Share */}
          <button
            onClick={handleShareClick}
            className={`p-2 rounded-xl transition-all cursor-pointer active:scale-95 outline-none flex items-center ${
              isCopied
                ? "bg-emerald-50 text-emerald-600 border border-emerald-150 font-bold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
            }`}
            title="Share session"
          >
            {isCopied ? <Check size={20} className="stroke-[3]" /> : <Share2 size={20} />}
          </button>

          {/* Cart */}
          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all cursor-pointer active:scale-95 outline-none relative"
            title="Open cart"
          >
            <ShoppingCart size={20} />
            {cartItems.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#402970] text-white flex items-center justify-center text-[9px] font-extrabold shadow-sm animate-pulse">
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Floating mobile trigger & back button */}
      <div className="hidden md:flex absolute top-4 left-6 z-20 flex items-center gap-2.5 bg-white/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-100/80 shadow-xs select-none">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden p-1 -ml-0.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer outline-none"
          title="Open menu"
        >
          <Menu size={15} />
        </button>
        
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors p-1"
        >
          <ChevronLeft size={13} />
          Back  
        </button>
      </div>

      {/* Floating control buttons */}
      <div className="hidden md:flex absolute top-4 right-6 z-20 select-none flex items-center gap-3">
        {/* Floating cart button */}
        <button
          onClick={() => setIsCartDrawerOpen(true)}
          className="relative flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border bg-white/85 backdrop-blur-md border-slate-200 text-slate-650 hover:text-slate-900 hover:border-slate-350 transition-all duration-200 cursor-pointer shadow-xs outline-none"
        >
          <ShoppingCart size={13} />
          <span>Cart</span>
          {cartItems.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#402970] text-white flex items-center justify-center text-[9px] font-extrabold shadow-sm animate-pulse">
              {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
            </span>
          )}
        </button>

        {/* Floating share button */}
        <button
          onClick={handleShareClick}
          className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer shadow-xs outline-none ${
            isCopied
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold scale-95"
              : "bg-white/85 backdrop-blur-md border-slate-200 text-slate-655 hover:text-slate-900 hover:border-slate-355"
          }`}
        >
          {isCopied ? <Check size={13} className="stroke-[3]" /> : <Share2 size={13} />}
          {isCopied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* ── 2. Body: split-screen chat ── */}
      <div className="flex-1 min-h-0 relative flex flex-row">

        {/* Left Chat Pane */}
        <div className="flex-1 min-h-0 flex flex-col relative w-full">
          {/* Messages */}
          <ChatMessageTimeline
            messages={messages}
            isGenerating={isGenerating}
            activeQueryText={activeQueryText}
            onSampleClick={handleSampleClick}
            onDirectSend={(text) => handleSubmit(text)}
            onViewMoreProducts={handleViewMoreProducts}
            selectedProductIds={selectedProducts.map(p => p.id)}
            onToggleSelectProduct={handleToggleSelectProduct}
            onBuyProduct={onBuyProduct}
          />
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
          chatHistory={messages.map((m) => ({
            role: m.sender === "ai" ? "assistant" as const : "user" as const,
            content: m.text,
          }))}
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

      {/* Cart drawer overlay */}
      <CartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
      />

    </div>
  );
}
