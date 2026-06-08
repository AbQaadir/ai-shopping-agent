"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LandingView from "@/components/LandingView";
import ChatView from "@/components/ChatView";
import { MessageSquare } from "lucide-react";
import { InlineProduct, Message, DeliveryResult, TrackingResult, ImportEstimate, ServiceListing } from "@/components/ChatTimeline";
import { useRouter } from "next/navigation";

interface HistoryItem {
  id: string;
  query: string;
  date: string;
  queryType: "design" | "manufacturer" | "bestseller" | "product" | "general";
  messages: Message[];
}

interface SourcingDashboardProps {
  initialSessionId?: string;
}

export default function SourcingDashboard({ initialSessionId }: SourcingDashboardProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(initialSessionId);
  const [activeQueryText, setActiveQueryText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // AbortController to support stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active message thread
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const data = await res.json();
        const items = data.map((session: { id: string; title: string; createdAt: string }) => ({
          id: session.id,
          query: session.title,
          date: new Date(session.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
          queryType: "product",
          messages: []
        }));
        setHistory(items);
      }
    } catch (err) {
      console.error("Failed to load history sessions:", err);
    }
  }, []);

  const fetchSessionAndHydrate = useCallback(async (id: string) => {
    try {
      // Find if we already loaded it in memory history list
      const cachedItem = history.find((h) => h.id === id && h.messages.length > 0);
      if (cachedItem) {
        setMessages(cachedItem.messages);
        setActiveQueryText(cachedItem.query);
        setIsChatting(true);
        return;
      }

      const res = await fetch(`/api/session?id=${id}`);
      if (res.ok) {
        const sessionData = await res.json();
        const mappedMessages: Message[] = sessionData.messages.map((m: { id: string; role: string; content: string; createdAt: string; products?: unknown; thoughtProcess?: unknown }) => {
          let inlineProducts: InlineProduct[] = [];
          if (m.products) {
            try {
              inlineProducts = typeof m.products === "string" ? JSON.parse(m.products) : (m.products as InlineProduct[]);
            } catch (e) {
              console.error("Error parsing product data:", e);
            }
          }
          let thinkingSteps: { step: string; status: "running" | "completed"; content: string; durationMs?: number }[] = [];
          let followUpSamples: string[] = [];
          if (m.thoughtProcess) {
            try {
              const parsedProcess = typeof m.thoughtProcess === "string" ? JSON.parse(m.thoughtProcess) : m.thoughtProcess;
              if (parsedProcess && (parsedProcess as Record<string, unknown>).steps) {
                thinkingSteps = (parsedProcess as { steps: typeof thinkingSteps }).steps;
                followUpSamples = (parsedProcess as { followUpQuestions?: string[] }).followUpQuestions || [];
              } else if (Array.isArray(parsedProcess)) {
                thinkingSteps = parsedProcess;
              }
            } catch (e) {
              console.error("Error parsing thought process data:", e);
            }
          }
          return {
            id: m.id,
            sender: m.role === "user" ? "user" : "ai",
            text: m.content,
            timestamp: new Date(m.createdAt),
            thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
            inlineProductsHeader: inlineProducts.length > 0 ? "Matched Sourcing Products" : undefined,
            inlineProducts: inlineProducts.length > 0 ? inlineProducts : undefined,
            showViewProductsButton: inlineProducts.length > 0,
            followUpText: followUpSamples.length > 0 
              ? "Based on this session, you can continue with:" 
              : inlineProducts.length > 0 
                ? "Based on these options, you can continue with:" 
                : undefined,
            followUpSamples: followUpSamples.length > 0 
              ? followUpSamples 
              : inlineProducts.length > 0 
                ? [
                    "Filter by lower MOQ (e.g., < 10 pieces)",
                    "Find specific styles like moon chairs or heavy-duty options",
                    "Request customized logo printing for these models"
                  ] 
                : undefined
          };
        });

        setMessages(mappedMessages);
        setActiveQueryText(sessionData.title);
        setIsChatting(true);

        setHistory(prev => {
          const exists = prev.some((h) => h.id === id);
          if (exists) {
            return prev.map((h) => (h.id === id ? { ...h, messages: mappedMessages } : h));
          } else {
            return [
              {
                id: sessionData.id,
                query: sessionData.title,
                date: new Date(sessionData.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
                queryType: "product",
                messages: mappedMessages
              },
              ...prev
            ];
          }
        });
      } else {
        console.warn(`Session ${id} not found on server, redirecting to root.`);
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to load session details:", err);
    }
  }, [history, router]);

  const handleResetLocal = useCallback(() => {
    setIsChatting(false);
    setMessages([]);
    setActiveHistoryId(undefined);
    setActiveQueryText("");
    setIsGenerating(false);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchHistory();
    });
  }, [fetchHistory]);

  // Hydrate session if initialSessionId prop is passed or changed
  useEffect(() => {
    if (initialSessionId) {
      Promise.resolve().then(() => {
        setActiveHistoryId(initialSessionId);
        setIsChatting(true);
        fetchSessionAndHydrate(initialSessionId);
      });
    } else {
      Promise.resolve().then(() => {
        handleResetLocal();
      });
    }
  }, [initialSessionId, fetchSessionAndHydrate, handleResetLocal]);

  // Handle New Session / Reset
  const handleReset = () => {
    setIsMobileSidebarOpen(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    router.push("/");
  };

  // Select history item in sidebar
  const handleSelectHistory = (id: string) => {
    setIsMobileSidebarOpen(false);
    router.push(`/c/${id}`);
  };

  // Stop Generation Handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // Send query action with dynamic SSE streaming
  const handleSendMessage = async (text: string, files: File[]) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessageId = `msg-${Date.now()}`;
    const timestamp = new Date();

    const newUserMessage: Message = {
      id: userMessageId,
      sender: "user",
      text: text || `Attached ${files.length} document(s) for review`,
      timestamp,
      status: "sending"
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsChatting(true);
    setIsGenerating(true);
    setActiveQueryText(text || "Uploaded design request");

    try {
      // 1. Establish session if not active
      let currentSessionId: string = activeHistoryId || "";
      if (!currentSessionId) {
        const sessionRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text || "New Sourcing Task" })
        });
        if (sessionRes.ok) {
          const newSession = await sessionRes.json();
          currentSessionId = newSession.id;
          setActiveHistoryId(currentSessionId);
          
          const newHistoryItem: HistoryItem = {
            id: currentSessionId,
            query: text || "New Sourcing Task",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: []
          };
          setHistory(prev => [newHistoryItem, ...prev]);
          
          // Switch URL subpath to dynamic session ID without triggering component unmount
          window.history.replaceState(null, "", `/c/${currentSessionId}`);
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
          window.history.replaceState(null, "", `/c/${currentSessionId}`);
        }
      }

      // Mark user message as sent locally
      setMessages(prev => prev.map(m => m.id === userMessageId ? { ...m, status: "sent" as const } : m));

      // 2. Post chat message and start stream
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, message: text || "Uploaded design request" }),
        signal: abortController.signal
      });

      if (!res.ok) {
        throw new Error("Failed to post message to chat api");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error("No stream reader available");
      }

      const aiMessageId = `ai-msg-${Date.now()}`;
      const newAiMessage: Message = {
        id: aiMessageId,
        sender: "ai",
        text: "",
        timestamp: new Date(),
        thinkingSteps: [],
        activeToolCall: null,
      };
      setMessages(prev => [...prev, newAiMessage]);

      let buffer = "";
      let fullResponseText = "";
      let inlineProducts: InlineProduct[] = [];
      let followUpQuestions: string[] = [];
      let deliveryResult: DeliveryResult | undefined;
      let trackingResult: TrackingResult | undefined;
      let importEstimate: ImportEstimate | undefined;
      let serviceListing: ServiceListing | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;

          if (cleaned.startsWith("data:")) {
            const dataStr = cleaned.replace("data:", "").trim();
            try {
              const packet = JSON.parse(dataStr);

              // ── Thought process updates ──
              if (packet.type === "thought") {
                setMessages(prev => prev.map(m => {
                  if (m.id === aiMessageId) {
                    const steps = m.thinkingSteps ? [...m.thinkingSteps] : [];
                    const existingIdx = steps.findIndex(s => s.step === packet.step);
                    if (existingIdx !== -1) {
                      steps[existingIdx] = { step: packet.step, status: packet.status, content: packet.content, durationMs: packet.durationMs };
                    } else {
                      steps.push({ step: packet.step, status: packet.status, content: packet.content, durationMs: packet.durationMs });
                    }
                    return { ...m, thinkingSteps: steps };
                  }
                  return m;
                }));

              // ── Tool call in-progress ──
              } else if (packet.type === "tool_call") {
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: { name: packet.name, args: packet.args } } : m
                ));

              // ── Pillar 1/3: Product results ──
              } else if (packet.type === "tool_result") {
                if (packet.result?.products) {
                  inlineProducts = packet.result.products;
                  setMessages(prev => prev.map(m =>
                    m.id === aiMessageId
                      ? { ...m, activeToolCall: null, inlineProductsHeader: "Kapruka Products", inlineProducts, showViewProductsButton: true }
                      : m
                  ));
                }

              // ── Pillar 2: Delivery result ──
              } else if (packet.type === "delivery_result") {
                deliveryResult = packet.result as DeliveryResult;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, deliveryResult } : m
                ));

              // ── Pillar 2: Order tracking result ──
              } else if (packet.type === "tracking_result") {
                trackingResult = packet.result as TrackingResult;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, trackingResult } : m
                ));

              // ── Pillar 4: Import estimate ──
              } else if (packet.type === "import_estimate") {
                importEstimate = packet.result as ImportEstimate;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, importEstimate } : m
                ));

              // ── Pillar 5: Service listing ──
              } else if (packet.type === "service_listing") {
                serviceListing = packet.result as ServiceListing;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, serviceListing } : m
                ));

              // ── Text token ──
              } else if (packet.type === "text") {
                setIsGenerating(false);
                fullResponseText += packet.content;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponseText } : m));

              // ── Follow-up suggestions ──
              } else if (packet.type === "follow_ups") {
                if (packet.questions) {
                  followUpQuestions = packet.questions;
                  setMessages(prev => prev.map(m =>
                    m.id === aiMessageId
                      ? { ...m, followUpText: "Continue with:", followUpSamples: followUpQuestions }
                      : m
                  ));
                }
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e, dataStr);
            }
          }
        }
      }

      // Finalise AI message state
      const finalMappedAi: Message = {
        id: aiMessageId,
        sender: "ai",
        text: fullResponseText,
        timestamp: new Date(),
        thinkingSteps: messages.find(m => m.id === aiMessageId)?.thinkingSteps || [],
        inlineProductsHeader: inlineProducts.length > 0 ? "Kapruka Products" : undefined,
        inlineProducts: inlineProducts.length > 0 ? inlineProducts : undefined,
        showViewProductsButton: inlineProducts.length > 0,
        deliveryResult,
        trackingResult,
        importEstimate,
        serviceListing,
        followUpText: followUpQuestions.length > 0 ? "Continue with:" : undefined,
        followUpSamples: followUpQuestions.length > 0 ? followUpQuestions : undefined,
      };

      setMessages(prev => prev.map(m => m.id === aiMessageId ? finalMappedAi : m));

      // Cache to history
      setHistory(prev => prev.map(h => {
        if (h.id === currentSessionId) {
          return {
            ...h,
            messages: [...updatedMessages.map(um => um.id === userMessageId ? { ...um, status: "sent" as const } : um), finalMappedAi]
          };
        }
        return h;
      }));

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Generation aborted");
      } else {
        console.error("Failed to stream message response:", err);
        setIsGenerating(false);
      }
    }
  };

  // Suggestion click: open chat with a pre-filled prompt
  const handleSuggestionClick = (suggestion?: string) => {
    setIsChatting(true);
    setActiveQueryText("");

    const initialPrompt: Message = {
      id: "initial-prompt",
      sender: "ai",
      text: "",
      timestamp: new Date(),
      isInitialPrompt: true,
      samples: [
        "Show me birthday cakes under Rs. 3,000",
        "Can you deliver flowers to Kandy this Saturday?",
        "https://amazon.com/dp/B0EXAMPLE — how much in Sri Lanka?",
        "My air conditioner is broken, find a technician in Colombo",
        "Show me handmade gifts from local Sri Lankan artisans",
      ],
    };

    setMessages([initialPrompt]);

    // If a specific suggestion text was passed, send it immediately
    if (suggestion) {
      setTimeout(() => handleSendMessage(suggestion, []), 100);
    }
  };

  // Buy product handler — opens checkout URL in new tab
  const handleBuyProduct = (product: InlineProduct) => {
    if (product.url) {
      window.open(product.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      {/* 1. Header (Top Area - spans full width) */}
      <Header 
        onNewSourcing={handleReset} 
        isCompact={isChatting} 
        onMenuToggle={() => setIsMobileSidebarOpen(prev => !prev)}
      />

      {/* 2. Content Area (Sidebar + Sourcing Workspace below the header) */}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          isMobileOpen={isMobileSidebarOpen}
          setIsMobileOpen={setIsMobileSidebarOpen}
          onReset={handleReset}
          history={history}
          onSelectHistory={handleSelectHistory}
          activeHistoryId={activeHistoryId}
        />

        {/* Mobile Sidebar Backdrop Overlay */}
        {isMobileSidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 transition-opacity duration-300"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Sourcing Workspace */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Dynamic Inner Panel Layout */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isChatting ? (
              <ChatView
                messages={messages}
                isGenerating={isGenerating}
                onSend={handleSendMessage}
                onBackToLanding={handleReset}
                activeQueryText={activeQueryText}
                onStopGeneration={handleStopGeneration}
                onBuyProduct={handleBuyProduct}
              />
            ) : (
              <LandingView
                onSend={handleSendMessage}
                onSuggestionClick={(s) => handleSuggestionClick(s)}
              />
            )}
          </div>
        </div>

        {/* Floating Message Drawer Bubble (bottom right on landing) */}
        {!isChatting && (
          <button className="fixed bottom-6 right-6 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-full px-5 py-3 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 z-20 font-semibold text-xs active:scale-95">
            <MessageSquare size={16} className="text-[#402970]" />
            Messages
          </button>
        )}
      </div>
    </div>
  );
}
