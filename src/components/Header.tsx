"use client";

import React from "react";
import { ShoppingCart, Globe, ChevronDown, User } from "lucide-react";

interface HeaderProps {
  onNewSourcing: () => void;
  isCompact?: boolean;
}

export default function Header({ onNewSourcing, isCompact = false }: HeaderProps) {
  return (
    <header className="w-full bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Left Section: Brand & AI Mode */}
        <div className="flex items-center gap-6">
          <div 
            onClick={onNewSourcing}
            className="flex items-center gap-2 cursor-pointer group"
          >
            {/* Styled Logo matching the font/color style of Alibaba */}
            <span className="text-2xl font-black tracking-tight text-[#ff6600] select-none transition-transform group-hover:scale-[1.02]">
              Alibaba<span className="text-slate-800 font-bold text-xl">.com</span>
            </span>
            
            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
            
            <span className="text-sm font-semibold px-2 py-0.5 rounded bg-orange-50 text-[#ff6600] border border-orange-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-pulse"></span>
              AI Mode
            </span>
          </div>

          {!isCompact && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="#" className="hover:text-[#ff6600] transition-colors">Products</a>
              <a href="#" className="hover:text-[#ff6600] transition-colors">Manufacturers</a>
              <a href="#" className="hover:text-[#ff6600] transition-colors">Worldwide</a>
            </nav>
          )}
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-600">
          
          {/* Deliver To */}
          <div className="hidden lg:flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors">
            <span className="text-xs">Deliver to:</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold px-1 py-0.2 bg-slate-100 rounded text-slate-700 border border-slate-200">
                🇱🇰 LK
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>

          {/* Lang/Currency */}
          <div className="hidden sm:flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors">
            <Globe size={16} className="text-slate-500" />
            <span>English-USD</span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          {/* Cart */}
          <a href="#" className="p-2 text-slate-500 hover:text-slate-900 transition-colors relative" title="Shopping Cart">
            <ShoppingCart size={19} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ff6600]"></span>
          </a>

          {/* Sign In */}
          <button className="flex items-center gap-1 hover:text-[#ff6600] transition-colors py-1.5">
            <User size={16} className="text-slate-400" />
            <span className="hidden xs:inline">Sign in</span>
          </button>

          {/* Create Account */}
          <button className="bg-[#ff6600] hover:bg-[#e05900] active:scale-95 text-white font-semibold px-4 py-2 rounded-full shadow-md shadow-orange-500/10 transition-all duration-200">
            Create account
          </button>
        </div>

      </div>
    </header>
  );
}
