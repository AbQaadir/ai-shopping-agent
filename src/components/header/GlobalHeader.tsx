"use client";

import { useState } from "react";
import { Globe, Menu, ShoppingCart, User, LogOut, Share2, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import LocationPopover from "./LocationPopover";
import LanguagePopover from "./LanguagePopover";
import { useSourcing } from "@/context/SourcingContext";
import { useAuth } from "@/context/AuthContext";

interface GlobalHeaderProps {
  onNewSourcing: () => void;
  isCompact?: boolean;
  onMenuToggle?: () => void;
}

export default function GlobalHeader({ onNewSourcing, isCompact = false, onMenuToggle }: GlobalHeaderProps) {
  const [showLocationPopover, setShowLocationPopover] = useState(false);
  const [showLanguagePopover, setShowLanguagePopover] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const { country, currency, isChatting, isSharedReadOnly } = useSourcing();
  const { user, signInWithGoogle, signOut } = useAuth();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="sticky top-0 z-10">
      {isSharedReadOnly && (
        <div className="w-full bg-[#f8f9ff] border-b border-[#402970]/10 py-2 px-4 flex items-center justify-center gap-2 text-xs font-semibold text-[#402970]">
          <span className="w-2 h-2 rounded-full bg-[#402970] animate-pulse"></span>
          You are viewing a shared chat.
          <button onClick={onNewSourcing} className="underline decoration-[#402970]/30 hover:decoration-[#402970] underline-offset-2 ml-1 cursor-pointer">
            Start a new chat
          </button>
          to ask your own questions.
        </div>
      )}
      <header className="w-full bg-white/70 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">

        {/* Left Section: Brand & AI Mode */}
        <div className="flex items-center gap-2 sm:gap-6">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all duration-200 cursor-pointer active:scale-95"
              aria-label="Toggle menu"
              title="Open menu"
            >
              <Menu size={20} />
            </button>
          )}

          <div
            onClick={onNewSourcing}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group"
          >
            {/* Styled Logo matching the style of Kapruka */}
            <div className="flex items-center">
              <img
                src="/kapruka-logo.jpg"
                alt="Kapruka.com Logo"
                className="h-8 sm:h-10 w-auto object-contain rounded-md"
              />
            </div>

            <div className="h-5 sm:h-6 w-[1px] bg-slate-200 mx-0.5 sm:mx-1"></div>
          </div>

          {!isCompact && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="#" className="hover:text-[#402970] transition-colors">Products</a>
              <a href="#" className="hover:text-[#402970] transition-colors">Manufacturers</a>
              <a href="#" className="hover:text-[#402970] transition-colors">Worldwide</a>
            </nav>
          )}
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-600">

          {/* Deliver To with Popover */}
          <div
            className="relative hidden lg:block"
            onMouseEnter={() => setShowLocationPopover(true)}
            onMouseLeave={() => setShowLocationPopover(false)}
          >
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors py-2">
              <span className="text-xs">Deliver to:</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold px-1 py-0.2 bg-slate-100 rounded text-slate-700 border border-slate-200 uppercase">
                  {country}
                </span>
              </div>
            </div>

            {/* Popover Card matching Screenshot 1 */}
            {showLocationPopover && (
              <LocationPopover onClose={() => setShowLocationPopover(false)} />
            )}
          </div>

          {/* Lang/Currency with Popover */}
          <div
            className="relative hidden sm:block"
            onMouseEnter={() => setShowLanguagePopover(true)}
            onMouseLeave={() => setShowLanguagePopover(false)}
          >
            <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors py-2">
              <Globe size={16} className="text-slate-500" />
              <span>English-{currency}</span>
            </div>

            {/* Popover Card matching Screenshot */}
            {showLanguagePopover && (
              <LanguagePopover onClose={() => setShowLanguagePopover(false)} />
            )}
          </div>

          {/* Cart */}
          <a href="#" className="p-2 text-slate-500 hover:text-slate-900 transition-colors relative" title="Shopping Cart">
            <ShoppingCart size={19} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#402970]"></span>
          </a>

          {/* Share Button (Only if chatting and not read-only) */}
          {isChatting && !isSharedReadOnly && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:border-[#402970]/30 hover:bg-[#402970]/5 text-slate-600 hover:text-[#402970] transition-colors text-xs font-semibold"
            >
              {copied ? <CheckCircle2 size={14} className="text-green-600" /> : <Share2 size={14} />}
              {copied ? "Copied" : "Share"}
            </button>
          )}

          {/* User Profile Switcher */}
          <div className="relative">
            <button
              onClick={() => {
                if (!user) {
                  signInWithGoogle();
                } else {
                  setShowUserDropdown(!showUserDropdown);
                }
              }}
              className="flex items-center gap-1.5 bg-[#402970]/5 border border-[#402970]/10 hover:bg-[#402970]/15 text-[#402970] font-bold px-4 py-2 rounded-full transition-all duration-200 text-xs cursor-pointer select-none"
            >
              <User size={14} className="stroke-[2.5]" />
              <span>
                {user ? user.user_metadata.full_name || "User Profile" : "Sign In"}
              </span>
            </button>

            {showUserDropdown && user && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowUserDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl z-30 p-1 flex flex-col gap-0.5 animate-fadeIn">
                  <span className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1.5 tracking-wider truncate">
                    {user.email}
                  </span>
                  <button
                    onClick={() => {
                      signOut();
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg font-semibold transition-colors flex items-center justify-between cursor-pointer hover:bg-slate-50 text-slate-700"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut size={14} />
                      Log out
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
      </header>
    </div>
  );
}
