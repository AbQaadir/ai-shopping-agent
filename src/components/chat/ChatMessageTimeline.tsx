"use client";

import React, { useEffect, useRef } from "react";
import { Clock, Check, ThumbsUp, ThumbsDown, Flag, X, Box } from "lucide-react";
import type { Message, InlineProduct } from "@/types/sourcing";

import DeliveryCard from "./cards/DeliveryCard";
import TrackingCard from "./cards/TrackingCard";
import ImportEstimateCard from "./cards/ImportEstimateCard";
import ServiceListingCard from "./cards/ServiceListingCard";
import GroundingSourcesCard from "./cards/GroundingSourcesCard";
import ProductGrid from "./ProductGrid";
import ThinkingPanel from "./ThinkingPanel";

interface ChatTimelineProps {
  messages: Message[];
  isGenerating: boolean;
  activeQueryText?: string;
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
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={idx} className="font-extrabold text-slate-800">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <strong key={idx} className="font-bold text-slate-800">{part.slice(1, -1)}</strong>;
    if (part.startsWith("[") && part.includes("](")) {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <a
            key={idx}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:text-sky-800 underline font-bold transition-colors"
          >
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
}

export default function ChatTimeline({
  messages,
  isGenerating,
  activeQueryText,
  onSampleClick,
  onViewDetailsClick,
  onViewMoreProducts,
  selectedProductIds = [],
  onToggleSelectProduct,
  onBuyProduct,
}: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Local state to keep track of closed tool result cards per message ID
  const [closedMessages, setClosedMessages] = React.useState<Record<string, boolean>>({});

  // Helper to render closable B2B card wrappers
  const renderClosableToolCard = (
    msgId: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode
  ) => {
    if (closedMessages[msgId]) return null;

    return (
      <div className="border border-slate-100 rounded-[20px] p-5 bg-white shadow-sm w-full mt-4 select-none animate-fadeIn">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          {/* Left side: Tool Icon & Name */}
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-[14px] font-bold text-slate-800">{title}</span>
          </div>
          {/* Right side: Mock layout switcher and Close button */}
          <div className="flex items-center gap-3">
            {/* Grid/List switch icons */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button className="p-1 text-slate-600 bg-white rounded-md shadow-xs cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            {/* Close button */}
            <button
              onClick={() => setClosedMessages(prev => ({ ...prev, [msgId]: true }))}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {content}
      </div>
    );
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div
      className="flex-1 overflow-y-auto px-4 pt-6 space-y-6 flex flex-col items-center w-full"
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="w-full max-w-3xl space-y-6 flex flex-col">
        {messages.map((msg, idx) => {
          const isUser = msg.sender === "user";
          const isLastAIResponse = !isUser && idx === messages.length - 1 && isGenerating;
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}>
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
                            onViewDetails={() => {
                              setClosedMessages(prev => ({ ...prev, [msg.id]: false }));
                              onViewDetailsClick?.(msg.inlineProducts);
                            }}
                            activeQueryText={activeQueryText}
                          />
                        )}

                        {/* AI text response */}
                        {msg.text && (
                          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
                            {msg.text.split("\n\n").map((para, pIdx, arr) => {
                              const isLastPara = pIdx === arr.length - 1;
                              return (
                                <p key={pIdx}>
                                  {renderFormattedText(para)}
                                  {isLastAIResponse && isLastPara && (
                                    <span className="inline-block w-1.5 h-3.5 bg-[#402970] ml-1.5 animate-pulse rounded-full align-middle" />
                                  )}
                                </p>
                              );
                            })}
                          </div>
                        )}

                        {/* ── Pillar 1/3: Product Grid ── */}
                        {msg.inlineProducts && msg.inlineProducts.length > 0 &&
                          renderClosableToolCard(
                            msg.id,
                            "Product search",
                            <Box size={16} className="text-[#f97316] shrink-0" />,
                            <ProductGrid
                              products={msg.inlineProducts}
                              header={msg.inlineProductsHeader}
                              onViewMore={() => onViewMoreProducts?.(msg.inlineProducts || [])}
                              selectedIds={selectedProductIds}
                              onToggle={onToggleSelectProduct}
                              onBuy={onBuyProduct}
                            />
                          )
                        }

                        {/* ── Pillar 2: Delivery Card ── */}
                        {msg.deliveryResult &&
                          renderClosableToolCard(
                            msg.id,
                            "Delivery check",
                            <Box size={16} className="text-[#f97316] shrink-0" />,
                            <DeliveryCard delivery={msg.deliveryResult} />
                          )
                        }

                        {/* ── Pillar 2: Tracking Card ── */}
                        {msg.trackingResult &&
                          renderClosableToolCard(
                            msg.id,
                            "Order tracking",
                            <Box size={16} className="text-[#f97316] shrink-0" />,
                            <TrackingCard tracking={msg.trackingResult} />
                          )
                        }

                        {/* ── Pillar 4: Import Estimate Card ── */}
                        {msg.importEstimate &&
                          renderClosableToolCard(
                            msg.id,
                            "Import estimate",
                            <Box size={16} className="text-[#f97316] shrink-0" />,
                            <ImportEstimateCard estimate={msg.importEstimate} />
                          )
                        }

                        {/* ── Pillar 5: Service Listing Card ── */}
                        {msg.serviceListing &&
                          renderClosableToolCard(
                            msg.id,
                            "Service listing",
                            <Box size={16} className="text-[#f97316] shrink-0" />,
                            <ServiceListingCard listing={msg.serviceListing} onSampleClick={onSampleClick} />
                          )
                        }

                        {/* ── Google Search Grounding Sources Card ── */}
                        {msg.groundingSources && msg.groundingSources.length > 0 &&
                          renderClosableToolCard(
                            msg.id,
                            "Search grounding",
                            <Box size={16} className="text-[#f97316] shrink-0" />,
                            <GroundingSourcesCard sources={msg.groundingSources} />
                          )
                        }

                        {/* Follow-up suggestions */}
                        {msg.followUpSamples && msg.followUpSamples.length > 0 && (
                          <div className="space-y-3 pt-3.5 border-t border-slate-100/50">
                            <p className="text-sm font-semibold text-slate-800">
                              {msg.followUpText || "You can refine these results further. Here are some options:"}
                            </p>
                            <div className="space-y-2.5 pl-1 flex flex-col items-start">
                              {msg.followUpSamples.map((sample, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => onSampleClick?.(sample)}
                                  onMouseDown={(e) => e.preventDefault()}
                                  className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium text-[13px] underline decoration-slate-300 hover:decoration-slate-500 cursor-pointer text-left py-0.5 transition-all"
                                >
                                  <span className="text-slate-400 font-semibold select-none">↙</span>
                                  <span>{sample}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reaction bar */}
                    <div className="flex items-center gap-1.5 text-slate-400 select-none pt-1">
                      <button className="p-1.5 hover:bg-slate-50 hover:text-[#402970] rounded-lg transition-colors cursor-pointer" title="Good response">
                        <ThumbsUp size={14} className="text-slate-400 hover:text-[#402970] transition-colors" />
                      </button>
                      <button className="p-1.5 hover:bg-slate-50 hover:text-[#402970] rounded-lg transition-colors cursor-pointer" title="Bad response">
                        <ThumbsDown size={14} className="text-slate-400 hover:text-[#402970] transition-colors" />
                      </button>
                      <button className="p-1.5 hover:bg-slate-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer" title="Report response">
                        <Flag size={14} className="text-slate-400 hover:text-rose-600 transition-colors" />
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


      </div>
      <div ref={bottomRef} />
    </div>
  );
}
