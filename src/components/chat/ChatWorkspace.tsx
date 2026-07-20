"use client";

import type { InlineProduct, Message } from "@/types/sourcing";
import {
  Check,
  ChevronLeft,
  Share2,
  Menu,
  ShoppingCart,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSourcingStore, useSourcingActions } from "@/store/useSourcingStore";
import ChatInputArea from "./ChatInputArea";
import ChatMessageTimeline from "./ChatMessageTimeline";
import ProductCatalogModal from "./ProductCatalogModal";
import CartModal from "./CartModal";
import ShareChatModal from "./ShareChatModal";
import AgeVerificationModal from "./AgeVerificationModal";

interface ChatWorkspaceProps {
  activeHistoryId?: string;
  messages: Message[];
  isGenerating: boolean;
  onSend: (text: string) => void;
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
  const selectedProducts = useSourcingStore(state => state.selectedProducts);
  const setSelectedProducts = useSourcingStore(state => state.setSelectedProducts);
  const setIsMobileSidebarOpen = useSourcingStore(state => state.setIsMobileSidebarOpen);
  const cartItems = useSourcingStore(state => state.cartItems);
  const cartToast = useSourcingStore(state => state.cartToast);
  const clearCartToast = useSourcingStore(state => state.clearCartToast);
  const isAgeVerificationRequired = useSourcingStore(state => state.isAgeVerificationRequired);
  const setIsAgeVerificationRequired = useSourcingStore(state => state.setIsAgeVerificationRequired);

  const { isSharedReadOnly, handleSendMessage } = useSourcingActions();
  const [inputText, setInputText] = useState("");
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    setInputText("");
    setSelectedProducts([]);
  }, [activeHistoryId, setSelectedProducts]);

  // Product search modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalProducts, setModalProducts] = useState<InlineProduct[]>([]);
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  const handleViewMoreProducts = (products: InlineProduct[], queryHint?: string) => {
    setModalProducts(products);
    // Derive a search query hint from the active query text or the queryHint passed in
    setModalSearchQuery(queryHint || activeQueryText);
    setShowProductModal(true);
  };

  const handleShareClick = () => {
    setIsShareModalOpen(true);
  };

  const handleSampleClick = (sampleText: string) => {
    setInputText(sampleText);
    // Let the user edit or send manually, but typically we send automatically:
    handleSubmit(sampleText);
  };

  const handleSubmit = (overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim() || isGenerating || isSharedReadOnly) return;
    onSend(textToSend);
    setInputText("");
  };

  // Regenerate the last AI response by re-sending the last user message
  const handleRegenerate = () => {
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find(m => m.sender === "user");
    if (lastUserMsg && !isGenerating) {
      // Re-send the last user message (this will delete the old AI response and generate a new one)
      handleSendMessage(lastUserMsg.text, lastUserMsg.id);
    }
  };

  const handleToggleSelectProduct = (product: InlineProduct) => {
    if (isSharedReadOnly) return;
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  const lastAiMessage = [...messages].reverse().find(m => m.sender === "ai");
  const lastOrderFlowStep = [...messages].reverse().find(m => !!m.orderFlowStep)?.orderFlowStep;
  const hasActiveCheckout = !!(lastOrderFlowStep && lastOrderFlowStep.phase !== "confirmed" && (lastOrderFlowStep.phase as string) !== "cancelled");
  const isLatestMessageCheckout = !!(lastAiMessage && lastAiMessage.orderFlowStep);
  const isCheckoutActive = hasActiveCheckout && !isLatestMessageCheckout;

  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden h-full bg-[#fbfbfe] relative">
      {/* Background World Map Watermark */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{
          backgroundImage: "url('/world.svg')",
          filter: "invert(18%) sepia(26%) saturate(3025%) hue-rotate(241deg) brightness(97%) contrast(92%)",
          opacity: 0.03 // Very faint opacity for the chat workspace backdrop
        }}
      />

      {isSharedReadOnly && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-[#f8f9ff]/90 backdrop-blur-md border-b border-[#402970]/10 py-2.5 px-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#402970] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#402970] animate-pulse"></span>
          You are viewing a shared chat.
          <button onClick={onBackToLanding} className="underline decoration-[#402970]/30 hover:decoration-[#402970] underline-offset-2 ml-1 cursor-pointer">
            Start a new chat
          </button>
          to ask your own questions.
        </div>
      )}

      {/* Floating mobile trigger & back button */}
      <div className={`absolute left-6 z-20 select-none flex items-center gap-3 ${isSharedReadOnly ? 'top-14' : 'top-4'}`}>
        {/* Mobile menu trigger */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden flex items-center justify-center p-1.5 rounded-lg border bg-white/85 backdrop-blur-md border-slate-300 text-slate-700 hover:text-slate-950 hover:border-slate-400 transition-all duration-200 cursor-pointer shadow-xs outline-none"
          title="Open menu"
        >
          <Menu size={15} />
        </button>
        
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer shadow-xs outline-none bg-white/85 backdrop-blur-md border-slate-300 text-slate-700 hover:text-slate-950 hover:border-slate-400"
        >
          <ChevronLeft size={13} />
          Back  
        </button>
      </div>

      {/* Floating control buttons */}
      <div className={`absolute right-6 z-20 select-none flex items-center gap-3 ${isSharedReadOnly ? 'top-14' : 'top-4'}`}>
        {/* Floating cart button */}
        <button
          onClick={() => setIsCartModalOpen(true)}
          className="relative flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border bg-white/85 backdrop-blur-md border-slate-300 text-slate-700 hover:text-slate-950 hover:border-slate-400 transition-all duration-200 cursor-pointer shadow-xs outline-none"
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
        {!isSharedReadOnly && (
          <button
            onClick={handleShareClick}
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer shadow-xs outline-none bg-white/85 backdrop-blur-md border-slate-300 text-slate-700 hover:text-slate-950 hover:border-slate-400"
          >
            <Share2 size={13} />
            Share
          </button>
        )}
      </div>

      {/* ── 2. Body: split-screen chat ── */}
      <div className="flex-1 min-h-0 relative flex flex-row">

        {/* Left Chat Pane */}
        <div className="flex-1 min-h-0 flex flex-col relative w-full">
          {/* Messages */}
          <ChatMessageTimeline
            activeHistoryId={activeHistoryId}
            messages={messages}
            isGenerating={isGenerating}
            activeQueryText={activeQueryText}
            onSampleClick={handleSampleClick}
            onDirectSend={(text) => handleSubmit(text)}
            onViewMoreProducts={handleViewMoreProducts}
            selectedProductIds={selectedProducts.map(p => p.id)}
            onToggleSelectProduct={handleToggleSelectProduct}
            onBuyProduct={onBuyProduct}
            onEditMessage={(msgId, newText) => handleSendMessage(newText, msgId)}
            onRegenerate={handleRegenerate}
          />
        </div>

        {/* ── Gradient fade — messages dissolve upward into the off-white background ── */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 z-10"
          style={{ background: "linear-gradient(to bottom, rgba(251,251,254,0) 0%, rgba(251,251,254,1) 55%)" }}
        />

        {/* ── 3. Pinned input — floats above the gradient ── */}
        <ChatInputArea
          inputText={inputText}
          setInputText={setInputText}
          onSubmit={handleSubmit}
          isGenerating={isGenerating}
          onStopGeneration={onStopGeneration}
          selectedProducts={selectedProducts}
          onToggleSelectProduct={handleToggleSelectProduct}
          isCheckoutActive={isCheckoutActive}
          hasActiveCheckout={hasActiveCheckout}
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

      {/* ── Share Chat Modal ── */}
      <ShareChatModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        url={typeof window !== "undefined" ? window.location.href : ""}
        chatTitle={activeQueryText}
      />

      {/* Cart Modal overlay */}
      <CartModal
        isOpen={isCartModalOpen}
        isGlobal={false}
        onClose={() => setIsCartModalOpen(false)}
      />

      {/* ── Silent Add-to-Cart Toast ── */}
      {cartToast && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-4 py-2.5 bg-[#402970] text-white text-xs font-semibold rounded-2xl shadow-lg animate-slideInDown select-none"
          role="status"
          aria-live="polite"
        >
          <ShoppingCart size={13} className="shrink-0 opacity-80" />
          <span>{cartToast}</span>
          <button
            onClick={clearCartToast}
            className="ml-1 p-0.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* ── Age Verification Modal ── */}
      <AgeVerificationModal
        isOpen={isAgeVerificationRequired}
        onConfirm={() => setIsAgeVerificationRequired(false)}
        onReject={() => {
          setIsAgeVerificationRequired(false);
          onBackToLanding();
        }}
      />

    </div>
  );
}
