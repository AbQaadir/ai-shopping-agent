"use client";

import React, { useEffect, useRef } from "react";
import GlobalSidebar from "@/components/sidebar/GlobalSidebar";
import LandingWorkspace from "@/components/landing/LandingWorkspace";
import ChatWorkspace from "@/components/chat/ChatWorkspace";
import CartModal from "@/components/chat/CartModal";
import { Play } from "lucide-react";
import { useSourcingStore, useSourcingActions } from "@/store/useSourcingStore";
import { useAuth } from "@/context/AuthContext";

interface SourcingDashboardProps {
  initialSessionId?: string;
}

export default function SourcingDashboard({ initialSessionId }: SourcingDashboardProps) {
  const isSidebarCollapsed = useSourcingStore(state => state.isSidebarCollapsed);
  const setIsSidebarCollapsed = useSourcingStore(state => state.setIsSidebarCollapsed);
  const isMobileSidebarOpen = useSourcingStore(state => state.isMobileSidebarOpen);
  const setIsMobileSidebarOpen = useSourcingStore(state => state.setIsMobileSidebarOpen);
  const isChatting = useSourcingStore(state => state.isChatting);
  const setIsChatting = useSourcingStore(state => state.setIsChatting);
  const activeHistoryId = useSourcingStore(state => state.activeHistoryId);
  const setActiveHistoryId = useSourcingStore(state => state.setActiveHistoryId);
  const activeQueryText = useSourcingStore(state => state.activeQueryText);
  const isGenerating = useSourcingStore(state => state.isGenerating);
  const messages = useSourcingStore(state => state.messages);
  const history = useSourcingStore(state => state.history);
  const isViewingCart = useSourcingStore(state => state.isViewingCart);
  const setIsViewingCart = useSourcingStore(state => state.setIsViewingCart);

  const {
    fetchHistory,
    fetchSessionAndHydrate,
    handleResetLocal,
    handleReset,
    handleSelectHistory,
    handleStopGeneration,
    handleSendMessage,
    handleBuyProduct,
    handleSuggestionClick,
  } = useSourcingActions();
  const { isSyncing } = useAuth();



  const lastSessionIdRef = useRef<string | undefined>("__initial__");

  // Initial load: Fetch the history list from PostgreSQL
  useEffect(() => {
    if (isSyncing) return;
    fetchHistory();
  }, [fetchHistory, isSyncing]);

  // Sync state if session route changes:
  useEffect(() => {
    if (isSyncing) return;
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
  }, [initialSessionId, activeHistoryId, messages.length, isChatting, fetchSessionAndHydrate, handleResetLocal, setIsChatting, setActiveHistoryId, isSyncing]);

  return (
    <>
    <div className="h-screen w-screen flex overflow-hidden bg-white">
      {/* 2. Content Area (Sidebar + Sourcing Workspace) */}
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
        <div 
          className={`md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 transition-all duration-300 ${
            isMobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setIsMobileSidebarOpen(false)}
        />

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

        {/* Floating Watch Demo Bubble (bottom right on landing) */}
        {!isChatting && !isViewingCart && (
          <button 
            onClick={() => window.open("https://youtu.be/_CUZO_lkVxU", "_blank")}
            className="fixed bottom-6 right-6 bg-gradient-to-r from-[#5a369e] to-[#402970] text-white rounded-full px-5 py-3 shadow-[0_0_20px_rgba(64,41,112,0.4)] hover:shadow-[0_0_30px_rgba(64,41,112,0.6)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-2 z-20 font-bold text-[13px] active:scale-95 border border-purple-400/20"
          >
            <Play size={16} className="text-white fill-white" />
            Watch Demo
          </button>
        )}
      </div>
    </div>

    {/* Unified Global Cart Modal */}
    <CartModal 
      isOpen={isViewingCart}
      isGlobal={true}
      onClose={() => setIsViewingCart(false)}
    />
    </>
  );
}
