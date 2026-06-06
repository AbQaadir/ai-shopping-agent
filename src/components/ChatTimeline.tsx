"use client";

import React, { useEffect, useRef } from "react";
import { 
  Sparkles, 
  Check, 
  Clock, 
  ThumbsUp, 
  ThumbsDown, 
  Flag,
  ChevronRight,
  Box
} from "lucide-react";

interface FileAttachment {
  name: string;
  size: number;
  type: string;
}

export interface InlineProduct {
  id: string;
  title: string;
  price: string;
  moq: string;
  supplier: string;
  location: string;
  years: number;
  rating?: number;
  reviews?: number;
  verified: boolean;
  image: string;
  bgColor: string;
}

export interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  status?: "sending" | "sent" | "analyzing";
  isInitialPrompt?: boolean;
  samples?: string[];
  
  // Showcase features
  inlineProductsHeader?: string;
  inlineProducts?: InlineProduct[];
  showViewProductsButton?: boolean;
  followUpText?: string;
  followUpSamples?: string[];
}

interface ChatTimelineProps {
  messages: Message[];
  isGenerating: boolean;
  onSampleClick?: (sampleText: string) => void;
  onViewDetailsClick?: () => void;
  selectedProductIds?: string[];
  onToggleSelectProduct?: (product: InlineProduct) => void;
}

export default function ChatTimeline({ 
  messages, 
  isGenerating, 
  onSampleClick,
  onViewDetailsClick,
  selectedProductIds = [],
  onToggleSelectProduct
}: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Helper to find previous user query
  const findUserQueryForMessage = (aiMsgId: string) => {
    const aiIdx = messages.findIndex(m => m.id === aiMsgId);
    if (aiIdx > 0) {
      for (let i = aiIdx - 1; i >= 0; i--) {
        if (messages[i].sender === "user") {
          return messages[i].text;
        }
      }
    }
    return "foldable camping chair under $15";
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Format timestamp helper
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Safe Inline Markdown parsing helper (bold/bold)
  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-extrabold text-slate-850">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <strong key={idx} className="font-bold text-slate-850">{part.slice(1, -1)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4 space-y-6 flex flex-col items-center w-full">
      <div className="w-full max-w-3xl space-y-6 flex flex-col">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div 
              key={msg.id}
              className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* Message Bubble Column */}
              <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? "w-full items-end" : "w-full items-start"}`}>
                
                {/* User Message Bubble */}
                {isUser ? (
                  <div className="px-4 py-2 bg-slate-100 text-slate-800 rounded-full font-semibold shadow-sm">
                    <div>{msg.text}</div>
                  </div>
                ) : (
                  /* AI Message Container */
                  <div className="w-full text-slate-700 py-3 space-y-4">
                    
                    {/* Render Initial Sourcing Prompt */}
                    {msg.isInitialPrompt ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-slate-800 text-base">Got it!</h4>
                          <p className="text-slate-600 font-medium">Tell me what you need&mdash;I&apos;ll hunt to find your ideal products.</p>
                        </div>

                        <div className="space-y-2">
                          <p className="font-extrabold text-slate-800">Click a sample to start 👇</p>
                          <div className="space-y-1.5 pl-1">
                            {msg.samples?.map((sample, idx) => (
                              <button
                                key={idx}
                                onClick={() => onSampleClick?.(sample)}
                                className="flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold text-xs hover:underline cursor-pointer text-left py-0.5"
                              >
                                <span className="text-sm font-semibold">↙</span>
                                <span>&ldquo;{sample}&rdquo;</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <p className="text-slate-500 font-medium text-xs leading-relaxed">
                          You can also upload a product photo to search visually, or just describe:{" "}
                          <strong className="text-slate-700 font-bold">1. Your product category 2. Key requirements.</strong>{" "}
                          Let&apos;s go!
                        </p>
                      </div>
                    ) : (
                      /* Standard Sourced AI SSE Message */
                      <div className="space-y-4">
                        {/* Collapsible Thought Process */}
                        {msg.text && (
                          <div className="text-xs">
                            <details className="group border border-slate-100 rounded-xl bg-slate-50/40 overflow-hidden">
                              <summary className="font-bold text-slate-500 cursor-pointer flex items-center justify-between px-3 py-2 select-none hover:bg-slate-100/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <Sparkles size={12} className="text-[#ff6600]" />
                                  <span>Thought Process</span>
                                </div>
                                <span className="text-[10px] text-slate-400 group-open:hidden">Show details</span>
                                <span className="text-[10px] text-slate-400 hidden group-open:inline">Hide details</span>
                              </summary>
                              
                              <div className="p-4 border-t border-slate-100 bg-white space-y-3.5">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-extrabold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Getting everything ready
                                  </div>
                                  <p className="text-slate-500 text-xs font-medium pl-3 leading-relaxed">
                                    I am searching for &ldquo;{findUserQueryForMessage(msg.id)}&rdquo; on B2B platforms to find the best wholesale options for you.
                                  </p>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-extrabold pl-3 pt-1 border-t border-slate-50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Preparing the response
                                  </div>
                                </div>

                                {/* Sourcing status card */}
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4 max-w-xl">
                                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate">
                                    <Box size={14} className="text-[#ff6600]" />
                                    <span>Product search</span>
                                    <span className="text-slate-300 font-light">|</span>
                                    <span className="text-slate-500 font-medium truncate">
                                      {findUserQueryForMessage(msg.id)}
                                    </span>
                                  </div>
                                  <button 
                                    onClick={onViewDetailsClick}
                                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
                                  >
                                    View details
                                  </button>
                                </div>

                                {/* pulsing loaders */}
                                <div className="space-y-2 max-w-xl">
                                  <div className="h-1.5 bg-slate-100 rounded-full w-full"></div>
                                  <div className="h-1.5 bg-slate-100 rounded-full w-5/6"></div>
                                  <div className="h-1.5 bg-slate-100 rounded-full w-2/3"></div>
                                </div>
                              </div>
                            </details>
                          </div>
                        )}

                        {/* Summary Texts with bold markings */}
                        <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
                          {msg.text.split("\n\n").map((para, pIdx) => (
                            <p key={pIdx}>{renderFormattedText(para)}</p>
                          ))}
                        </div>

                        {/* Showcase section if loaded */}
                        {msg.inlineProducts && msg.inlineProducts.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                              {msg.inlineProductsHeader || "Foldable Camping Chair Price < 15 Usd"}
                            </h4>
                            
                            {/* Grid layout showcase (4 columns, up to 3 rows) */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 select-none">
                              {msg.inlineProducts.map((prod) => (
                                <div 
                                  key={prod.id} 
                                  className="w-full bg-white rounded-xl p-3 flex flex-col justify-between hover:shadow-md transition-shadow relative group"
                                >
                                  <div>
                                    <div className={`w-full aspect-[4/3] ${prod.bgColor} rounded-lg flex items-center justify-center text-3xl mb-2 relative overflow-hidden`}>
                                      <span>{prod.image}</span>
                                      {prod.verified && (
                                        <div className="absolute top-1 left-1 bg-emerald-50 text-emerald-600 rounded px-1 text-[8px] font-bold">
                                          V
                                        </div>
                                      )}
                                      
                                      {/* Select button overlay shown on hover or when active */}
                                      <div className={`absolute inset-0 bg-black/5 flex items-center justify-center transition-opacity duration-250 ${
                                        selectedProductIds.includes(prod.id)
                                          ? "opacity-100 bg-black/10"
                                          : "opacity-0 group-hover:opacity-100"
                                      }`}>
                                        <button 
                                          onClick={() => onToggleSelectProduct?.(prod)}
                                          className={`px-3 py-1.5 rounded-full text-[10px] font-bold shadow-md cursor-pointer transition-all duration-200 flex items-center gap-0.5 ${
                                            selectedProductIds.includes(prod.id)
                                              ? "bg-[#ff6600] text-white border border-[#ff6600]"
                                              : "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200"
                                          }`}
                                        >
                                          <Check size={9} className="stroke-[3.5]" />
                                          <span>Select</span>
                                        </button>
                                      </div>
                                    </div>
                                    <h5 className="text-xs md:text-sm font-bold text-slate-800 leading-snug line-clamp-2 mb-1.5 mt-1">
                                      {prod.title}
                                    </h5>
                                  </div>
                                  <div className="text-xs border-t border-slate-50 pt-1.5 mt-1">
                                    <div className="font-extrabold text-slate-850 text-sm">{prod.price}</div>
                                    <div className="text-slate-500 font-semibold text-[10px] md:text-xs">Min: {prod.moq}</div>
                                    <div className="text-slate-500 font-medium text-[10px] md:text-xs truncate mt-0.5">{prod.supplier}</div>
                                    <div className="text-slate-500 font-semibold text-[9px] md:text-[10px] mt-0.5">
                                      {prod.location} &bull; {prod.years} yr{prod.years > 1 ? "s" : ""}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Centered 'View more products' Action button */}
                        {msg.showViewProductsButton && (
                          <div className="flex justify-center pt-2">
                            <button
                              onClick={onViewDetailsClick}
                              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 active:scale-95 text-white font-bold text-xs rounded-full shadow-md transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>View more products</span>
                              <ChevronRight size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        )}

                        {/* Follow up suggestions links */}
                        {msg.followUpSamples && msg.followUpSamples.length > 0 && (
                          <div className="space-y-2.5 pt-3 border-t border-slate-50">
                            <p className="text-xs font-bold text-slate-500">
                              {msg.followUpText || "Based on these camping chairs, you can continue with:"}
                            </p>
                            <div className="space-y-1.5 pl-1">
                              {msg.followUpSamples.map((sample, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => onSampleClick?.(sample)}
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

                    {/* Reaction Bar in Bubble footer */}
                    <div className="flex items-center gap-3 text-slate-400 select-none pt-1">
                      <button className="p-1 hover:bg-slate-50 hover:text-slate-600 rounded transition-colors" title="Good response">
                        <ThumbsUp size={14} />
                      </button>
                      <button className="p-1 hover:bg-slate-50 hover:text-slate-600 rounded transition-colors" title="Bad response">
                        <ThumbsDown size={14} />
                      </button>
                      <button className="p-1 hover:bg-slate-50 hover:text-slate-600 rounded transition-colors ml-1" title="Report issue">
                        <Flag size={14} />
                      </button>
                    </div>

                  </div>
                )}

                {/* Bubble details */}
                <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isUser ? "justify-end" : "justify-start"}`}>
                  <span>{formatTime(msg.timestamp)}</span>
                  {isUser && (
                    <span>
                      {msg.status === "sending" && <Clock size={10} className="animate-spin text-[#ff6600]" />}
                      {msg.status === "analyzing" && <Sparkles size={10} className="animate-pulse text-[#ff6600]" />}
                      {msg.status === "sent" && <Check size={10} className="text-emerald-500 stroke-[3]" />}
                    </span>
                  )}
                </div>

              </div>

            </div>
          );
        })}

        {/* Typing loading bars placeholder */}
        {isGenerating && (
          <div className="self-start max-w-[85%] animate-pulse flex flex-col gap-1 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-xs font-semibold">Sourcing products and manufacturers...</span>
            </div>
          </div>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
