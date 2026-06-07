"use client";

import React, { useState } from "react";
import { ShoppingCart, Globe, ChevronDown, User } from "lucide-react";

interface HeaderProps {
  onNewSourcing: () => void;
  isCompact?: boolean;
}

export default function Header({ onNewSourcing, isCompact = false }: HeaderProps) {
  const [showLocationPopover, setShowLocationPopover] = useState(false);
  const [showLanguagePopover, setShowLanguagePopover] = useState(false);

  return (
    <header className="w-full bg-white/70 backdrop-blur-md border-b border-slate-100 sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Left Section: Brand & AI Mode */}
        <div className="flex items-center gap-6">
          <div 
            onClick={onNewSourcing}
            className="flex items-center gap-2 cursor-pointer group"
          >
            {/* Styled Logo matching the style of Kapuruka */}
            <div className="flex items-center">
              <img 
                src="/kapuruka-logo.jpg" 
                alt="Kapuruka.com Logo" 
                className="h-10 w-auto object-contain rounded-md"
              />
            </div>
            
            <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
            
            <span className="text-sm font-semibold px-2 py-0.5 rounded bg-[#402970]/5 text-[#402970] border border-[#402970]/10 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#402970] animate-pulse"></span>
              AI Mode
            </span>
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
                  🇱🇰 LK
                </span>
              </div>
            </div>

            {/* Popover Card matching Screenshot 1 */}
            {showLocationPopover && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] bg-white border border-slate-100 rounded-2xl shadow-xl p-5 z-50 animate-fadeIn text-left">
                {/* Arrow indicator pointing up */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45"></div>

                <div className="space-y-4 relative">
                  <h4 className="font-extrabold text-slate-800 text-sm">Specify your location</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Shipping options and fees vary based on your location
                  </p>

                  <button className="w-full bg-[#402970] hover:bg-[#33205a] active:scale-98 text-white text-xs font-bold py-2.5 rounded-full transition-all duration-200 shadow-md shadow-purple-500/10 cursor-pointer">
                    Sign in to add address
                  </button>

                  <div className="flex items-center gap-2 text-slate-350 text-[11px] font-bold select-none justify-center">
                    <div className="h-[1px] flex-1 bg-slate-100"></div>
                    <span>Or</span>
                    <div className="h-[1px] flex-1 bg-slate-100"></div>
                  </div>

                  {/* Dropdown Input */}
                  <div className="relative">
                    <div className="w-full flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 text-xs text-slate-700 font-bold hover:border-slate-300 transition-all cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span>🇱🇰</span>
                        <span>Sri Lanka</span>
                      </div>
                      <ChevronDown size={14} className="text-slate-400" />
                    </div>
                  </div>

                  {/* Postal Code Input */}
                  <input 
                    type="text" 
                    placeholder="Enter ZIP or postal code"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-[#402970] focus:ring-1 focus:ring-[#402970] transition-all"
                  />

                  {/* Save Button */}
                  <button className="w-full bg-[#402970] hover:bg-[#33205a] active:scale-98 text-white text-xs font-bold py-2.5 rounded-full transition-all duration-200 shadow-md shadow-purple-500/10 cursor-pointer">
                    Save
                  </button>
                </div>
              </div>
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
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[320px] bg-white border border-slate-100 rounded-2xl shadow-xl p-5 z-50 animate-fadeIn text-left">
                {/* Arrow indicator pointing up */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45"></div>

                <div className="space-y-4 relative">
                  <h4 className="font-extrabold text-slate-800 text-sm">Set language and currency</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Select your preferred language and currency. You can update the settings at any time.
                  </p>

                  {/* Language Selector */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-semibold">Language</label>
                    <div className="flex items-center justify-between border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-all focus-within:border-[#402970] relative">
                      <select className="w-full appearance-none px-3 py-2 bg-transparent text-xs text-slate-700 font-medium outline-none cursor-pointer">
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="zh">中文</option>
                      </select>
                      <div className="h-5 w-[1px] bg-slate-200 flex-shrink-0"></div>
                      <div className="px-3 flex items-center justify-center pointer-events-none">
                        <ChevronDown size={14} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Currency Selector */}
                  <div className="space-y-1.5">
                    <label className="text-slate-700 text-xs font-semibold">Currency</label>
                    <div className="flex items-center justify-between border border-slate-200 rounded-lg bg-white hover:border-slate-300 transition-all focus-within:border-[#402970] relative">
                      <select className="w-full appearance-none px-3 py-2 bg-transparent text-xs text-slate-700 font-medium outline-none cursor-pointer">
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="LKR">LKR - Sri Lankan Rupee</option>
                      </select>
                      <div className="h-5 w-[1px] bg-slate-200 flex-shrink-0"></div>
                      <div className="px-3 flex items-center justify-center pointer-events-none">
                        <ChevronDown size={14} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button className="w-full bg-[#402970] hover:bg-[#33205a] active:scale-98 text-white text-xs font-bold py-2.5 rounded-full transition-all duration-200 shadow-md shadow-purple-500/10 cursor-pointer">
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
 
          {/* Cart */}
          <a href="#" className="p-2 text-slate-500 hover:text-slate-900 transition-colors relative" title="Shopping Cart">
            <ShoppingCart size={19} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#402970]"></span>
          </a>
 
          {/* Sign In */}
          <button className="flex items-center gap-1 hover:text-[#402970] transition-colors py-1.5">
            <User size={16} className="text-slate-400" />
            <span className="hidden xs:inline">Sign in</span>
          </button>
 
          {/* Create Account */}
          <button className="bg-[#402970] hover:bg-[#33205a] active:scale-95 text-white font-semibold px-4 py-2 rounded-full shadow-md shadow-purple-500/10 transition-all duration-200">
            Create account
          </button>
        </div>

      </div>
    </header>
  );
}
