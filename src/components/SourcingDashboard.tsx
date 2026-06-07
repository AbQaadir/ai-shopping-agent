"use client";

import React, { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LandingView from "@/components/LandingView";
import ChatView from "@/components/ChatView";
import { MessageSquare } from "lucide-react";
import { InlineProduct, Message } from "@/components/ChatTimeline";
import { useRouter } from "next/navigation";

interface HistoryItem {
  id: string;
  query: string;
  date: string;
  queryType: "design" | "manufacturer" | "bestseller" | "product" | "general";
  messages: Message[];
  isPinned?: boolean;
}

interface SourcingDashboardProps {
  initialSessionId?: string;
}

export default function SourcingDashboard({ initialSessionId }: SourcingDashboardProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
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

  useEffect(() => {
    fetchHistory();
  }, []);

  // Hydrate session if initialSessionId prop is passed or changed
  useEffect(() => {
    if (initialSessionId) {
      setActiveHistoryId(initialSessionId);
      setIsChatting(true);
      fetchSessionAndHydrate(initialSessionId);
    } else {
      handleResetLocal();
    }
  }, [initialSessionId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/session");
      if (res.ok) {
        const data = await res.json();
        const items = data.map((session: any) => ({
          id: session.id,
          query: session.title,
          date: new Date(session.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
          queryType: "product",
          messages: [],
          isPinned: session.status === "pinned"
        }));
        setHistory(items);
      }
    } catch (err) {
      console.error("Failed to load history sessions:", err);
    }
  };

  const handlePinSession = async (id: string, isPinned: boolean) => {
    try {
      const res = await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: isPinned ? "pinned" : "active" })
      });
      if (res.ok) {
        await fetchHistory();
      }
    } catch (err) {
      console.error("Failed to pin/unpin session:", err);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      const res = await fetch(`/api/session?id=${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        if (activeHistoryId === id) {
          handleResetLocal();
          router.push("/");
        }
        await fetchHistory();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const fetchSessionAndHydrate = async (id: string) => {
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
        const mappedMessages: Message[] = sessionData.messages.map((m: any) => {
          let inlineProducts: InlineProduct[] = [];
          if (m.products) {
            try {
              inlineProducts = typeof m.products === "string" ? JSON.parse(m.products) : m.products;
            } catch (e) {
              console.error("Error parsing product data:", e);
            }
          }
          let thinkingSteps: any[] = [];
          let followUpSamples: string[] = [];
          if (m.thoughtProcess) {
            try {
              const parsedProcess = typeof m.thoughtProcess === "string" ? JSON.parse(m.thoughtProcess) : m.thoughtProcess;
              if (parsedProcess && parsedProcess.steps) {
                thinkingSteps = parsedProcess.steps;
                followUpSamples = parsedProcess.followUpQuestions || [];
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
            return prev.map((h) => (h.id === id ? { ...h, messages: mappedMessages, isPinned: sessionData.status === "pinned" } : h));
          } else {
            return [
              {
                id: sessionData.id,
                query: sessionData.title,
                date: new Date(sessionData.createdAt).toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
                queryType: "product",
                messages: mappedMessages,
                isPinned: sessionData.status === "pinned"
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
  };

  const handleResetLocal = () => {
    setIsChatting(false);
    setMessages([]);
    setActiveHistoryId(undefined);
    setActiveQueryText("");
    setIsGenerating(false);
  };

  // Handle New Session / Reset
  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    router.push("/");
  };

  // Select history item in sidebar
  const handleSelectHistory = (id: string) => {
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
    
    const attachments = files.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type
    }));

    const newUserMessage: Message = {
      id: userMessageId,
      sender: "user",
      text: text || `Attached ${files.length} document(s) for review`,
      timestamp,
      attachments,
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
            messages: [],
            isPinned: false
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
                      steps[existingIdx] = {
                        step: packet.step,
                        status: packet.status,
                        content: packet.content,
                        durationMs: packet.durationMs,
                      };
                    } else {
                      steps.push({
                        step: packet.step,
                        status: packet.status,
                        content: packet.content,
                        durationMs: packet.durationMs,
                      });
                    }
                    return { ...m, thinkingSteps: steps };
                  }
                  return m;
                }));
              } else if (packet.type === "tool_call") {
                setMessages(prev => prev.map(m => {
                  if (m.id === aiMessageId) {
                    return {
                      ...m,
                      activeToolCall: { name: packet.name, args: packet.args }
                    };
                  }
                  return m;
                }));
              } else if (packet.type === "tool_result") {
                if (packet.result && packet.result.products) {
                  inlineProducts = packet.result.products;
                  setMessages(prev => prev.map(m => {
                    if (m.id === aiMessageId) {
                      return {
                        ...m,
                        activeToolCall: null,
                        inlineProductsHeader: "Matched Sourcing Products",
                        inlineProducts,
                        showViewProductsButton: true,
                      };
                    }
                    return m;
                  }));
                }
              } else if (packet.type === "text") {
                setIsGenerating(false);
                fullResponseText += packet.content;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponseText } : m));
              } else if (packet.type === "follow_ups") {
                if (packet.questions) {
                  followUpQuestions = packet.questions;
                  setMessages(prev => prev.map(m => {
                    if (m.id === aiMessageId) {
                      return {
                        ...m,
                        followUpText: "Based on this session, you can continue with:",
                        followUpSamples: followUpQuestions
                      };
                    }
                    return m;
                  }));
                }
              }
            } catch (e) {
              console.error("Failed to parse event stream data line:", e, dataStr);
            }
          }
        }
      }

      // After loop completes successfully, construct final state
      const finalMappedAi: Message = {
        id: aiMessageId,
        sender: "ai",
        text: fullResponseText,
        timestamp: new Date(),
        thinkingSteps: messages.find(m => m.id === aiMessageId)?.thinkingSteps || [],
        inlineProductsHeader: inlineProducts.length > 0 ? "Matched Sourcing Products" : undefined,
        inlineProducts: inlineProducts.length > 0 ? inlineProducts : undefined,
        showViewProductsButton: inlineProducts.length > 0,
        followUpText: followUpQuestions.length > 0 
          ? "Based on this session, you can continue with:"
          : inlineProducts.length > 0 
            ? "Based on these options, you can continue with:" 
            : undefined,
        followUpSamples: followUpQuestions.length > 0 
          ? followUpQuestions 
          : (inlineProducts.length > 0 ? [
              "Filter by lower MOQ (e.g., < 10 pieces)",
              "Find specific styles like moon chairs or heavy-duty options",
              "Request customized logo printing for these models"
            ] : undefined)
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

    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Generation aborted");
      } else {
        console.error("Failed to stream message response:", err);
        setIsGenerating(false);
      }
    }
  };

  // Suggestion pill click transitions to chat with the initial prompt
  const handleSuggestionClick = () => {
    setIsChatting(true);
    setActiveQueryText(""); 
    
    const initialPrompt: Message = {
      id: "initial-prompt",
      sender: "ai",
      text: "",
      timestamp: new Date(),
      isInitialPrompt: true,
      samples: [
        "Find foldable camping chairs under $15.",
        "Minimalist desk lamp with fast shipping.",
        "Eco-friendly gifts for new hires, customizable with logo."
      ]
    };
    
    setMessages([initialPrompt]);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      {/* 1. Header (Top Area - spans full width) */}
      <Header 
        onNewSourcing={handleReset} 
        isCompact={isChatting} 
      />

      {/* 2. Content Area (Sidebar + Sourcing Workspace below the header) */}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onReset={handleReset}
          history={history}
          onSelectHistory={handleSelectHistory}
          activeHistoryId={activeHistoryId}
          onPinSession={handlePinSession}
          onDeleteSession={handleDeleteSession}
        />

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
              />
            ) : (
              <LandingView
                onSend={handleSendMessage}
                onSuggestionClick={handleSuggestionClick}
              />
            )}
          </div>
        </div>

        {/* Floating Message Drawer Bubble (bottom right on landing) */}
        {!isChatting && (
          <button className="fixed bottom-6 right-6 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-full px-5 py-3 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 z-30 font-semibold text-xs active:scale-95">
            <MessageSquare size={16} className="text-[#402970]" />
            Messages
          </button>
        )}
      </div>
    </div>
  );
}
