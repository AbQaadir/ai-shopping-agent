"use client";

import { useState } from "react";
import { Globe, Menu, ShoppingCart, User } from "lucide-react";
import LocationPopover from "./header/LocationPopover";
import LanguagePopover from "./header/LanguagePopover";

interface GlobalHeaderProps {
  onNewSourcing: () => void;
  isCompact?: boolean;
  onMenuToggle?: () => void;
}

export default function GlobalHeader({ onNewSourcing, isCompact = false, onMenuToggle }: GlobalHeaderProps) {
  const [showLocationPopover, setShowLocationPopover] = useState(false);
  const [showLanguagePopover, setShowLanguagePopover] = useState(false);

  return (
    <header className="w-full bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10">
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
            {/* Styled Logo matching the style of Kapuruka */}
            <div className="flex items-center">
              <img
                src="/kapuruka-logo.jpg"
                alt="Kapuruka.com Logo"
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
                <span className="text-[11px] font-bold px-1 py-0.2 bg-slate-100 rounded text-slate-700 border border-slate-200">
                  LK
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
              <span>English-USD</span>
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

          {/* Sign In */}
          <button className="flex items-center gap-1 hover:text-[#402970] transition-colors py-1.5" title="Sign In">
            <User size={16} className="text-slate-400" />
            <span className="hidden md:inline">Sign in</span>
          </button>

          {/* Create Account */}
          <button className="hidden sm:block bg-[#402970] hover:bg-[#33205a] active:scale-95 text-white font-semibold px-4 py-2 rounded-full shadow-md shadow-purple-500/10 transition-all duration-200 text-xs sm:text-sm">
            Create account
          </button>
        </div>

      </div>
    </header>
  );
}
