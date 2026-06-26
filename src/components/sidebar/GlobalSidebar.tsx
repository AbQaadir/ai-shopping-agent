"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  PanelLeftClose,
  PanelLeft,
  X,
  SquarePen,
  History,
  Globe,
  Package,
} from "lucide-react";
import SidebarHistoryList from "./SidebarHistoryList";
import LanguagePopover from "../header/LanguagePopover";
import { useSourcing } from "@/context/SourcingContext";
import { useAuth } from "@/context/AuthContext";
import { HistoryItem } from "@/types/sourcing";
import SettingsModal from "../profile/SettingsModal";
import OrdersPanel from "./OrdersPanel";

interface GlobalSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (v: boolean) => void;
  onReset: () => void;
  history: HistoryItem[];
  onSelectHistory: (id: string) => void;
  activeHistoryId?: string;
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    <path fill="none" d="M1 1h22v22H1z" />
  </svg>
);

export default function GlobalSidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  onReset,
  history,
  onSelectHistory,
  activeHistoryId,
}: GlobalSidebarProps) {
  const [showLanguagePopover, setShowLanguagePopover] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  const languageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (languageContainerRef.current && !languageContainerRef.current.contains(event.target as Node)) {
        setShowLanguagePopover(false);
      }
    }
    if (showLanguagePopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLanguagePopover]);

  const { currency, handleDeleteHistory } = useSourcing();
  const { user, openAuthModal } = useAuth();

  const isEffectiveCollapsed = isCollapsed && !isMobileOpen;

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = user
    ? (user.user_metadata?.full_name || user.email || "U").substring(0, 2).toUpperCase()
    : null;

  const handleUserAreaClick = () => {
    if (!user) {
      openAuthModal("login");
    } else {
      if (isCollapsed) setIsCollapsed(false);
      setIsSettingsOpen(true);
    }
  };

  return (
    <>
      <aside
        className={`shrink-0 flex flex-col transition-all duration-300 ease-in-out bg-[#faf9f6] md:bg-slate-50/50
          fixed md:static inset-y-0 left-0 h-full z-40 md:z-20 md:border-r border-slate-100
          ${isMobileOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0"}
          ${isCollapsed ? "md:w-16" : "md:w-64"}
        `}
      >
        {/* Top Section - Brand/Logo & Collapse Toggle */}
        <div className={`h-14 flex items-center justify-between px-4 ${
          isCollapsed ? "md:justify-center md:px-0" : ""
        }`}>
          {/* Mobile close button */}
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen?.(false)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-[#402970] hover:text-[#402970] transition-colors cursor-pointer outline-none focus:outline-none"
              title="Close sidebar"
            >
              <X size={20} />
            </button>
          )}

          {/* Logo when expanded */}
          {!isEffectiveCollapsed && (
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
            className={`hidden md:block p-2 hover:bg-slate-100 rounded-lg text-[#402970] hover:text-[#402970] transition-colors cursor-pointer outline-none ${
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
              isEffectiveCollapsed
                ? activeHistoryId === undefined
                  ? "text-[#402970] font-bold"
                  : "text-slate-500 hover:bg-[#402970]/5 hover:text-[#402970] font-semibold"
                : activeHistoryId === undefined
                  ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50 text-[#402970] font-bold"
                  : "text-slate-700 hover:bg-[#402970]/5 hover:text-[#402970] font-semibold"
            } ${isEffectiveCollapsed ? "justify-center gap-0 px-3 py-2" : "gap-3 px-3 py-2"}`}
            title="New chat"
          >
            <SquarePen size={19} className={activeHistoryId === undefined ? "text-[#402970] shrink-0" : "text-[#402970] group-hover:text-[#402970] transition-colors shrink-0"} />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
              isEffectiveCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
            }`}>
              New chat
            </span>
            {isEffectiveCollapsed && activeHistoryId === undefined && (
              <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-[4px] h-8 bg-[#402970] rounded-l-full" />
            )}
          </button>


          {/* History Section Header */}
          <div className="space-y-1 pt-1">
            <button
              onClick={() => { if (isEffectiveCollapsed) setIsCollapsed(false); }}
              className={`w-full flex items-center px-3 py-1.5 text-slate-800 font-bold text-sm select-none outline-none cursor-pointer hover:bg-slate-50/50 rounded-xl transition-colors ${
                isEffectiveCollapsed ? "justify-center gap-0" : "justify-between gap-3"
              }`}
              title="History"
            >
              <div className={`flex items-center ${isEffectiveCollapsed ? "gap-0" : "gap-3"}`}>
                <History size={19} className="text-[#402970] shrink-0" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap font-extrabold text-[13px] text-slate-800 tracking-wide ${
                  isEffectiveCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
                }`}>
                  History
                </span>
              </div>
            </button>

            {/* History List */}
            {!isEffectiveCollapsed && history.length > 0 && (
              <SidebarHistoryList
                history={history}
                activeHistoryId={activeHistoryId}
                onSelectHistory={onSelectHistory}
                onDeleteHistory={handleDeleteHistory}
              />
            )}
          </div>
        </div>

        {/* Bottom Section - System/User Actions */}
        <div className="p-3 border-t border-slate-100/50 space-y-1 shrink-0">

          {/* Language & Currency */}
          <div className="relative" ref={languageContainerRef}>
            <button
              onClick={() => setShowLanguagePopover(!showLanguagePopover)}
              className={`flex items-center transition-all duration-200 cursor-pointer outline-none group border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#402970]/20 hover:shadow-sm text-slate-700 font-bold text-xs ${
                isEffectiveCollapsed
                  ? "w-10 h-10 mx-auto p-0 justify-center rounded-xl"
                  : "w-full py-2.5 px-3 justify-start gap-2.5 rounded-xl"
              }`}
              title={`Language & Currency: English-${currency}`}
            >
              <Globe size={19} className="text-[#402970] group-hover:text-[#402970] transition-colors shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap group-hover:text-[#402970] transition-colors ${
                isEffectiveCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
              }`}>
                English (<span className="uppercase">{currency}</span>)
              </span>
            </button>
            {showLanguagePopover && (
              <LanguagePopover onClose={() => setShowLanguagePopover(false)} align="right" />
            )}
          </div>

          {/* Orders button */}
          <button
            onClick={() => {
              if (user) {
                setIsOrdersOpen(true);
              } else {
                openAuthModal("login");
              }
            }}
            className={`flex items-center transition-all duration-200 cursor-pointer outline-none group border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#402970]/20 hover:shadow-sm text-slate-700 font-bold text-xs ${
              isEffectiveCollapsed
                ? "w-10 h-10 mx-auto p-0 justify-center rounded-xl"
                : "w-full py-2.5 px-3 justify-start gap-2.5 rounded-xl"
            }`}
            title="My Orders"
          >
            <Package
              size={19}
              className="text-[#402970] group-hover:text-[#402970] transition-colors shrink-0"
            />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap group-hover:text-[#402970] transition-colors ${
              isEffectiveCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
            }`}>
              My Orders
            </span>
          </button>

          {/* ── User Area ─────────────────────────────────────── */}
          {user ? (
            /* Logged-in: click anywhere on the row to open Settings */
            <button
              onClick={handleUserAreaClick}
              title="Open settings"
              className={`flex items-center transition-all duration-300 cursor-pointer outline-none group border border-slate-200/60 bg-white hover:bg-[#402970]/5 hover:border-[#402970]/20 rounded-xl ${
                isEffectiveCollapsed
                  ? "w-10 h-10 mx-auto p-0 justify-center"
                  : "w-full p-2.5 gap-2.5 text-left"
              }`}
            >
              {/* Avatar: photo or initials */}
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-[#402970]/10 group-hover:ring-[#402970]/30 transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 bg-[#402970]/10 text-[#402970] group-hover:bg-[#402970]/20 transition-colors">
                  {initials}
                </div>
              )}

              {/* Name + email — only in expanded mode */}
              {!isEffectiveCollapsed && (
                <div className="flex flex-col text-left min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-700 group-hover:text-[#402970] transition-colors truncate">
                    {user.user_metadata?.full_name || "My Profile"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold group-hover:text-[#402970]/60 transition-colors truncate">
                    {user.email}
                  </span>
                </div>
              )}
            </button>
          ) : (
            /* Guest: Sign in with Google button */
            isEffectiveCollapsed ? (
              /* Collapsed: small avatar placeholder */
              <button
                onClick={handleUserAreaClick}
                title="Sign in with Google"
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-full border border-dashed border-slate-300 hover:border-[#402970]/40 bg-white hover:bg-[#402970]/5 text-slate-400 hover:text-[#402970] transition-all cursor-pointer"
              >
                <GoogleIcon />
              </button>
            ) : (
              /* Expanded: full Google sign-in button */
              <button
                onClick={handleUserAreaClick}
                className="w-full flex items-center justify-start gap-2.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#402970]/20 hover:shadow-sm text-slate-700 font-bold text-xs transition-all duration-200 cursor-pointer group"
                title="Sign in with Google"
              >
                <GoogleIcon />
                <span className="group-hover:text-[#402970] transition-colors">Sign in with Google</span>
              </button>
            )
          )}
        </div>
      </aside>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Orders Panel */}
      <OrdersPanel isOpen={isOrdersOpen} onClose={() => setIsOrdersOpen(false)} />
    </>
  );
}
