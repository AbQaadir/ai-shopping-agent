"use client";

import React, { useEffect, useRef } from "react";
import { Clock, Check } from "lucide-react";
import type { Message, InlineProduct } from "@/types/sourcing";

import DeliveryCard from "./cards/DeliveryCard";
import TrackingCard from "./cards/TrackingCard";
import ImportEstimateCard from "./cards/ImportEstimateCard";
import ServiceListingCard from "./cards/ServiceListingCard";
import ProductGrid from "./ProductGrid";
import ThinkingPanel from "./ThinkingPanel";

interface ChatTimelineProps {
  messages: Message[];
  isGenerating: boolean;
  onSampleClick?: (sampleText: string) => void;
  onViewDetailsClick?: (products?: InlineProduct[]) => void;
  onViewMoreProducts?: (products: InlineProduct[]) => void;
  selectedProductIds?: string[];
  onToggleSelectProduct?: (product: InlineProduct) => void;
  onBuyProduct?: (product: InlineProduct) => void;
}

function formatTime(date: Date) {
  // Ensure we handle date parsing if it's serialized as string
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderFormattedText(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={idx} className="font-extrabold text-slate-800">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <strong key={idx} className="font-bold text-slate-800">{part.slice(1, -1)}</strong>;
    return part;
  });
}

export default function ChatTimeline({
  messages,
  isGenerating,
  onSampleClick,
  onViewDetailsClick,
  onViewMoreProducts,
  selectedProductIds = [],
  onToggleSelectProduct,
  onBuyProduct,
}: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 space-y-6 flex flex-col items-center w-full">
      <div className="w-full max-w-3xl space-y-6 flex flex-col">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col gap-1 max-w-[88%] ${isUser ? "w-full items-end" : "w-full items-start"}`}>

                {/* User message */}
                {isUser ? (
                  <div className="px-4 py-2.5 bg-slate-100 text-slate-800 rounded-full font-semibold shadow-sm text-sm">
                    {msg.text}
                  </div>
                ) : (
                  /* AI message */
                  <div className="w-full text-slate-700 py-3 space-y-4">

                    {/* Initial prompt */}
                    {msg.isInitialPrompt ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-slate-800 text-base">How can I help you today?</h4>
                          <p className="text-slate-500 font-medium text-sm">I can search Kapruka products, check delivery, estimate import costs, or book home services.</p>
                        </div>
                        <div className="space-y-2">
                          <p className="font-extrabold text-slate-800 text-sm">Try one of these 👇</p>
                          <div className="space-y-1.5 pl-1">
                            {msg.samples?.map((sample, idx) => (
                              <button
                                key={idx}
                                onClick={() => onSampleClick?.(sample)}
                                onMouseDown={(e) => e.preventDefault()}
                                className="flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold text-xs hover:underline cursor-pointer text-left py-0.5"
                              >
                                <span className="text-sm font-semibold">↙</span>
                                <span>&ldquo;{sample}&rdquo;</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">

                        {/* ── AI Thinking Panel ── */}
                        {((msg.thinkingSteps && msg.thinkingSteps.length > 0) || msg.activeToolCall || isGenerating) && (
                          <ThinkingPanel
                            steps={msg.thinkingSteps || []}
                            activeToolCall={msg.activeToolCall}
                            isGenerating={isGenerating}
                            hasText={!!msg.text}
                            inlineProducts={msg.inlineProducts}
                            onViewDetails={() => onViewDetailsClick?.(msg.inlineProducts)}
                          />
                        )}

                        {/* AI text response */}
                        {msg.text && (
                          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
                            {msg.text.split("\n\n").map((para, pIdx) => (
                              <p key={pIdx}>{renderFormattedText(para)}</p>
                            ))}
                          </div>
                        )}

                        {/* ── Pillar 1/3: Product Grid ── */}
                        {msg.inlineProducts && msg.inlineProducts.length > 0 && (
                          <ProductGrid
                            products={msg.inlineProducts}
                            header={msg.inlineProductsHeader}
                            onViewMore={() => onViewMoreProducts?.(msg.inlineProducts || [])}
                            selectedIds={selectedProductIds}
                            onToggle={onToggleSelectProduct}
                            onBuy={onBuyProduct}
                          />
                        )}

                        {/* ── Pillar 2: Delivery Card ── */}
                        {msg.deliveryResult && <DeliveryCard delivery={msg.deliveryResult} />}

                        {/* ── Pillar 2: Tracking Card ── */}
                        {msg.trackingResult && <TrackingCard tracking={msg.trackingResult} />}

                        {/* ── Pillar 4: Import Estimate Card ── */}
                        {msg.importEstimate && <ImportEstimateCard estimate={msg.importEstimate} />}

                        {/* ── Pillar 5: Service Listing Card ── */}
                        {msg.serviceListing && (
                          <ServiceListingCard listing={msg.serviceListing} onSampleClick={onSampleClick} />
                        )}

                        {/* Follow-up suggestions */}
                        {msg.followUpSamples && msg.followUpSamples.length > 0 && (
                          <div className="space-y-2.5 pt-3 border-t border-slate-50">
                            <p className="text-xs font-bold text-slate-500">
                              {msg.followUpText || "You can continue with:"}
                            </p>
                            <div className="space-y-1.5 pl-1">
                              {msg.followUpSamples.map((sample, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => onSampleClick?.(sample)}
                                  onMouseDown={(e) => e.preventDefault()}
                                  className="flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold text-xs hover:underline cursor-pointer text-left py-0.5"
                                >
                                  <span className="text-sm font-semibold">↙</span>
                                  <span>{sample}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reaction bar */}
                    <div className="flex items-center gap-3 text-slate-400 select-none pt-1">
                      <button className="p-1 hover:bg-slate-50 hover:text-[#402970] rounded transition-colors" title="Good response">
                        <span className="text-xs">👍</span>
                      </button>
                      <button className="p-1 hover:bg-slate-50 hover:text-[#402970] rounded transition-colors" title="Bad response">
                        <span className="text-xs">👎</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isUser ? "justify-end" : "justify-start"}`}>
                  <span>{formatTime(msg.timestamp)}</span>
                  {isUser && (
                    <span>
                      {msg.status === "sending" && <Clock size={10} className="animate-spin text-[#402970]" />}
                      {msg.status === "sent" && <Check size={10} className="text-emerald-500 stroke-[3]" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isGenerating && (
          <div className="self-start max-w-[85%] animate-pulse flex flex-col gap-1 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="w-2 h-2 bg-[#402970] rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-[#402970] rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 bg-[#402970] rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="text-xs font-semibold">Searching Kapruka...</span>
            </div>
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
