"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LandingView from "@/components/LandingView";
import ChatView from "@/components/ChatView";
import { MessageSquare } from "lucide-react";

interface FileAttachment {
  name: string;
  size: number;
  type: string;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  status?: "sending" | "sent" | "analyzing";
}

interface HistoryItem {
  id: string;
  query: string;
  date: string;
  queryType: "design" | "manufacturer" | "bestseller" | "product" | "general";
  messages: Message[];
}

export default function Home() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | undefined>(undefined);
  const [currentQueryType, setCurrentQueryType] = useState<"design" | "manufacturer" | "bestseller" | "product" | "general">("general");
  const [activeQueryText, setActiveQueryText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Active message thread
  const [messages, setMessages] = useState<Message[]>([]);

  // Pre-populate some history items for demonstration
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: "h1",
      query: "Find verified ergonomic mesh chair manufacturers",
      date: "Jun 06, 2026",
      queryType: "manufacturer",
      messages: [
        {
          id: "m1",
          sender: "user",
          text: "Find verified ergonomic mesh chair manufacturers",
          timestamp: new Date("2026-06-06T14:20:00Z"),
          status: "sent"
        },
        {
          id: "m2",
          sender: "ai",
          text: "I've parsed the directory of verified manufacturers. I have found 3 factories specializing in ergonomic mesh seating. Foshan Comfort Furniture and Anji Wanxiang both carry ISO 9001 and BIFMA certifications. I've compiled their capacity statistics and product catalogs on the right side panel. You can inspect them or trigger a direct RFQ broadcase.",
          timestamp: new Date("2026-06-06T14:21:00Z")
        }
      ]
    },
    {
      id: "h2",
      query: "3D Design Concept: Mesh chair with lumbar support",
      date: "Jun 05, 2026",
      queryType: "design",
      messages: [
        {
          id: "m3",
          sender: "user",
          text: "3D Design Concept: Mesh chair with lumbar support",
          timestamp: new Date("2026-06-05T16:20:00Z"),
          status: "sent"
        },
        {
          id: "m4",
          sender: "ai",
          text: "Here is your generated design concept blueprint based on the custom lumbar support specification sheet. I've aligned the technical drawings and mapped them to specialized tooling workshops in Guangdong. Please click 'Get File' on the right panel to download the complete blueprint package.",
          timestamp: new Date("2026-06-05T16:21:00Z")
        }
      ]
    }
  ]);

  // Handle New Session / Reset
  const handleReset = () => {
    setIsChatting(false);
    setMessages([]);
    setActiveHistoryId(undefined);
    setCurrentQueryType("general");
    setActiveQueryText("");
  };

  // Select history item
  const handleSelectHistory = (id: string) => {
    const item = history.find((h) => h.id === id);
    if (item) {
      setMessages(item.messages);
      setCurrentQueryType(item.queryType);
      setActiveQueryText(item.query);
      setActiveHistoryId(item.id);
      setIsChatting(true);
    }
  };

  // Determine query classification
  const classifyQuery = (text: string): "design" | "manufacturer" | "bestseller" | "product" | "general" => {
    const t = text.toLowerCase();
    if (t.includes("design") || t.includes("blueprint") || t.includes("sketch") || t.includes("draw")) return "design";
    if (t.includes("manufacturer") || t.includes("supplier") || t.includes("factory") || t.includes("verified")) return "manufacturer";
    if (t.includes("bestseller") || t.includes("market") || t.includes("trend") || t.includes("analytics")) return "bestseller";
    if (t.includes("product") || t.includes("mesh chair") || t.includes("price") || t.includes("chair")) return "product";
    return "general";
  };

  // Send query action
  const handleSendMessage = (text: string, files: File[]) => {
    const timestamp = new Date();
    const messageId = `msg-${Date.now()}`;
    
    // Convert File objects to serializable attachment format
    const attachments = files.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type
    }));

    const newUserMessage: Message = {
      id: messageId,
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

    const detectedType = classifyQuery(text || (files.length > 0 ? files[0].name : ""));
    setCurrentQueryType(detectedType);
    if (!activeQueryText) {
      setActiveQueryText(text || "Uploaded design request");
    }

    // AI Sourcing logic simulator
    setTimeout(() => {
      // Mark user message as sent
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: "sent" } : m));

      let aiResponseText = "";
      switch (detectedType) {
        case "design":
          aiResponseText = "I have successfully analyzed the uploaded files and custom specs. Based on your design blueprint, I have drafted 3D drawings and aligned them with injection-molding workshops in Guangdong on the right. You can download the complete mechanical spec document to verify the measurements.";
          break;
        case "manufacturer":
          aiResponseText = "Here are the top-rated verified suppliers matching your requirements. I have highlighted factories carrying ISO 9001 and CE certifications. You can review their monthly production metrics, download audits, or initiate a direct inquiry via the RFQ tab.";
          break;
        case "bestseller":
          aiResponseText = "I've aggregated pricing indexes and distribution ratios. Average sourcing costs have decreased by 4.2% this quarter. The right side panel features geographical maps and production heatmaps for your analysis. Would you like to target a specific factory region?";
          break;
        case "product":
          aiResponseText = "I found 3 matching office chairs. Unit price lists, minimum order quantities (MOQ), and shipping ranges are shown on the right. Simply click 'Source Product' or broadcast an RFQ to request direct custom freight pricing.";
          break;
        default:
          aiResponseText = `I've initialized a custom sourcing flow for your request: "${text}". The matches, suppliers, and analytics tables are populated on the right side panel. Let me know if you need to enforce specific standards like BIFMA, custom logos, or target price points!`;
      }

      const newAiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "ai",
        text: aiResponseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, newAiMessage]);
      setIsGenerating(false);

      // Save to sidebar history list if new session
      if (!activeHistoryId) {
        const newHistoryId = `h-${Date.now()}`;
        const newHistoryItem: HistoryItem = {
          id: newHistoryId,
          query: text || "Uploaded custom sourcing query",
          date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
          queryType: detectedType,
          messages: [...updatedMessages, newAiMessage]
        };
        setHistory(prev => [newHistoryItem, ...prev]);
        setActiveHistoryId(newHistoryId);
      } else {
        // Update existing history item
        setHistory(prev => prev.map(h => h.id === activeHistoryId ? { ...h, messages: [...updatedMessages, newAiMessage] } : h));
      }

    }, 2000);
  };

  // Suggestion pill click triggers immediate send simulation
  const handleSuggestionClick = (suggestionText: string) => {
    handleSendMessage(suggestionText, []);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-screen bg-[#faf9f6]">
      {/* 1. Expandable Left Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onReset={handleReset}
        history={history}
        onSelectHistory={handleSelectHistory}
        activeHistoryId={activeHistoryId}
      />

      {/* 2. Main Area (Header + Sourcing Workspace) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Floating Header */}
        <Header 
          onNewSourcing={handleReset} 
          isCompact={isChatting} 
        />

        {/* Dynamic Inner Panel Layout */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {isChatting ? (
            <ChatView
              messages={messages}
              isGenerating={isGenerating}
              onSend={handleSendMessage}
              onBackToLanding={handleReset}
              queryType={currentQueryType}
              activeQueryText={activeQueryText}
            />
          ) : (
            <LandingView
              onSend={handleSendMessage}
              onSuggestionClick={handleSuggestionClick}
            />
          )}
        </div>

        {/* Floating Message Drawer Bubble (bottom right on landing) */}
        {!isChatting && (
          <button className="fixed bottom-6 right-6 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-full px-5 py-3 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 z-30 font-semibold text-xs active:scale-95">
            <MessageSquare size={16} className="text-[#ff6600]" />
            Messages
          </button>
        )}
      </div>
    </div>
  );
}
