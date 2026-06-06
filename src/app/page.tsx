"use client";

import React, { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LandingView from "@/components/LandingView";
import ChatView from "@/components/ChatView";
import { MessageSquare } from "lucide-react";
import { InlineProduct, Message } from "@/components/ChatTimeline";

interface HistoryItem {
  id: string;
  query: string;
  date: string;
  queryType: "design" | "manufacturer" | "bestseller" | "product" | "general";
  messages: Message[];
}

export default function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isChatting, setIsChatting] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(undefined);
  const [activeQueryText, setActiveQueryText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // AbortController to support stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active message thread
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

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
          messages: []
        }));
        setHistory(items);
      }
    } catch (err) {
      console.error("Failed to load history sessions:", err);
    }
  };

  // Handle New Session / Reset
  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsChatting(false);
    setMessages([]);
    setActiveHistoryId(undefined);
    setActiveQueryText("");
    setIsGenerating(false);
  };

  // Select history item
  const handleSelectHistory = async (id: string) => {
    const cachedItem = history.find((h) => h.id === id);
    if (cachedItem && cachedItem.messages.length > 0) {
      setMessages(cachedItem.messages);
      setActiveQueryText(cachedItem.query);
      setActiveHistoryId(cachedItem.id);
      setIsChatting(true);
      return;
    }

    try {
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
          return {
            id: m.id,
            sender: m.role === "user" ? "user" : "ai",
            text: m.content,
            timestamp: new Date(m.createdAt),
            inlineProductsHeader: inlineProducts.length > 0 ? "Matched Sourcing Products" : undefined,
            inlineProducts: inlineProducts.length > 0 ? inlineProducts : undefined,
            showViewProductsButton: inlineProducts.length > 0,
            followUpText: inlineProducts.length > 0 ? "Based on these options, you can continue with:" : undefined,
            followUpSamples: inlineProducts.length > 0 ? [
              "Filter by lower MOQ (e.g., < 10 pieces)",
              "Find specific styles like moon chairs or heavy-duty options",
              "Request customized logo printing for these models"
            ] : undefined
          };
        });

        setMessages(mappedMessages);
        setActiveQueryText(sessionData.title);
        setActiveHistoryId(sessionData.id);
        setIsChatting(true);

        setHistory(prev =>
          prev.map((h) => (h.id === id ? { ...h, messages: mappedMessages } : h))
        );
      }
    } catch (err) {
      console.error("Failed to load session details:", err);
    }
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
            messages: []
          };
          setHistory(prev => [newHistoryItem, ...prev]);
        } else {
          currentSessionId = `session-${Date.now()}`;
          setActiveHistoryId(currentSessionId);
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
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAiMessage]);

      let buffer = "";
      let fullResponseText = "";
      let inlineProducts: InlineProduct[] = [];
      let currentEvent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;

          if (cleaned.startsWith("event:")) {
            currentEvent = cleaned.replace("event:", "").trim();
          } else if (cleaned.startsWith("data:")) {
            const dataStr = cleaned.replace("data:", "").trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (currentEvent === "step") {
                // Thought step updates tracked
              } else if (currentEvent === "text") {
                setIsGenerating(false);
                fullResponseText += parsed;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponseText } : m));
              } else if (currentEvent === "products") {
                inlineProducts = parsed;
                const finalMappedAi: Message = {
                  id: aiMessageId,
                  sender: "ai",
                  text: fullResponseText,
                  timestamp: new Date(),
                  inlineProductsHeader: "Matched Sourcing Products",
                  inlineProducts,
                  showViewProductsButton: true,
                  followUpText: "Based on these options, you can continue with:",
                  followUpSamples: [
                    "Filter by lower MOQ (e.g., < 10 pieces)",
                    "Find specific styles like moon chairs or heavy-duty options",
                    "Request customized logo printing for these models"
                  ]
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
              }
            } catch (e) {
              if (currentEvent === "text") {
                setIsGenerating(false);
                fullResponseText += dataStr;
                setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, text: fullResponseText } : m));
              }
            }
          }
        }
      }

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
