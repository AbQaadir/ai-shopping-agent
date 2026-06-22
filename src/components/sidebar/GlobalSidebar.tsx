"use client";

import React, { useState } from "react";
import {
  PanelLeftClose,
  PanelLeft,
  X,
} from "lucide-react";
import SidebarHistoryList from "./SidebarHistoryList";
import LanguagePopover from "../header/LanguagePopover";
import { useSourcing } from "@/context/SourcingContext";
import { useAuth } from "@/context/AuthContext";
import { HistoryItem } from "@/types/sourcing";
import SettingsModal from "../profile/SettingsModal";

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

const NewChatIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="newChatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4f46e5" />
        <stop offset="50%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#db2777" />
      </linearGradient>
    </defs>
    <path d="M12 2C6.48 2 2 6.48 2 12c0 2.02.6 3.9 1.63 5.48L2 22l4.64-1.54C8.16 21.46 9.99 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="url(#newChatGrad)" />
    <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HistoryIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="historyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06b6d4" />
        <stop offset="50%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="9" fill="url(#historyGrad)" fillOpacity="0.08" />
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="url(#historyGrad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 3v5h5" stroke="url(#historyGrad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 7v5l4 2" stroke="url(#historyGrad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GlobeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2a10 10 0 0 0-10 10" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" />
    <path d="M2 12a10 10 0 0 0 10 10" stroke="#FBBC05" strokeWidth="2" strokeLinecap="round" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="#34A853" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 2a4 10 0 0 0 0 20" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 2a4 10 0 0 1 0 20" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" />
    <path d="M2 12h20" stroke="#FBBC05" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 2v20" stroke="#34A853" strokeWidth="2" strokeLinecap="round" />
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

  const { currency } = useSourcing();
  const { user, openAuthModal } = useAuth();

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
            <NewChatIcon className={`w-[19px] h-[19px] shrink-0 transition-transform duration-200 group-hover:scale-105 ${activeHistoryId === undefined ? "" : "opacity-80 group-hover:opacity-100"}`} />
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
            <button
              onClick={() => { if (isCollapsed) setIsCollapsed(false); }}
              className={`w-full flex items-center px-3 py-3 text-slate-800 font-bold text-sm select-none outline-none cursor-pointer hover:bg-slate-50/50 rounded-xl transition-colors ${
                isCollapsed ? "justify-center gap-0" : "justify-between gap-3"
              }`}
              title="History"
            >
              <div className={`flex items-center ${isCollapsed ? "gap-0" : "gap-3"}`}>
                <HistoryIcon className="w-[19px] h-[19px] shrink-0 transition-transform duration-200 group-hover:scale-105" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap font-extrabold text-[13px] text-slate-800 tracking-wide ${
                  isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
                }`}>
                  History
                </span>
              </div>
            </button>

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
              className={`flex items-center transition-all duration-200 cursor-pointer outline-none group border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#402970]/20 hover:shadow-sm text-slate-700 font-bold text-xs ${
                isCollapsed
                  ? "w-10 h-10 mx-auto p-0 justify-center rounded-xl"
                  : "w-full py-2.5 px-3 justify-center gap-2.5 rounded-xl"
              }`}
              title={`Language & Currency: English-${currency}`}
            >
              <GlobeIcon className="w-[19px] h-[19px] shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap group-hover:text-[#402970] transition-colors ${
                isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
              }`}>
                English (<span className="uppercase">{currency}</span>)
              </span>
            </button>
            {showLanguagePopover && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLanguagePopover(false)} />
                <LanguagePopover onClose={() => setShowLanguagePopover(false)} align="right" />
              </>
            )}
          </div>

          {/* ── User Area ─────────────────────────────────────── */}
          {user ? (
            /* Logged-in: click anywhere on the row to open Settings */
            <button
              onClick={handleUserAreaClick}
              title="Open settings"
              className={`flex items-center transition-all duration-300 cursor-pointer outline-none group border border-slate-200/60 bg-white hover:bg-[#402970]/5 hover:border-[#402970]/20 rounded-xl ${
                isCollapsed
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
              {!isCollapsed && (
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
            isCollapsed ? (
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
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#402970]/20 hover:shadow-sm text-slate-700 font-bold text-xs transition-all duration-200 cursor-pointer group"
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
    </>
  );
}
