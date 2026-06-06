"use client";

import React, { useState, useRef } from "react";
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
  
  // Ref to hold the streaming interval
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Active message thread
  const [messages, setMessages] = useState<Message[]>([]);

  // Mock Products for timeline search (Image 2 cards)
  const inlineProductsMock: InlineProduct[] = [
    {
      id: "ip1",
      title: "Folding Moon Chair Portable Breathable Mesh Backrest Seat for Outdoor Camping",
      price: "$3.40 - $3.60",
      moq: "12 bags",
      supplier: "Beijing Liyi Technology Co., Ltd.",
      location: "CN",
      years: 1,
      verified: false,
      image: "🏕️",
      bgColor: "bg-amber-100"
    },
    {
      id: "ip2",
      title: "360° Swivel Folding Camping Chair 3-Legged Portable Stool for Hiking Fishing",
      price: "$5.50",
      moq: "20 pieces",
      supplier: "Henan Haiku Outdoor Products Co., Ltd.",
      location: "CN",
      years: 1,
      verified: false,
      image: "🔄",
      bgColor: "bg-emerald-100"
    },
    {
      id: "ip3",
      title: "Lightweight Outdoor Beach Oxford Chair for Picnic & Travel",
      price: "$2.29 - $2.86",
      moq: "6 pieces",
      supplier: "YIWU FULLYUAN DAILY SUPPLIES CO.",
      location: "CN",
      years: 1,
      verified: false,
      image: "🏖️",
      bgColor: "bg-sky-100"
    },
    {
      id: "ip4",
      title: "Outdoor Folding High-Back Camping Chair Portable Armchair with Cup Holder",
      price: "$3.20",
      moq: "50 pieces",
      supplier: "Langfang Jinzhao Stationery Co., Ltd.",
      location: "CN",
      years: 5,
      verified: false,
      image: "🥤",
      bgColor: "bg-blue-100"
    },
    {
      id: "ip5",
      title: "Wholesale Lightweight Portable Outdoor Hiking Picnic Chair",
      price: "$3.20 - $4.00",
      moq: "50 pieces",
      supplier: "CIXI RUNFENG COMMODITY CO.",
      location: "CN",
      years: 10,
      verified: true,
      image: "🎒",
      bgColor: "bg-indigo-100"
    },
    {
      id: "ip6",
      title: "Outdoor Folding Arc Moon Chair Portable Lightweight Oxford Cloth Bench",
      price: "$1.81 - $2.94",
      moq: "1 piece",
      supplier: "Wuhan Pioneersky Cultural Co., Ltd.",
      location: "CN",
      years: 1,
      verified: false,
      image: "🌙",
      bgColor: "bg-violet-100"
    },
    {
      id: "ip7",
      title: "Portable Folding Tripod Chair Ultralight Stool with Carry Bag",
      price: "$1.50 - $2.10",
      moq: "100 pieces",
      supplier: "Ningbo Outdo Hiking Gear Co., Ltd.",
      location: "CN",
      years: 2,
      verified: true,
      image: "🏕️",
      bgColor: "bg-green-100"
    },
    {
      id: "ip8",
      title: "Heavy Duty Camping Quad Chair with Cool Bag & Side Table",
      price: "$8.50 - $9.90",
      moq: "10 pieces",
      supplier: "Hangzhou Joy Outdoor Co., Ltd.",
      location: "CN",
      years: 4,
      verified: false,
      image: "🧊",
      bgColor: "bg-teal-100"
    },
    {
      id: "ip9",
      title: "Reclining Outdoor Camp Chair with Adjustable Footrest & Headrest",
      price: "$12.40 - $14.50",
      moq: "5 pieces",
      supplier: "Shaoxing Leisure Products Factory",
      location: "CN",
      years: 3,
      verified: true,
      image: "🛌",
      bgColor: "bg-orange-100"
    },
    {
      id: "ip10",
      title: "Compact Backpacking Chair High Back Foldable Camping Stool",
      price: "$6.80 - $7.50",
      moq: "30 pieces",
      supplier: "Tianjin Sports Gear Co., Ltd.",
      location: "CN",
      years: 1,
      verified: false,
      image: "🎒",
      bgColor: "bg-slate-200"
    },
    {
      id: "ip11",
      title: "Kids Miniature Folding Camp Chair with Safety Lock Mechanisms",
      price: "$2.99 - $3.50",
      moq: "50 pieces",
      supplier: "Yiwu Children Goods Import & Export",
      location: "CN",
      years: 8,
      verified: true,
      image: "🧒",
      bgColor: "bg-pink-100"
    },
    {
      id: "ip12",
      title: "Directors Folding Chair with Side Table & Accessory Pockets",
      price: "$11.20 - $13.80",
      moq: "10 pieces",
      supplier: "Foshan Goldway Furniture Co., Ltd.",
      location: "CN",
      years: 6,
      verified: false,
      image: "🎬",
      bgColor: "bg-rose-100"
    }
  ];

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
    // Clear any active streaming intervals
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    setIsChatting(false);
    setMessages([]);
    setActiveHistoryId(undefined);
    setActiveQueryText("");
    setIsGenerating(false);
  };

  // Select history item
  const handleSelectHistory = (id: string) => {
    const item = history.find((h) => h.id === id);
    if (item) {
      setMessages(item.messages);
      setActiveQueryText(item.query);
      setActiveHistoryId(item.id);
      setIsChatting(true);
    }
  };

  // Stop Generation Handler
  const handleStopGeneration = () => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    setIsGenerating(false);
  };

  // Send query action with custom SSE streaming simulation
  const handleSendMessage = (text: string, files: File[]) => {
    // Clear existing intervals first
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }

    const timestamp = new Date();
    const userMessageId = `msg-${Date.now()}`;
    
    // Convert File objects to serializable attachment format
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

    // SOURCING FLOW STAGE 1: Thinking Phase (1.8 seconds)
    setTimeout(() => {
      // Mark user message as sent
      setMessages(prev => prev.map(m => m.id === userMessageId ? { ...m, status: "sent" } : m));

      // Define target content based on user query keywords
      const fullResponseText = 
        "I have found **200 foldable camping chairs** priced under **$15**, with some options as low as **$3.40/piece**.\n\nThe results include a variety of styles, such as *lightweight moon chairs*, *360° swivel stools*, and *heavy-duty portable chairs*. MOQs for these items typically range from **10 to 50 pieces**, making them suitable for both small-scale retail and bulk wholesale. Detailed specifications, pricing tiers, and supplier information are available in the file below.";

      const aiMessageId = `msg-ai-${Date.now()}`;
      
      // Initialize an empty AI message inside timeline
      const newAiMessage: Message = {
        id: aiMessageId,
        sender: "ai",
        text: "",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, newAiMessage]);
      setIsGenerating(false); // Hide the "Working on your task" loader as text starts streaming

      let currentLength = 0;
      const step = 8; // characters typed per interval step

      // SOURCING FLOW STAGE 2: progressive text SSE stream typing
      streamIntervalRef.current = setInterval(() => {
        currentLength += step;
        
        if (currentLength >= fullResponseText.length) {
          // Streaming text completed - clear interval
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current);
            streamIntervalRef.current = null;
          }

          // SOURCING FLOW STAGE 3: Append the custom components (Showcase cards, View products buttons, follow-ups)
          setMessages(prev => prev.map(m => {
            if (m.id === aiMessageId) {
              return {
                ...m,
                text: fullResponseText,
                inlineProductsHeader: "Foldable Camping Chair Price < 15 Usd",
                inlineProducts: inlineProductsMock,
                showViewProductsButton: true,
                followUpText: "Based on these camping chairs, you can continue with:",
                followUpSamples: [
                  "Filter by lower MOQ (e.g., < 10 pieces)",
                  "Find specific styles like moon chairs or heavy-duty options",
                  "Request customized logo printing for these models"
                ]
              };
            }
            return m;
          }));

          // Save completed session to history
          const updatedHistoryItem: HistoryItem = {
            id: `h-${Date.now()}`,
            query: text || "Sourced foldable camping chairs",
            date: new Date().toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
            queryType: "product",
            messages: [...updatedMessages, {
              id: aiMessageId,
              sender: "ai",
              text: fullResponseText,
              timestamp: new Date(),
              inlineProductsHeader: "Foldable Camping Chair Price < 15 Usd",
              inlineProducts: inlineProductsMock,
              showViewProductsButton: true,
              followUpText: "Based on these camping chairs, you can continue with:",
              followUpSamples: [
                "Filter by lower MOQ (e.g., < 10 pieces)",
                "Find specific styles like moon chairs or heavy-duty options",
                "Request customized logo printing for these models"
              ]
            }]
          };

          setHistory(prev => [updatedHistoryItem, ...prev]);
          setActiveHistoryId(updatedHistoryItem.id);

        } else {
          // Keep typing
          setMessages(prev => prev.map(m => {
            if (m.id === aiMessageId) {
              return {
                ...m,
                text: fullResponseText.substring(0, currentLength)
              };
            }
            return m;
          }));
        }
      }, 30);

    }, 1800);
  };

  // Suggestion pill click transitions to chat with the initial prompt
  const handleSuggestionClick = () => {
    setIsChatting(true);
    setActiveQueryText(""); // clear active query text until they send a query
    
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
    <div className="flex-1 flex overflow-hidden h-screen bg-white">
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
