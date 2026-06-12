"use client";

import React, { useEffect, useRef } from "react";
import { Clock, Check, ThumbsUp, ThumbsDown, Flag, X, Box, ExternalLink } from "lucide-react";
import type { Message, InlineProduct } from "@/types/sourcing";

import DeliveryCard from "./cards/DeliveryCard";
import TrackingCard from "./cards/TrackingCard";
import ImportEstimateCard from "./cards/ImportEstimateCard";
import ServiceListingCard from "./cards/ServiceListingCard";
import CheckoutCard from "./cards/CheckoutCard";
import OrderFlowCard from "./cards/OrderFlowCard";
import OrderStepBubble from "./cards/OrderStepBubble";
import ProductGrid from "./ProductGrid";
import ThinkingPanel from "./ThinkingPanel";

interface ChatTimelineProps {
  messages: Message[];
  isGenerating: boolean;
  activeQueryText?: string;
  onSampleClick?: (sampleText: string) => void;
  onDirectSend?: (text: string) => void;
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
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={idx} className="font-extrabold text-slate-800">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <strong key={idx} className="font-bold text-slate-800">{part.slice(1, -1)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code
          key={idx}
          className="bg-slate-100 text-[#402970] font-mono text-[12px] px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
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
  onDirectSend,
  onViewMoreProducts,
  selectedProductIds = [],
  onToggleSelectProduct,
  onBuyProduct,
}: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Local state to keep track of closed tool result cards per message ID
  const [closedMessages, setClosedMessages] = React.useState<Record<string, boolean>>({});

  // Find index of the last active order flow step to compute isActive prop
  const lastOrderStepIdx = messages.map(m => !!m.orderFlowStep).lastIndexOf(true);

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
          {/* Right side: Close button */}
          <div className="flex items-center gap-3">
            {/* Close button */}
            <button
              onClick={() => setClosedMessages(prev => ({ ...prev, [msgId]: true }))}
              className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
      className="flex-1 overflow-y-auto px-4 pt-16 space-y-6 flex flex-col items-center w-full"
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
                  <div className="flex flex-col items-end gap-2 max-w-full">
                    {/* Selected products cards */}
                    {msg.inlineProducts && msg.inlineProducts.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-end select-none">
                        {msg.inlineProducts.map((prod) => (
                          <div
                            key={prod.id}
                            className="flex items-center gap-2 bg-slate-100 border border-slate-200/50 rounded-xl p-1.5 pr-3 max-w-[200px]"
                          >
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
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
                                <span className="text-sm select-none">{prod.image || "🛍️"}</span>
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] font-semibold text-slate-700 leading-tight line-clamp-2 truncate-line-clamp break-all">
                                {prod.name || prod.title || "Product"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text bubble */}
                    <div className={`px-4 py-2.5 font-semibold shadow-xs text-sm ${
                      msg.inlineProducts && msg.inlineProducts.length > 0
                        ? "bg-[#402970]/5 border border-[#402970]/10 text-[#402970] rounded-2xl"
                        : "bg-slate-100 text-slate-800 rounded-full border border-slate-200/20"
                    }`}>
                      {msg.text}
                    </div>
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
                        {((msg.thinkingSteps && msg.thinkingSteps.length > 0) || (isLastAIResponse && (msg.activeToolCall || isGenerating))) && (
                          <ThinkingPanel
                            steps={msg.thinkingSteps || []}
                            activeToolCall={msg.activeToolCall}
                            isGenerating={isLastAIResponse}
                            hasText={!!msg.text}
                            inlineProducts={msg.inlineProducts}
                            activeQueryText={activeQueryText}
                          />
                        )}

                        {/* AI text response */}
                        {msg.text && (
                          <div className="text-sm text-slate-600 leading-relaxed space-y-1.5">
                            {(() => {
                              const lines = msg.text.split("\n");
                              // Find the last non-empty line index to append the cursor
                              let lastNonEmptyIdx = -1;
                              for (let i = lines.length - 1; i >= 0; i--) {
                                if (lines[i].trim() !== "") {
                                  lastNonEmptyIdx = i;
                                  break;
                                }
                              }

                              const processedElements: React.ReactNode[] = [];
                              let sourceElements: React.ReactNode[] = [];
                              let isInsideSources = false;
                              let isInsideCodeBlock = false;
                              let codeBlockLines: string[] = [];

                              let isInsideTable = false;
                              let tableRows: string[][] = [];

                              const parseTableRow = (lineStr: string): string[] => {
                                const parts = lineStr.split("|");
                                if (parts[0].trim() === "") parts.shift();
                                if (parts[parts.length - 1]?.trim() === "") parts.pop();
                                return parts.map(p => p.trim());
                              };

                              const isSeparatorRow = (cells: string[]): boolean => {
                                return cells.length > 0 && cells.every(c => /^[:\-\s]+$/.test(c));
                              };

                              const renderTable = (rows: string[][], key: string | number) => {
                                if (rows.length === 0) return null;
                                const headerRow = rows[0];
                                let bodyRows = rows.slice(1);
                                let alignments: string[] = [];
                                
                                if (bodyRows.length > 0 && isSeparatorRow(bodyRows[0])) {
                                  const separatorRow = bodyRows[0];
                                  alignments = separatorRow.map(c => {
                                    const t = c.trim();
                                    if (t.startsWith(":") && t.endsWith(":")) return "text-center";
                                    if (t.endsWith(":")) return "text-right";
                                    return "text-left";
                                  });
                                  bodyRows = bodyRows.slice(1);
                                }
                                
                                return (
                                  <div key={key} className="overflow-x-auto my-4 border border-slate-200/80 rounded-xl shadow-xs w-full select-text">
                                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                                      <thead className="bg-slate-50/80 select-none">
                                        <tr>
                                          {headerRow.map((cell, idx) => (
                                            <th
                                              key={idx}
                                              className={`px-4 py-2.5 font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-200/60 ${alignments[idx] || "text-left"}`}
                                            >
                                              {renderFormattedText(cell)}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-slate-100 font-medium">
                                        {bodyRows.map((row, rIdx) => (
                                          <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors even:bg-slate-50/30">
                                            {row.map((cell, cIdx) => (
                                              <td
                                                key={cIdx}
                                                className={`px-4 py-2.5 text-slate-600 ${alignments[cIdx] || "text-left"}`}
                                              >
                                                {renderFormattedText(cell)}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              };

                              for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                                const line = lines[lineIdx];
                                const trimmed = line.trim();

                                const isTableRow = trimmed.startsWith("|");

                                if (isInsideTable && !isTableRow) {
                                  processedElements.push(renderTable(tableRows, `table-${lineIdx}`));
                                  tableRows = [];
                                  isInsideTable = false;
                                }

                                if (isTableRow) {
                                  if (!isInsideTable) {
                                    isInsideTable = true;
                                    tableRows = [parseTableRow(trimmed)];
                                  } else {
                                    tableRows.push(parseTableRow(trimmed));
                                  }
                                  continue;
                                }

                                // Fenced Code Blocks
                                if (trimmed.startsWith("```")) {
                                  if (isInsideCodeBlock) {
                                    const codeContent = codeBlockLines.join("\n");
                                    processedElements.push(
                                      <pre key={`code-block-${lineIdx}`} className="bg-slate-900 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-slate-800 my-2 overflow-x-auto select-text leading-relaxed">
                                        <code>{codeContent}</code>
                                      </pre>
                                    );
                                    codeBlockLines = [];
                                    isInsideCodeBlock = false;
                                  } else {
                                    isInsideCodeBlock = true;
                                  }
                                  continue;
                                }

                                if (isInsideCodeBlock) {
                                  codeBlockLines.push(line);
                                  continue;
                                }

                                // Sources Header
                                if (trimmed === "**Sources:**" || trimmed === "Sources:") {
                                  isInsideSources = true;
                                  continue;
                                }

                                // Source Citation Item
                                const sourceMatch = trimmed.match(/^\[(\d+)\]\s+\[([^\]]+)\]\(([^)]+)\)/);
                                if (sourceMatch) {
                                  const title = sourceMatch[2];
                                  const url = sourceMatch[3];

                                  sourceElements.push(
                                    <React.Fragment key={`src-item-${lineIdx}`}>
                                      {sourceElements.length > 0 && <span className="text-slate-400 select-none text-sm">,</span>}
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sky-600 hover:text-sky-800 underline font-semibold text-sm transition-colors"
                                      >
                                        {title}
                                      </a>
                                    </React.Fragment>
                                  );
                                  continue;
                                }

                                // Flush source items if the block ended
                                if (isInsideSources && sourceElements.length > 0 && trimmed !== "") {
                                  processedElements.push(
                                    <p key={`src-container-${lineIdx}`} className="text-sm text-slate-500 font-medium mt-3.5 flex flex-wrap items-center gap-1">
                                      <span className="font-bold text-slate-800 select-none">Sources:</span>
                                      {sourceElements}
                                    </p>
                                  );
                                  sourceElements = [];
                                  isInsideSources = false;
                                }

                                // Empty Line
                                if (trimmed === "") {
                                  processedElements.push(<div key={lineIdx} className="h-2" />);
                                  continue;
                                }

                                const isLastLine = lineIdx === lastNonEmptyIdx;

                                // Headers (###, ##, #)
                                const headerMatch = line.match(/^(\s*)(#{1,3})\s+(.*)/);
                                if (headerMatch) {
                                  const level = headerMatch[2].length;
                                  const content = headerMatch[3];

                                  if (level === 3) {
                                    processedElements.push(
                                      <h5 key={lineIdx} className="text-[14px] font-extrabold text-slate-800 mt-4 mb-1 select-none">
                                        {renderFormattedText(content)}
                                      </h5>
                                    );
                                  } else if (level === 2) {
                                    processedElements.push(
                                      <h4 key={lineIdx} className="text-[15px] font-extrabold text-slate-800 mt-5 mb-1.5 select-none">
                                        {renderFormattedText(content)}
                                      </h4>
                                    );
                                  } else {
                                    processedElements.push(
                                      <h3 key={lineIdx} className="text-[17px] font-extrabold text-slate-900 mt-6 mb-2 select-none">
                                        {renderFormattedText(content)}
                                      </h3>
                                    );
                                  }
                                  continue;
                                }

                                // Bullet Points (*, -, or •)
                                const bulletMatch = line.match(/^\s*([*\-•])\s+(.*)/);
                                if (bulletMatch) {
                                  const content = bulletMatch[2];
                                  processedElements.push(
                                    <div key={lineIdx} className="flex items-start gap-2.5 pl-3 py-0.5 animate-fadeIn">
                                      <span className="text-[#402970] mt-1.5 shrink-0 select-none text-[8px]">●</span>
                                      <span className="flex-1">
                                        {renderFormattedText(content)}
                                        {isLastAIResponse && isLastLine && (
                                          <span className="inline-block w-1.5 h-3.5 bg-[#402970] ml-1.5 animate-pulse rounded-full align-middle" />
                                        )}
                                      </span>
                                    </div>
                                  );
                                  continue;
                                }

                                // Numbered Lists
                                const numMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
                                if (numMatch) {
                                  const num = numMatch[1];
                                  const content = numMatch[2];
                                  processedElements.push(
                                    <div key={lineIdx} className="flex items-start gap-2.5 pl-3 py-0.5 animate-fadeIn">
                                      <span className="text-[#402970] font-bold text-xs mt-0.5 shrink-0 select-none">{num}.</span>
                                      <span className="flex-1">
                                        {renderFormattedText(content)}
                                        {isLastAIResponse && isLastLine && (
                                          <span className="inline-block w-1.5 h-3.5 bg-[#402970] ml-1.5 animate-pulse rounded-full align-middle" />
                                        )}
                                      </span>
                                    </div>
                                  );
                                  continue;
                                }

                                // Standard Line
                                processedElements.push(
                                  <p key={lineIdx}>
                                    {renderFormattedText(line)}
                                    {isLastAIResponse && isLastLine && (
                                      <span className="inline-block w-1.5 h-3.5 bg-[#402970] ml-1.5 animate-pulse rounded-full align-middle" />
                                    )}
                                  </p>
                                );
                              }

                              // Final flushes at end of message text loop
                              if (isInsideTable && tableRows.length > 0) {
                                processedElements.push(renderTable(tableRows, "table-end"));
                              }

                              if (isInsideCodeBlock && codeBlockLines.length > 0) {
                                processedElements.push(
                                  <pre key="code-block-end" className="bg-slate-900 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-slate-800 my-2 overflow-x-auto select-text leading-relaxed">
                                    <code>{codeBlockLines.join("\n")}</code>
                                  </pre>
                                );
                              }

                              if (sourceElements.length > 0) {
                                processedElements.push(
                                  <p key="src-container-end" className="text-sm text-slate-500 font-medium mt-3.5 flex flex-wrap items-center gap-1">
                                    <span className="font-bold text-slate-800 select-none">Sources:</span>
                                    {sourceElements}
                                  </p>
                                );
                              }

                              return processedElements;
                            })()}
                          </div>
                        )}

                        {/* ── Pillar 1/3: Product Grid ── */}
                        {msg.inlineProducts && msg.inlineProducts.length > 0 &&
                          renderClosableToolCard(
                            msg.id,
                            msg.inlineProductsHeader || "Product search",
                            <Box size={16} className="text-[#402970] shrink-0" />,
                            <ProductGrid
                              products={msg.inlineProducts}
                              header={msg.inlineProductsHeader}
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
                            <Box size={16} className="text-[#402970] shrink-0" />,
                            <DeliveryCard delivery={msg.deliveryResult} />
                          )
                        }

                        {/* ── Pillar 2: Tracking Card ── */}
                        {msg.trackingResult &&
                          renderClosableToolCard(
                            msg.id,
                            "Order tracking",
                            <Box size={16} className="text-[#402970] shrink-0" />,
                            <TrackingCard tracking={msg.trackingResult} />
                          )
                        }

                        {/* ── Pillar 4: Import Estimate Card ── */}
                        {msg.importEstimate &&
                          renderClosableToolCard(
                            msg.id,
                            "Import estimate",
                            <Box size={16} className="text-[#402970] shrink-0" />,
                            <ImportEstimateCard estimate={msg.importEstimate} />
                          )
                        }

                        {/* ── Pillar 5: Service Listing Card ── */}
                        {msg.serviceListing &&
                          renderClosableToolCard(
                            msg.id,
                            "Service listing",
                            <Box size={16} className="text-[#402970] shrink-0" />,
                            <ServiceListingCard listing={msg.serviceListing} onSampleClick={onSampleClick} />
                          )
                        }

                        {/* ── Conversational Checkout Card ── */}
                        {msg.checkoutFormProduct && (
                          <CheckoutCard product={msg.checkoutFormProduct} />
                        )}

                        {/* ── Conversational Order Flow Step Bubble (NEW) ── */}
                        {msg.orderFlowStep && (
                          <OrderStepBubble
                            step={msg.orderFlowStep}
                            onAction={(text) => {
                              if (onDirectSend) {
                                onDirectSend(text);
                              } else {
                                onSampleClick?.(text);
                              }
                            }}
                            isActive={idx === lastOrderStepIdx}
                          />
                        )}

                        {/* ── Legacy Order Flow Card (backward compat) ── */}
                        {!msg.orderFlowStep && msg.orderFlowProduct && (
                          <OrderFlowCard
                            product={msg.orderFlowProduct}
                            stockStatus={msg.orderFlowStockStatus}
                            stockQty={msg.orderFlowStockQty}
                          />
                        )}

                        {/* ── Payment Checkout Links ── */}
                        {msg.checkoutLinks && msg.checkoutLinks.length > 0 && (
                          <div className="flex flex-col gap-2.5 max-w-sm w-full bg-[#402970]/5 border border-[#402970]/10 rounded-2xl p-4 shadow-sm select-none animate-fadeIn">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="p-1.5 bg-[#402970]/10 text-[#402970] rounded-lg">
                                <Box size={16} />
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">Secure Checkout Link</h4>
                                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Expires in 60 minutes</p>
                              </div>
                            </div>
                            {msg.checkoutLinks.map((link) => (
                              <div key={link.checkoutUrl} className="flex flex-col gap-2 mt-1">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                  <span className="truncate max-w-[200px]">{link.productTitle}</span>
                                  <span className="text-[#402970] font-bold">Rs. {link.priceLKR.toLocaleString()}</span>
                                </div>
                                <a
                                  href={link.checkoutUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-2 bg-[#402970] hover:bg-[#301e54] text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-98"
                                >
                                  Pay Now Rs. {link.priceLKR.toLocaleString()} <ExternalLink size={12} />
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

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
