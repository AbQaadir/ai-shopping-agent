"use client";

import React, { useEffect, useRef, useState } from "react";
import { Clock, Check, ThumbsUp, ThumbsDown, Flag, X, Box, ExternalLink, LayoutGrid, List, ChevronDown, Copy, Pencil, Package2, RefreshCw } from "lucide-react";
import type { Message, InlineProduct } from "@/types/sourcing";
import { cleanProductTitle } from "@/lib/product";

import DeliveryCard from "./cards/DeliveryCard";
import TrackingCard from "./cards/TrackingCard";

import ServiceListingCard from "./cards/ServiceListingCard";
import CheckoutCard from "./cards/CheckoutCard";
import OrderFlowCard from "./cards/OrderFlowCard";
import OrderStepBubble from "./cards/OrderStepBubble";
import ProductGrid from "./ProductGrid";
import ThinkingPanel from "./ThinkingPanel";

interface ProductSectionProps {
  title: string;
  products: InlineProduct[];
  msg: Message;
  selectedProductIds: string[];
  onToggleSelectProduct?: (product: InlineProduct) => void;
  onBuyProduct?: (product: InlineProduct) => void;
  renderClosableToolCard: (
    msgId: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode,
    isClosable?: boolean,
    headerActions?: React.ReactNode,
    badge?: React.ReactNode
  ) => React.ReactNode;
}

function SortDropdown({
  value,
  onChange,
}: {
  value: "default" | "lowToHigh" | "highToLow";
  onChange: (val: "default" | "lowToHigh" | "highToLow") => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const options = [
    { value: "default", label: "Relevance" },
    { value: "lowToHigh", label: "Price: Low to High" },
    { value: "highToLow", label: "Price: High to Low" },
  ] as const;

  const activeLabel = options.find((opt) => opt.value === value)?.label || "Relevance";

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-bold text-[11px] outline-none cursor-pointer py-1 transition-colors select-none"
      >
        <span>{activeLabel}</span>
        <ChevronDown
          size={11}
          className={`text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-50 animate-fadeIn min-w-[150px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors duration-150 cursor-pointer ${
                value === opt.value
                  ? "bg-[#402970]/5 text-[#402970]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductSection({
  title,
  products,
  msg,
  selectedProductIds,
  onToggleSelectProduct,
  onBuyProduct,
  renderClosableToolCard,
}: ProductSectionProps) {
  const [sortOrder, setSortOrder] = useState<"default" | "lowToHigh" | "highToLow">("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const uniqueProducts = React.useMemo(() => {
    if (!products) return [];
    const seen = new Set<string>();
    return products.filter((p) => {
      if (!p.id) return true;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [products]);

  if (uniqueProducts.length === 0) return null;

  const badge = (
    <span className="px-2 py-0.5 bg-[#402970]/8 text-[#402970] text-[10px] font-bold rounded-full border border-[#402970]/15 select-none ml-1">
      {uniqueProducts.length} results
    </span>
  );

  const headerActions = (
    <div className="flex items-center gap-3 select-none">
      {/* Transparent sort select */}
      <SortDropdown value={sortOrder} onChange={setSortOrder} />

      {/* Vertical divider */}
      <div className="h-3 w-[1px] bg-slate-200"></div>

      {/* Grid / List view toggle */}
      <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
        <button
          onClick={() => setViewMode("grid")}
          title="Grid view"
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            viewMode === "grid"
              ? "bg-white text-[#402970] shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <LayoutGrid size={14} />
        </button>
        <button
          onClick={() => setViewMode("list")}
          title="List view"
          className={`p-1.5 rounded-md transition-all cursor-pointer ${
            viewMode === "list"
              ? "bg-white text-[#402970] shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <List size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {renderClosableToolCard(
        msg.id,
        title,
        <Box size={16} className="text-[#402970] shrink-0" />,
        <ProductGrid
          products={uniqueProducts}
          selectedIds={selectedProductIds}
          onToggle={onToggleSelectProduct}
          onBuy={onBuyProduct}
          sortOrder={sortOrder}
          viewMode={viewMode}
        />,
        false, // isClosable = false
        headerActions,
        badge
      )}
    </>
  );
}

interface ChatTimelineProps {
  activeHistoryId?: string;
  messages: Message[];
  isGenerating: boolean;
  activeQueryText?: string;
  onSampleClick?: (sampleText: string) => void;
  onDirectSend?: (text: string) => void;
  onViewMoreProducts?: (products: InlineProduct[], queryHint?: string) => void;
  selectedProductIds?: string[];
  onToggleSelectProduct?: (product: InlineProduct) => void;
  onBuyProduct?: (product: InlineProduct) => void;
  onEditMessage?: (messageId: string, text: string) => void;
  onRegenerate?: () => void;
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

interface ParsedSection {
  type: "intro" | "details" | "general";
  groupTitle?: string;
  text: string;
  key: string;
}

function parseMessageText(text: string): ParsedSection[] {
  if (!text) return [];

  const sections: ParsedSection[] = [];
  const tagRegex = /\[(INTRO|DETAILS):\s*([^\]]+)\]/gi;
  
  let lastIndex = 0;
  let currentType: "intro" | "details" | "general" = "general";
  let currentGroupTitle: string | undefined = undefined;
  let generalCount = 0;
  
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const contentText = text.substring(lastIndex, matchIndex);
    
    if (contentText.trim() || currentType !== "general") {
      const key = currentType === "general"
        ? `general_${generalCount++}`
        : `${currentType}_${currentGroupTitle}`;
      sections.push({
        type: currentType,
        groupTitle: currentGroupTitle,
        text: contentText,
        key
      });
    }
    
    currentType = match[1].toLowerCase() as "intro" | "details";
    currentGroupTitle = match[2].trim();
    lastIndex = tagRegex.lastIndex;
  }
  
  const remainingText = text.substring(lastIndex);
  if (remainingText.trim() || currentType !== "general") {
    const key = currentType === "general"
      ? `general_${generalCount++}`
      : `${currentType}_${currentGroupTitle}`;
    sections.push({
      type: currentType,
      groupTitle: currentGroupTitle,
      text: remainingText,
      key
    });
  }
  
  return sections;
}

function renderMessageTextBlock(
  text: string,
  isLastAIResponse: boolean,
  showCursor: boolean
) {
  if (!text) return null;
  const lines = text.split("\n");
  
  // Find the last non-empty line index to append the cursor
  let lastNonEmptyIdx = -1;
  if (showCursor) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() !== "") {
        lastNonEmptyIdx = i;
        break;
      }
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
                    className={`px-4 py-2.5 text-slate-800 ${alignments[cIdx] || "text-left"}`}
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

    // Horizontal Rule (---, ***, ___)
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      processedElements.push(
        <hr key={lineIdx} className="border-t border-slate-200/80 my-4" />
      );
      continue;
    }

    const isLastLine = showCursor && lineIdx === lastNonEmptyIdx;

    // Blockquote (> text)
    const blockquoteMatch = line.match(/^\s*>\s+(.*)/);
    if (blockquoteMatch) {
      const quoteContent = blockquoteMatch[1];
      processedElements.push(
        <blockquote
          key={lineIdx}
          className="border-l-4 border-[#402970]/30 bg-[#402970]/5 pl-3 py-2 my-2 rounded-r-lg text-slate-700 italic text-sm"
        >
          {renderFormattedText(quoteContent)}
          {isLastAIResponse && isLastLine && (
            <span className="inline-block w-1.5 h-3.5 bg-[#402970] ml-1.5 animate-pulse rounded-full align-middle" />
          )}
        </blockquote>
      );
      continue;
    }

    // Headers (###, ##, #, etc.)
    const headerMatch = line.match(/^(\s*)(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[2].length;
      const content = headerMatch[3];

      if (level >= 4) {
        processedElements.push(
          <h6 key={lineIdx} className="text-[13px] font-extrabold text-slate-800 mt-3 mb-1 select-none">
            {renderFormattedText(content)}
          </h6>
        );
      } else if (level === 3) {
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

  return (
    <div className="text-sm text-slate-800 font-medium leading-relaxed space-y-1.5 select-text">
      {processedElements}
    </div>
  );
}

export default function ChatTimeline({
  activeHistoryId,
  messages,
  isGenerating,
  activeQueryText,
  onSampleClick,
  onDirectSend,
  onViewMoreProducts,
  selectedProductIds = [],
  onToggleSelectProduct,
  onBuyProduct,
  onEditMessage,
  onRegenerate,
}: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);
  const scrolledToolsRef = useRef<Set<string>>(new Set());
  const lastHistoryIdRef = useRef<string | undefined>(undefined);

  // Reset scrolledToolsRef when switching conversation or clearing messages
  useEffect(() => {
    if (messages.length === 0) {
      scrolledToolsRef.current.clear();
    }
  }, [messages]);

  // Local state to keep track of closed tool result cards per message ID
  const [closedMessages, setClosedMessages] = React.useState<Record<string, boolean>>({});

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (msgId: string, text: string) => {
    setEditingMessageId(msgId);
    setEditingText(text);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleUpdateSubmit = (msgId: string) => {
    if (!editingText.trim()) return;
    onEditMessage?.(msgId, editingText.trim());
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, msgId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUpdateSubmit(msgId);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Find index of the last active order flow step to compute isActive prop
  const lastOrderStepIdx = messages.map(m => !!m.orderFlowStep).lastIndexOf(true);

  const lastAiMessage = [...messages].reverse().find(m => m.sender === "ai");
  const lastOrderFlowStep = [...messages].reverse().find(m => !!m.orderFlowStep)?.orderFlowStep;
  const hasActiveCheckout = !!(lastOrderFlowStep && lastOrderFlowStep.phase !== "confirmed" && (lastOrderFlowStep.phase as string) !== "cancelled");
  const isLatestMessageCheckout = !!(lastAiMessage && lastAiMessage.orderFlowStep);
  const isCheckoutActive = hasActiveCheckout && !isLatestMessageCheckout;

  // Helper to render closable B2B card wrappers
  const renderClosableToolCard = (
    msgId: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode,
    isClosable = true,
    headerActions?: React.ReactNode,
    badge?: React.ReactNode
  ) => {
    if (closedMessages[msgId]) return null;

    return (
      <div 
        data-tool-card={msgId}
        className="border border-slate-100 rounded-[20px] p-5 bg-white shadow-sm w-full mt-4 select-none animate-fadeIn"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          {/* Left side: Tool Icon & Name */}
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-[14px] font-bold text-slate-800">{title}</span>
            {badge}
          </div>
          {/* Right side: Close button and actions */}
          <div className="flex items-center gap-3">
            {headerActions}
            {isClosable && (
              <button
                onClick={() => setClosedMessages(prev => ({ ...prev, [msgId]: true }))}
                className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {content}
      </div>
    );
  };

  useEffect(() => {
    // 1. Session switch detection (hydration/history load)
    if (activeHistoryId !== lastHistoryIdRef.current) {
      lastHistoryIdRef.current = activeHistoryId;
      prevLengthRef.current = messages.length;

      // Mark all past messages as already scrolled/focused
      messages.forEach(m => scrolledToolsRef.current.add(m.id));

      // Scroll so the last user query is aligned to the top of the viewport (and AI response is below it)
      setTimeout(() => {
        const userMsgElements = containerRef.current?.querySelectorAll('[data-message-sender="user"]');
        if (userMsgElements && userMsgElements.length > 0) {
          const lastUserMsgElement = userMsgElements[userMsgElements.length - 1];
          lastUserMsgElement.scrollIntoView({ behavior: "auto", block: "start" });
        } else {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
      }, 80);
      return;
    }

    const prevLength = prevLengthRef.current;
    prevLengthRef.current = messages.length;

    // Auto-scroll and center the viewport on any newly arrived tool response card (active chatting only)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.sender === "ai") {
      const hasToolResponse = 
        (lastMsg.inlineProducts && lastMsg.inlineProducts.length > 0) ||
        lastMsg.deliveryResult ||
        lastMsg.trackingResult ||
        lastMsg.serviceListing ||
        lastMsg.checkoutFormProduct ||
        lastMsg.orderFlowStep;

      if (hasToolResponse && !scrolledToolsRef.current.has(lastMsg.id)) {
        scrolledToolsRef.current.add(lastMsg.id);
        setTimeout(() => {
          const element = containerRef.current?.querySelector(`[data-tool-card="${lastMsg.id}"]`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 150);
        return;
      }
    }

    if (messages.length > prevLength) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (isGenerating) {
      const container = containerRef.current;
      if (container) {
        const threshold = 150;
        if (container.scrollHeight - container.scrollTop - container.clientHeight <= threshold) {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
      }
    }
  }, [messages, isGenerating, activeHistoryId]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 pt-16 space-y-6 flex flex-col items-center w-full"
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="w-full max-w-3xl space-y-6 flex flex-col">
        {messages.map((msg, idx) => {
          const isUser = msg.sender === "user";
          const isLastAIResponse = !isUser && idx === messages.length - 1 && isGenerating;
          return (
            <div 
              key={msg.id} 
              data-message-sender={msg.sender}
              className={`flex w-full ${isUser ? "justify-end" : "justify-start"} animate-fadeIn`}
            >
              <div className={`flex flex-col gap-1 max-w-[88%] ${isUser ? "w-full items-end" : "w-full items-start"}`}>

                {/* User message */}
                {isUser ? (
                  <div className="flex flex-col items-end gap-2 max-w-full">
                    {/* Selected products cards */}
                    {msg.inlineProducts && msg.inlineProducts.length > 0 && (
                      <div className="flex flex-wrap gap-3 justify-end select-none">
                        {msg.inlineProducts.map((prod) => (
                          <div
                            key={prod.id}
                            className="bg-white rounded-2xl overflow-hidden border border-slate-100 flex flex-col w-32 sm:w-36 shadow-xs hover:shadow-sm transition-all duration-200 animate-fadeIn"
                          >
                            <div className="relative aspect-square bg-slate-50 overflow-hidden shrink-0 border-b border-slate-100/60">
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
                                <span className="text-xl select-none">{prod.image || "🛍️"}</span>
                              )}
                            </div>
                            <div className="p-2.5 flex flex-col justify-center flex-1 min-w-0">
                              <span className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 break-all">
                                {cleanProductTitle(prod.name || prod.title)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text bubble & Custom Inline Input Editor */}
                    {editingMessageId === msg.id ? (
                      /* Custom Inline Input Editor */
                      <div className="w-full sm:min-w-[400px] flex flex-col gap-2 mt-1 animate-fadeIn">
                        <div className="relative border border-[#402970]/30 focus-within:border-[#402970] focus-within:ring-2 focus-within:ring-[#402970]/10 rounded-xl bg-slate-50 overflow-hidden transition-all duration-200">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                            className="w-full min-h-[60px] max-h-[160px] resize-none outline-none border-none bg-transparent text-slate-800 placeholder-slate-400 text-sm p-3 font-semibold leading-normal"
                            autoFocus
                          />
                        </div>
                        
                        {/* Cancel & Update Action Buttons */}
                        <div className="flex items-center justify-end gap-1.5 text-xs">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-650 hover:text-slate-900 font-bold rounded-lg border border-slate-200 transition-all cursor-pointer shadow-xs active:scale-98 select-none"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateSubmit(msg.id)}
                            disabled={!editingText.trim() || isGenerating}
                            className={`px-3 py-1 font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-98 select-none ${
                              editingText.trim() && !isGenerating
                                ? "bg-[#402970] text-white hover:bg-[#33205a]"
                                : "bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed"
                            }`}
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal User Bubble with Hover Overlay actions */
                      <div className="relative group max-w-full">
                        {/* Text bubble */}
                        <div className={`px-4 py-2.5 font-semibold shadow-xs text-sm ${
                          msg.inlineProducts && msg.inlineProducts.length > 0
                            ? "bg-[#402970]/5 border border-[#402970]/10 text-[#402970] rounded-2xl"
                            : "bg-slate-100 text-slate-800 rounded-full border border-slate-200/20"
                        }`}>
                          {msg.text.startsWith("Delivery date confirmed:") ? "Delivery Date Confirmed" : msg.text.startsWith("New address confirmed:") ? "New delivery address added" : msg.text}
                        </div>

                        {/* Hover Actions (Copy / Edit) */}
                        {!isGenerating && (
                          <div className="absolute -bottom-5 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex items-center bg-white border border-slate-200/80 shadow-xs rounded-lg p-0.5 z-10 gap-0.5 select-none">
                            <button
                              onClick={() => handleCopy(msg.id, msg.text)}
                              className="p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-[#402970] transition-colors cursor-pointer"
                              title="Copy message"
                            >
                              {copiedId === msg.id ? (
                                <Check size={12} className="text-emerald-500 font-bold" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                            <button
                              onClick={() => handleStartEdit(msg.id, msg.text)}
                              className="p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-[#402970] transition-colors cursor-pointer"
                              title="Edit query"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
                            activeToolCalls={msg.activeToolCalls}
                            isGenerating={isLastAIResponse}
                            hasText={!!msg.text}
                            inlineProducts={msg.inlineProducts}
                            productGroups={msg.productGroups}
                            activeQueryText={activeQueryText}
                            onViewDetails={onViewMoreProducts}
                          />
                        )}

                        {/* ── Pillar 1/3: Product Grid with mixed LLM text ── */}
                        {(() => {
                          const hasProducts = (msg.productGroups && msg.productGroups.length > 0) || (msg.inlineProducts && msg.inlineProducts.length > 0);
                          if (!hasProducts) {
                            return msg.text ? renderMessageTextBlock(msg.text, isLastAIResponse, true) : null;
                          }

                          const parsedSections = parseMessageText(msg.text);

                          const unifiedGroups = msg.productGroups && msg.productGroups.length > 0
                            ? msg.productGroups
                            : (msg.inlineProducts && msg.inlineProducts.length > 0
                                ? [{ title: msg.inlineProductsHeader || "Product search", products: msg.inlineProducts }]
                                : []
                              );

                          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

                          return (
                            <div className="space-y-4 w-full">
                              {parsedSections
                                .filter((s) => {
                                  if (s.type !== "general") return false;
                                  const rawIdx = parsedSections.indexOf(s);
                                  const firstTaggedIdx = parsedSections.findIndex(p => p.type === "intro" || p.type === "details");
                                  return firstTaggedIdx !== -1 && rawIdx < firstTaggedIdx;
                                })
                                .map((s) => {
                                  const rawIdx = parsedSections.indexOf(s);
                                  const isLast = rawIdx === parsedSections.length - 1;
                                  return (
                                    <div key={s.key} className="animate-fadeIn">
                                      {renderMessageTextBlock(s.text, isLastAIResponse, isLast)}
                                    </div>
                                  );
                                })}

                              {unifiedGroups.map((group, gIdx) => {
                                const groupNorm = norm(group.title);
                                const introSec = parsedSections.find(s => s.type === "intro" && s.groupTitle && norm(s.groupTitle) === groupNorm);
                                const introIdx = introSec ? parsedSections.indexOf(introSec) : -1;
                                const isIntroLast = introIdx === parsedSections.length - 1;

                                const detailsSec = parsedSections.find(s => s.type === "details" && s.groupTitle && norm(s.groupTitle) === groupNorm);
                                const detailsIdx = detailsSec ? parsedSections.indexOf(detailsSec) : -1;
                                const isDetailsLast = detailsIdx === parsedSections.length - 1;

                                return (
                                  <div key={`mixed-group-${gIdx}`} className="space-y-4">
                                    {introSec && introSec.text.trim() && (
                                      <div key={introSec.key} className="animate-fadeIn">
                                        {renderMessageTextBlock(introSec.text, isLastAIResponse, isIntroLast)}
                                      </div>
                                    )}

                                    <ProductSection
                                      title={group.title}
                                      products={group.products}
                                      msg={msg}
                                      selectedProductIds={selectedProductIds}
                                      onToggleSelectProduct={onToggleSelectProduct}
                                      onBuyProduct={onBuyProduct}
                                      renderClosableToolCard={renderClosableToolCard}
                                    />

                                    {detailsSec && detailsSec.text.trim() && (
                                      <div key={detailsSec.key} className="animate-fadeIn">
                                        {renderMessageTextBlock(detailsSec.text, isLastAIResponse, isDetailsLast)}
                                      </div>
                                    )}

                                    {gIdx < unifiedGroups.length - 1 && (
                                      <hr className="border-t border-slate-200/80 my-6" />
                                    )}
                                  </div>
                                );
                              })}

                              {/* 3. Concluding general or unmapped sections */}
                              {parsedSections
                                .filter((s) => {
                                  if (s.type === "general") {
                                    const firstTaggedIdx = parsedSections.findIndex(p => p.type === "intro" || p.type === "details");
                                    const rawIdx = parsedSections.indexOf(s);
                                    return firstTaggedIdx === -1 || rawIdx > parsedSections.map(p => p.type === "intro" || p.type === "details").lastIndexOf(true);
                                  }
                                  const title = s.groupTitle;
                                  if (!title) return true;
                                  return !unifiedGroups.some(g => norm(g.title) === norm(title));
                                })
                                .map((s) => {
                                  const rawIdx = parsedSections.indexOf(s);
                                  const isLast = rawIdx === parsedSections.length - 1;
                                  return (
                                    <div key={s.key} className="animate-fadeIn">
                                      {s.type !== "general" && s.groupTitle && s.groupTitle.toLowerCase() !== "past orders" && (
                                        <h5 className="text-[13px] font-extrabold text-slate-800 mt-3 mb-1.5 select-none">
                                          {s.groupTitle} ({s.type})
                                        </h5>
                                      )}
                                      {renderMessageTextBlock(s.text, isLastAIResponse, isLast)}
                                    </div>
                                  );
                                })}
                            </div>
                          );
                        })()}


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
                            <Package2 size={16} className="text-[#402970] shrink-0" />,
                            <TrackingCard tracking={msg.trackingResult} />
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
                          <div data-tool-card={msg.id}>
                            <CheckoutCard product={msg.checkoutFormProduct} />
                          </div>
                        )}

                        {/* ── Conversational Order Flow Step Bubble (NEW) ── */}
                        {msg.orderFlowStep && (
                          <div data-tool-card={msg.id}>
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
                          </div>
                        )}

                        {/* ── Legacy Order Flow Card (backward compat) ── */}
                        {!msg.orderFlowStep && msg.orderFlowProduct && (
                          <div data-tool-card={msg.id}>
                            <OrderFlowCard
                              product={msg.orderFlowProduct}
                              stockStatus={msg.orderFlowStockStatus}
                              stockQty={msg.orderFlowStockQty}
                            />
                          </div>
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
                                  <span className="truncate max-w-[200px]">{cleanProductTitle(link.productTitle)}</span>
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

                    {/* Action bar: Regenerate + Reactions */}
                    <div className="flex items-center gap-1.5 text-slate-400 select-none pt-1">
                      {/* Regenerate button - only on the last AI message when not generating */}
                      {idx === messages.length - 1 && !isGenerating && !msg.orderFlowStep && onRegenerate && (
                        <button
                          onClick={() => onRegenerate()}
                          className="p-1.5 hover:bg-slate-50 hover:text-[#402970] rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="Regenerate response"
                        >
                          <RefreshCw size={13} className="text-slate-400 hover:text-[#402970] transition-colors" />
                          <span className="text-slate-500 hover:text-[#402970] transition-colors">Regenerate</span>
                        </button>
                      )}
                      {idx === messages.length - 1 && !isGenerating && !msg.orderFlowStep && onRegenerate && (
                        <div className="h-3 w-[1px] bg-slate-200"></div>
                      )}
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

                {/* Timestamp (AI only) */}
                {!isUser && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 justify-start">
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}


      </div>
      <div 
        className={`w-full shrink-0 transition-all duration-300 ${
          selectedProductIds.length > 0 ? "h-56" : isCheckoutActive ? "h-32" : "h-24"
        }`} 
      />
      <div ref={bottomRef} />
    </div>
  );
}
