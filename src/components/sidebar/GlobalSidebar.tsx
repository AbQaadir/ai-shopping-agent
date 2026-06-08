"use client";

import React, { useState } from "react";
import { 
  PanelLeftClose, 
  PanelLeft, 
  History, 
  Headset,
  ChevronDown,
  ChevronRight,
  X
} from "lucide-react";
import SidebarHistoryList from "./SidebarHistoryList";

interface GlobalSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  onReset: () => void;
  history: Array<{ id: string; query: string; date: string }>;
  onSelectHistory: (id: string) => void;
  activeHistoryId?: string;
}

export default function GlobalSidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen = false,
  setIsMobileOpen,
  onReset,
  history,
  onSelectHistory,
  activeHistoryId
}: GlobalSidebarProps) {
  const [showHistoryList, setShowHistoryList] = useState(true);

  return (
    <aside 
      className={`shrink-0 flex flex-col transition-all duration-300 ease-in-out bg-[#faf9f6] md:bg-slate-50/50
        fixed md:static inset-y-0 left-0 h-full z-40 md:z-20 md:border-r border-slate-100
        ${isMobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"}
        ${isCollapsed ? "md:w-16" : "md:w-64"}
      `}
    >
      {/* Top Section - Desktop Toggle & Mobile Close */}
      <div className={`h-16 flex items-center justify-between px-4 ${
        isCollapsed ? "md:justify-center md:px-0" : "md:justify-end"
      }`}>
        {/* Mobile close button */}
        <button
          onClick={() => setIsMobileOpen?.(false)}
          className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Close sidebar"
        >
          <X size={20} />
        </button>

        {/* Desktop collapse button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:block p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 px-3 py-2 space-y-1">
        {/* Home Option */}
        <button 
          onClick={onReset}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer relative ${
            isCollapsed
              ? activeHistoryId === undefined 
                ? "text-[#402970] font-bold" 
                : "text-slate-500 hover:bg-slate-100/60 font-semibold"
              : activeHistoryId === undefined 
                ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50 text-[#402970] font-bold" 
                : "text-slate-700 hover:bg-slate-100/60 font-semibold"
          } ${isCollapsed ? "justify-center" : ""}`}
          title="Home"
        >
          {/* Custom search-sparkle icon representing Home search reset */}
          <svg className={`w-5 h-5 shrink-0 ${activeHistoryId === undefined ? "text-[#402970]" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="14" r="5" />
            <path d="m14 18 4 4" />
            <path d="M18 3c-.1 1.5-1.5 2.9-3 3 1.5 .1 2.9 1.5 3 3 .1-1.5 1.5-2.9 3-3-1.5-.1-2.9-1.5-3-3z" />
          </svg>
          {!isCollapsed && <span>Home</span>}
          {isCollapsed && activeHistoryId === undefined && (
            <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-[4px] h-8 bg-[#402970] rounded-l-full" />
          )}
        </button>

        {/* History Option */}
        <div className="space-y-1">
          <button 
            onClick={() => {
              if (isCollapsed) {
                setIsCollapsed(false);
              }
              setShowHistoryList(!showHistoryList);
            }}
            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer relative ${
              isCollapsed
                ? activeHistoryId !== undefined 
                  ? "text-[#402970] font-bold" 
                  : "text-slate-500 hover:bg-slate-100/60 font-semibold"
                : activeHistoryId !== undefined 
                  ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50 text-[#402970] font-bold" 
                  : "text-slate-700 hover:bg-slate-100/60 font-semibold"
            } ${isCollapsed ? "justify-center" : ""}`}
            title="History"
          >
            <div className="flex items-center gap-3">
              <History size={19} className={activeHistoryId !== undefined ? "text-[#402970] shrink-0" : "text-slate-500 shrink-0"} />
              {!isCollapsed && <span>History</span>}
            </div>
            {!isCollapsed && history.length > 0 && (
              showHistoryList ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
            )}
            {isCollapsed && activeHistoryId !== undefined && (
              <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-[4px] h-8 bg-[#402970] rounded-l-full" />
            )}
          </button>

          {/* Indented History List (Only if expanded & toggled open) */}
          {!isCollapsed && showHistoryList && history.length > 0 && (
            <SidebarHistoryList
              history={history}
              activeHistoryId={activeHistoryId}
              onSelectHistory={onSelectHistory}
            />
          )}
        </div>
      </div>

      {/* Bottom Section - Contact Us Only */}
      <div className="p-3 border-t border-slate-100/50">
        <button 
          onClick={() => alert("Contact support at support@kapuruka.com")}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-700 hover:bg-slate-100/60 hover:text-slate-700 text-sm font-semibold transition-all duration-200 cursor-pointer ${
            isCollapsed ? "justify-center" : ""
          }`}
          title="Contact us"
        >
          <Headset size={19} className="text-slate-500 shrink-0" />
          {!isCollapsed && <span>Contact us</span>}
        </button>
      </div>
    </aside>
  );
}
