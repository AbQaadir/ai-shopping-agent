"use client";

import React, { useState, useEffect } from "react";
import { 
  PanelLeftClose, 
  PanelLeft, 
  History, 
  Headset,
  ChevronDown,
  ChevronRight,
  Pin,
  Trash2,
  MoreHorizontal
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onReset: () => void;
  history: Array<{ id: string; query: string; date: string; isPinned?: boolean }>;
  onSelectHistory: (id: string) => void;
  activeHistoryId?: string;
  onPinSession: (id: string, pin: boolean) => void;
  onDeleteSession: (id: string) => void;
}

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  onReset,
  history,
  onSelectHistory,
  activeHistoryId,
  onPinSession,
  onDeleteSession
}: SidebarProps) {
  const [showHistoryList, setShowHistoryList] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

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
              {history.map((item) => (
                <div 
                  key={item.id}
                  className="relative group w-full flex items-center rounded-lg hover:bg-slate-100/60 transition-all duration-150"
                >
                  <button
                    onClick={() => onSelectHistory(item.id)}
                    className={`flex-1 text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer truncate ${
                      activeHistoryId === item.id 
                        ? "bg-[#402970]/5 text-[#402970] font-semibold border-l-2 border-[#402970]" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    title={item.query}
                  >
                    <span className="truncate pr-8">{item.query}</span>
                  </button>

                  {/* Actions Area */}
                  <div className="absolute right-2 flex items-center gap-1.5 z-10">
                    {item.isPinned && (
                      <Pin size={11} className="text-[#402970] rotate-45 shrink-0" />
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === item.id ? null : item.id);
                      }}
                      className={`p-1 hover:bg-slate-200/80 rounded text-slate-400 hover:text-slate-600 cursor-pointer transition-all ${
                        activeMenuId === item.id ? "block" : "hidden group-hover:block"
                      }`}
                      title="More options"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>

                  {/* Context Menu Dropdown */}
                  {activeMenuId === item.id && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-full ml-1 top-0 w-36 bg-white border border-slate-100 rounded-xl shadow-xl p-1 z-50 animate-fadeIn text-left text-xs"
                    >
                      <button
                        onClick={() => {
                          onPinSession(item.id, !item.isPinned);
                          setActiveMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-slate-50 rounded-lg text-slate-700 font-semibold cursor-pointer transition-all duration-150"
                      >
                        <Pin size={12} className={`rotate-45 ${item.isPinned ? "text-[#402970]" : "text-slate-400"}`} />
                        {item.isPinned ? "Unpin chat" : "Pin chat"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this session?")) {
                            onDeleteSession(item.id);
                          }
                          setActiveMenuId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-red-50 rounded-lg text-red-600 hover:text-red-700 font-semibold cursor-pointer transition-all duration-150"
                      >
                        <Trash2 size={12} className="text-red-500" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
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
