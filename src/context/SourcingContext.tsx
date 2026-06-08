"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InlineProduct, Message, HistoryItem, DeliveryResult, TrackingResult, ImportEstimate, ServiceListing } from "@/types/sourcing";

interface SourcingContextType {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isChatting: boolean;
  setIsChatting: React.Dispatch<React.SetStateAction<boolean>>;
  activeHistoryId: string | undefined;
  setActiveHistoryId: React.Dispatch<React.SetStateAction<string | undefined>>;
  activeQueryText: string;
  setActiveQueryText: React.Dispatch<React.SetStateAction<string>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  history: HistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;

  fetchHistory: () => Promise<void>;
  fetchSessionAndHydrate: (id: string) => Promise<void>;
  handleResetLocal: () => void;
  handleReset: () => void;
  handleSelectHistory: (id: string) => void;
  handleStopGeneration: () => void;
  handleSendMessage: (text: string, files: File[]) => Promise<void>;
  handleBuyProduct: (product: InlineProduct) => void;
  handleSuggestionClick: (suggestion?: string) => void;
}

const SourcingContext = createContext<SourcingContextType | undefined>(undefined);

export function SourcingProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(undefined);
  const [activeQueryText, setActiveQueryText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
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

  const handleReset = () => {
    setIsMobileSidebarOpen(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    router.push("/");
  };

  const handleSelectHistory = (id: string) => {
    setIsMobileSidebarOpen(false);
    router.push(`/c/${id}`);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

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
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
        }
      }

      setMessages(prev => prev.map(m => m.id === userMessageId ? { ...m, status: "sent" as const } : m));

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

              } else if (packet.type === "tool_call") {
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: { name: packet.name, args: packet.args } } : m
                ));

              } else if (packet.type === "tool_result") {
                if (packet.result?.products) {
                  inlineProducts = packet.result.products;
                  setMessages(prev => prev.map(m =>
                    m.id === aiMessageId
                      ? { ...m, activeToolCall: null, inlineProductsHeader: "Kapruka Products", inlineProducts, showViewProductsButton: true }
                      : m
                  ));
                }

              } else if (packet.type === "delivery_result") {
                deliveryResult = packet.result as DeliveryResult;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, deliveryResult } : m
                ));

              } else if (packet.type === "tracking_result") {
                trackingResult = packet.result as TrackingResult;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, trackingResult } : m
                ));

              } else if (packet.type === "import_estimate") {
                importEstimate = packet.result as ImportEstimate;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, importEstimate } : m
                ));

              } else if (packet.type === "service_listing") {
                serviceListing = packet.result as ServiceListing;
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, activeToolCall: null, serviceListing } : m
                ));

              } else if (packet.type === "text") {
                fullResponseText += packet.content;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponseText } : m));

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

      setIsGenerating(false);

      if (currentSessionId && !window.location.pathname.startsWith(`/c/${currentSessionId}`)) {
        window.history.replaceState(null, "", `/c/${currentSessionId}`);
      }

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

    if (suggestion) {
      setTimeout(() => handleSendMessage(suggestion, []), 100);
    }
  };

  const handleBuyProduct = (product: InlineProduct) => {
    if (product.url) {
      window.open(product.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <SourcingContext.Provider
      value={{
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isChatting,
        setIsChatting,
        activeHistoryId,
        setActiveHistoryId,
        activeQueryText,
        setActiveQueryText,
        isGenerating,
        setIsGenerating,
        messages,
        setMessages,
        history,
        setHistory,

        fetchHistory,
        fetchSessionAndHydrate,
        handleResetLocal,
        handleReset,
        handleSelectHistory,
        handleStopGeneration,
        handleSendMessage,
        handleBuyProduct,
        handleSuggestionClick
      }}
    >
      {children}
    </SourcingContext.Provider>
  );
}

export function useSourcing() {
  const context = useContext(SourcingContext);
  if (context === undefined) {
    throw new Error("useSourcing must be used within a SourcingProvider");
  }
  return context;
}
