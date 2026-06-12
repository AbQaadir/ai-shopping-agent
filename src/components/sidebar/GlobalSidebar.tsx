"use client";

import React, { useState } from "react";
import {
  PanelLeftClose,
  PanelLeft,
  History,
  Headset,
  X,
  SquarePen,
  Globe,
  ChevronUp
} from "lucide-react";
import SidebarHistoryList from "./SidebarHistoryList";
import LanguagePopover from "../header/LanguagePopover";
import { useSourcing } from "@/context/SourcingContext";

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
  const [showLanguagePopover, setShowLanguagePopover] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const { activeUserId, handleSwitchUser, country, currency } = useSourcing();

  return (
    <aside
      className={`shrink-0 flex flex-col transition-all duration-300 ease-in-out bg-[#faf9f6] md:bg-slate-50/50
        fixed md:static inset-y-0 left-0 h-full z-40 md:z-20 md:border-r border-slate-100
        ${isMobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"}
        ${isCollapsed ? "md:w-16" : "md:w-64"}
      `}
    >
      {/* Top Section - Brand/Logo & Collapse Toggle */}
      <div className={`h-16 flex items-center justify-between px-4 ${
        isCollapsed ? "md:justify-center md:px-0" : ""
      }`}>
        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen?.(false)}
            className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer outline-none focus:outline-none"
            title="Close sidebar"
          >
            <X size={20} />
          </button>
        )}

        {/* Logo when expanded */}
        {!isCollapsed && (
          <div className="flex items-center select-none pl-1">
            <img
              src="/image.png"
              alt="Kapuruka Logo"
              className="h-8 w-auto object-contain rounded-md animate-fadeIn"
            />
          </div>
        )}

        {/* Desktop collapse button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden md:block p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer outline-none ${
            isCollapsed ? "" : "ml-auto"
          }`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Main Navigation List */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-none">
        {/* New Chat Option */}
        <button
          onClick={onReset}
          className={`w-full flex items-center rounded-xl text-sm transition-all duration-200 cursor-pointer relative outline-none group ${
            isCollapsed
              ? activeHistoryId === undefined
                ? "text-[#402970] font-bold"
                : "text-slate-500 hover:bg-[#402970]/5 hover:text-[#402970] font-semibold"
              : activeHistoryId === undefined
                ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50 text-[#402970] font-bold"
                : "text-slate-700 hover:bg-[#402970]/5 hover:text-[#402970] font-semibold"
          } ${isCollapsed ? "justify-center gap-0 px-3 py-3" : "gap-3 px-3 py-3"}`}
          title="New chat"
        >
          <SquarePen size={19} className={activeHistoryId === undefined ? "text-[#402970] shrink-0" : "text-slate-500 group-hover:text-[#402970] transition-colors shrink-0"} />
          <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
          }`}>
            New chat
          </span>
          {isCollapsed && activeHistoryId === undefined && (
            <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-[4px] h-8 bg-[#402970] rounded-l-full" />
          )}
        </button>

        {/* History Section Header */}
        <div className="space-y-1 pt-2">
          <div
            className={`w-full flex items-center px-3 py-3 text-slate-800 font-bold text-sm select-none ${
              isCollapsed ? "justify-center gap-0" : "justify-between gap-3"
            }`}
            title="History"
          >
            <div className={`flex items-center ${isCollapsed ? "gap-0" : "gap-3"}`}>
              <History size={19} className="text-[#402970]/80 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap font-extrabold text-[13px] text-slate-800 tracking-wide ${
                isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
              }`}>
                History
              </span>
            </div>
          </div>

          {/* History List */}
          {!isCollapsed && history.length > 0 && (
            <SidebarHistoryList
              history={history}
              activeHistoryId={activeHistoryId}
              onSelectHistory={onSelectHistory}
            />
          )}
        </div>
      </div>

      {/* Bottom Section - System/User Actions */}
      <div className="p-3 border-t border-slate-100/50 space-y-1 shrink-0">



        {/* Language & Currency */}
        <div className="relative">
          <button
            onClick={() => setShowLanguagePopover(!showLanguagePopover)}
            className={`w-full flex items-center rounded-xl text-slate-700 hover:bg-[#402970]/5 hover:text-[#402970] text-sm font-semibold transition-all duration-200 cursor-pointer outline-none group ${
              isCollapsed ? "justify-center gap-0 px-3 py-2.5" : "gap-3 px-3 py-2.5"
            }`}
            title={`Language & Currency: English-${currency}`}
          >
            <Globe size={19} className="text-slate-500 group-hover:text-[#402970] transition-colors shrink-0" />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap truncate text-left text-xs font-semibold ${
              isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
            }`}>
              English (<span className="font-extrabold uppercase">{currency}</span>)
            </span>
          </button>
          {showLanguagePopover && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowLanguagePopover(false)} />
              <LanguagePopover onClose={() => setShowLanguagePopover(false)} align="right" />
            </>
          )}
        </div>



        {/* User Switcher Card */}
        <div className="relative pt-1">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={`flex items-center justify-between border transition-all duration-300 cursor-pointer outline-none group ${
              isCollapsed
                ? "w-10 h-10 mx-auto rounded-full bg-[#402970]/5 border-[#402970]/10 hover:bg-[#402970]/10 p-0 justify-center"
                : "w-full p-2.5 rounded-xl border-slate-200/60 bg-white hover:bg-[#402970]/5 hover:border-[#402970]/20 hover:text-[#402970] text-left"
            }`}
            title={
              activeUserId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071"
                ? "Kamal Silva"
                : activeUserId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32"
                ? "Nimal Perera"
                : "Guest Profile"
            }
          >
            <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? "justify-center" : ""}`}>
              <div className={`rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                isCollapsed
                  ? "w-full h-full bg-transparent text-[#402970] font-extrabold"
                  : "w-8 h-8 bg-[#402970]/10 text-[#402970] group-hover:bg-[#402970]/20"
              }`}>
                {activeUserId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071"
                  ? "KS"
                  : activeUserId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32"
                  ? "NP"
                  : "GU"}
              </div>
              <div className={`flex flex-col text-left min-w-0 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
              }`}>
                <span className="text-xs font-bold text-slate-700 group-hover:text-[#402970] transition-colors truncate">
                  {activeUserId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071"
                    ? "Kamal Silva"
                    : activeUserId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32"
                    ? "Nimal Perera"
                    : "Guest Profile"}
                </span>
                <span className="text-[10px] text-slate-400 font-bold tracking-wide group-hover:text-[#402970]/70 transition-colors truncate">
                  {activeUserId === "guest" ? "Guest Mode" : "Active Profile"}
                </span>
              </div>
            </div>
            {!isCollapsed && (
              <ChevronUp size={14} className="text-slate-400 group-hover:text-[#402970] transition-colors shrink-0" />
            )}
          </button>

          {showUserDropdown && (
            <>
              <div
                className="fixed inset-0 z-45"
                onClick={() => setShowUserDropdown(false)}
              />
              <div
                className={`absolute w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-50 p-1 flex flex-col gap-0.5 animate-fadeIn ${
                  isCollapsed ? "bottom-0 left-full ml-3" : "bottom-full left-0 mb-2"
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1.5 tracking-wider select-none">
                  Select Active User
                </span>
                <button
                  onClick={() => {
                    handleSwitchUser("e17d0577-c93d-4c3e-9080-60b6bbfdf071");
                    setShowUserDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    activeUserId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071"
                      ? "bg-[#402970]/5 text-[#402970]"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  Kamal Silva (Vase order)
                  {activeUserId === "e17d0577-c93d-4c3e-9080-60b6bbfdf071" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#402970]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    handleSwitchUser("b91d2a14-e58f-4ad1-97b0-cce218fd7d32");
                    setShowUserDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    activeUserId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32"
                      ? "bg-[#402970]/5 text-[#402970]"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  Nimal Perera (Chair order)
                  {activeUserId === "b91d2a14-e58f-4ad1-97b0-cce218fd7d32" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#402970]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    handleSwitchUser("guest");
                    setShowUserDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    activeUserId === "guest"
                      ? "bg-[#402970]/5 text-[#402970]"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  Guest User (No orders)
                  {activeUserId === "guest" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#402970]" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
