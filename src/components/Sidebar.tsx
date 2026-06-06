"use client";

import React, { useState } from "react";
import { 
  PanelLeftClose, 
  PanelLeft, 
  History, 
  Headset,
  ChevronDown,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onReset: () => void;
  history: Array<{ id: string; query: string; date: string }>;
  onSelectHistory: (id: string) => void;
  activeHistoryId?: string;
}

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  onReset,
  history,
  onSelectHistory,
  activeHistoryId
}: SidebarProps) {
  const [showHistoryList, setShowHistoryList] = useState(true);

  return (
    <aside 
      className={`shrink-0 h-full border-r border-slate-100 bg-slate-50/50 flex flex-col transition-all duration-300 ease-in-out z-20 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Section - Toggle Button Only */}
      <div className={`h-16 flex items-center ${isCollapsed ? "justify-center px-0" : "justify-end px-4"}`}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
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
            <div className="pl-4 pr-1 py-1 space-y-1 max-h-[400px] overflow-y-auto scrollbar-none animate-fadeIn border-l border-slate-100/80 ml-5">
              {history.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer ${
                    activeHistoryId === item.id 
                      ? "bg-[#402970]/5 text-[#402970] font-semibold border-l-2 border-[#402970]" 
                      : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800"
                  }`}
                  title={item.query}
                >
                  <span className="truncate">{item.query}</span>
                  {/* Status red dot matching Screenshot */}
                  {idx % 2 === 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                  )}
                </button>
              ))}
            </div>
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
