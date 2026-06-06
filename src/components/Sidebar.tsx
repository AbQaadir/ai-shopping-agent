"use client";

import React from "react";
import { 
  PanelLeftClose, 
  PanelLeft, 
  RotateCcw, 
  History, 
  HelpCircle, 
  Compass,
  Plus
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
  return (
    <aside 
      className={`border-r border-slate-100 bg-white flex flex-col transition-all duration-300 ease-in-out z-20 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Section - Brand Toggle */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-50">
        {!isCollapsed && (
          <span className="font-semibold text-slate-700 text-sm tracking-wide flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Sourcing Space
          </span>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors ml-auto"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Navigation Actions */}
      <div className="p-3 flex flex-col gap-1.5 border-b border-slate-50">
        <button 
          onClick={onReset}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
            activeHistoryId === undefined 
              ? "bg-[#ff6600]/5 text-[#ff6600] font-medium border border-[#ff6600]/10" 
              : "text-slate-600 hover:bg-slate-50"
          }`}
          title="New Sourcing Task"
        >
          <Plus size={18} className={activeHistoryId === undefined ? "text-[#ff6600]" : "text-slate-500"} />
          {!isCollapsed && <span>New Sourcing</span>}
        </button>

        <button 
          onClick={onReset}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-all duration-200"
          title="Clear / Reset Current Session"
        >
          <RotateCcw size={18} className="text-slate-500" />
          {!isCollapsed && <span>Reset Session</span>}
        </button>
      </div>

      {/* Sourcing History */}
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        {!isCollapsed && (
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center gap-2">
            <History size={12} />
            Sourcing History
          </span>
        )}
        
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400" title="History List">
              <History size={18} />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {history.length === 0 ? (
              <div className="text-xs text-slate-400 italic px-3 py-4 text-center">
                No recent requests
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectHistory(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-all duration-200 flex flex-col gap-0.5 ${
                    activeHistoryId === item.id 
                      ? "bg-slate-100 text-slate-900 font-medium" 
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  title={item.query}
                >
                  <span className="truncate">{item.query}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{item.date}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer / Account Profiles */}
      <div className="p-3 border-t border-slate-50 flex flex-col gap-1">
        <button 
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-all duration-200"
          title="Sourcing Resources"
        >
          <Compass size={18} className="text-slate-500" />
          {!isCollapsed && <span>Sourcing Hub</span>}
        </button>
        <button 
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 text-sm transition-all duration-200"
          title="Help & Support"
        >
          <HelpCircle size={18} className="text-slate-500" />
          {!isCollapsed && <span>Help & Support</span>}
        </button>

        <div className="mt-2 border-t border-slate-50 pt-2 flex items-center gap-3 px-3 py-1.5">
          <div className="w-8 h-8 rounded-full bg-[#ff6600]/10 text-[#ff6600] flex items-center justify-center font-bold text-sm shrink-0">
            QA
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate min-w-0">
              <span className="text-sm font-medium text-slate-700 truncate">qaadi@example.com</span>
              <span className="text-[10px] text-emerald-600 font-medium">LK Sourcing Tier</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
