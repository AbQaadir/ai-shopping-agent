"use client";

import React, { useEffect, useRef } from "react";
import GlobalSidebar from "@/components/sidebar/GlobalSidebar";
import GlobalHeader from "@/components/header/GlobalHeader";
import LandingWorkspace from "@/components/landing/LandingWorkspace";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import { MessageSquare } from "lucide-react";
import { useSourcing } from "@/context/SourcingContext";

interface SourcingDashboardProps {
  initialSessionId?: string;
}

export default function SourcingDashboard({ initialSessionId }: SourcingDashboardProps) {
  const {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isChatting,
    setIsChatting,
    activeHistoryId,
    setActiveHistoryId,
    activeQueryText,
    isGenerating,
    messages,
    history,

    fetchHistory,
    fetchSessionAndHydrate,
    handleResetLocal,
    handleReset,
    handleSelectHistory,
    handleStopGeneration,
    handleSendMessage,
    handleBuyProduct,
    handleSuggestionClick,
  } = useSourcing();

  const lastSessionIdRef = useRef<string | undefined>("__initial__");

  // Initial load: Fetch the history list from PostgreSQL
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Sync state if session route changes:
  useEffect(() => {
    // Prevent double invocation
    if (lastSessionIdRef.current === initialSessionId) {
      return;
    }
    lastSessionIdRef.current = initialSessionId;

    if (initialSessionId) {
      setIsChatting(true);
      // Only fetch if context history active ID doesn't match or messages are empty
      if (activeHistoryId !== initialSessionId || messages.length === 0) {
        setActiveHistoryId(initialSessionId);
        // Defer fetch to ensure React hooks are fully initialized
        Promise.resolve().then(() => {
          fetchSessionAndHydrate(initialSessionId);
        });
      }
    } else {
      // If we landed on "/", reset workspace to welcome state
      if (activeHistoryId !== undefined || isChatting) {
        Promise.resolve().then(() => {
          handleResetLocal();
        });
      }
    }
  }, [initialSessionId, activeHistoryId, messages.length, isChatting, fetchSessionAndHydrate, handleResetLocal, setIsChatting, setActiveHistoryId]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      {/* 1. Header (Top Area - spans full width) */}
      <GlobalHeader 
        onNewSourcing={handleReset} 
        isCompact={isChatting} 
        onMenuToggle={() => setIsMobileSidebarOpen(prev => !prev)}
      />

      {/* 2. Content Area (Sidebar + Sourcing Workspace below the header) */}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <GlobalSidebar
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
              <ChatWorkspace
                activeHistoryId={activeHistoryId}
                messages={messages}
                isGenerating={isGenerating}
                onSend={handleSendMessage}
                onBackToLanding={handleReset}
                activeQueryText={activeQueryText}
                onStopGeneration={handleStopGeneration}
                onBuyProduct={handleBuyProduct}
              />
            ) : (
              <LandingWorkspace
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
