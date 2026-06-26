"use client";

import { useSourcing } from "@/context/SourcingContext";
import { useAuth } from "@/context/AuthContext";
import { Menu, Paperclip, Search, Send, ShoppingCart, User, Sparkles, SquarePen, Compass, CreditCard, Package, RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface LandingWorkspaceProps {
  onSend: (text: string) => void;
  onSuggestionClick: (suggestion: string) => void;
}


export default function LandingWorkspace({ onSend, onSuggestionClick }: LandingWorkspaceProps) {
  const { setIsMobileSidebarOpen, setIsViewingCart, handleReset } = useSourcing();
  const { user, openAuthModal } = useAuth();
  const [inputText, setInputText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const autocompleteCache = useRef<Record<string, string[]>>({});
  const hasFetchedForCurrentInput = useRef(false);
  const fetchedSuggestionsForInput = useRef<string[]>([]);


  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = user
    ? (user.user_metadata?.full_name || user.email || "U").substring(0, 2).toUpperCase()
    : null;

  // Auto-resize textarea
  useEffect(() => {
    const tx = textareaRef.current;
    if (tx) {
      tx.style.height = "auto";
      tx.style.height = `${tx.scrollHeight}px`;
    }
  }, [inputText]);

  // Handle mouse wheel horizontal scroll on product carousel
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheelScroll = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheelScroll, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheelScroll);
    };
  }, []);

  // Autocomplete fetch logic
  useEffect(() => {
    const words = inputText.trim().split(/\s+/).filter(Boolean);

    if (!inputText || words.length < 4) {
      setSuggestions([]);
      setShowDropdown(false);
      setSelectedIndex(-1);
      hasFetchedForCurrentInput.current = false;
      fetchedSuggestionsForInput.current = [];
      return;
    }

    if (hasFetchedForCurrentInput.current) {
      const currentLower = inputText.toLowerCase();
      const filtered = fetchedSuggestionsForInput.current.filter((s) =>
        s.toLowerCase().startsWith(currentLower)
      );
      if (filtered.length > 0) {
        setSuggestions(filtered);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
      return;
    }

    hasFetchedForCurrentInput.current = true;

    const controller = new AbortController();
    const fetchSuggestions = async () => {
      try {
        const res = await fetch("/api/chat/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputText,
            chatHistory: [],
          }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const suggestionsList = data.suggestions || [];
          fetchedSuggestionsForInput.current = suggestionsList;

          if (suggestionsList.length > 0) {
            setSuggestions(suggestionsList);
            setShowDropdown(true);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Autocomplete fetch error:", err);
        }
      }
    };

    fetchSuggestions();

    return () => {
      controller.abort();
    };
  }, [inputText]);

  const handleSubmit = () => {
    if (inputText.trim()) {
      onSend(inputText);
      setInputText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        const selectedText = suggestions[selectedIndex];
        setInputText(selectedText);
        setShowDropdown(false);
        setSelectedIndex(-1);
        onSend(selectedText);
        setInputText("");
        return;
      }
      if (e.key === "Escape" || e.key === "Tab") {
        setShowDropdown(false);
        setSelectedIndex(-1);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden h-full relative bg-[#fbfbfe]">
      {/* Background World Map Watermark */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{
          backgroundImage: "url('/world.svg')",
          filter: "invert(18%) sepia(26%) saturate(3025%) hue-rotate(241deg) brightness(97%) contrast(92%)",
          opacity: 0.1
        }}
      />

      {/* Desktop Floating Logo (Top-Left) */}
      <div className="hidden md:flex absolute top-6 left-6 items-center z-20">
        <div className="border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 select-none bg-white">
          <img
            src="/kapuruka-logo.jpg"
            alt="Kapuruka.com Logo"
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>

      {/* Desktop Floating Global Cart + Sign-In (Top-Right) */}
      <div className="hidden md:flex absolute top-6 right-6 items-center gap-3 z-20">
        {/* Sign-In pill — only shown when guest */}
        {!user && (
          <button
            onClick={() => openAuthModal("login")}
            className="bg-white/85 backdrop-blur-md border border-slate-200/80 text-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-3 flex items-center gap-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] hover:border-[#402970]/20 hover:-translate-y-0.5 cursor-pointer outline-none select-none active:scale-95 group font-bold text-sm"
            title="Sign in to Kapuruka"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            <span className="group-hover:text-[#402970] transition-colors">Sign In</span>
          </button>
        )}
        <button
          onClick={() => setIsViewingCart(true)}
          className="bg-white/85 backdrop-blur-md border border-slate-200/80 text-[#402970] shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-3 flex items-center gap-3.5 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] hover:border-slate-200/80 hover:-translate-y-0.5 cursor-pointer outline-none select-none active:scale-95 group font-bold text-sm"
          title="Global Shopping Cart"
        >
          <div className="relative">
            <ShoppingCart size={19} className="text-slate-600 group-hover:text-[#402970] transition-colors" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#402970]" />
          </div>
          <span className="text-slate-700 group-hover:text-[#402970] transition-colors">Global Cart</span>
        </button>
      </div>

      {/* Mobile-only minimal header (Sleek Blur & App-like shortcuts) */}
      <div className="md:hidden w-full h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-white/85 backdrop-blur-md shrink-0 select-none z-20">
        <div className="flex items-center gap-1.5 animate-fadeIn">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 outline-none"
            title="Open menu"
          >
            <Menu size={20} />
          </button>
          <img
            src="/kapuruka-logo.jpg"
            alt="Kapuruka Logo"
            className="h-8 w-auto object-contain rounded-md select-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {/* New Chat shortcut */}
          <button
            onClick={() => {
              setInputText("");
              handleReset();
            }}
            className="p-2 text-slate-500 hover:text-[#402970] hover:bg-[#402970]/5 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 outline-none"
            title="New Chat"
          >
            <SquarePen size={18} />
          </button>

          <button
            onClick={() => setIsViewingCart(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 outline-none relative"
            title="Open global cart"
          >
            <ShoppingCart size={18} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#402970]" />
          </button>

          {/* User initials / Sign-In */}
          {user ? (
            <button
              onClick={() => openAuthModal("login")}
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] bg-[#402970]/10 text-[#402970] border border-[#402970]/15 active:scale-95 transition-all outline-none"
              title="Profile Settings"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </button>
          ) : (
            <button
              onClick={() => openAuthModal("login")}
              className="p-2 -mr-2 text-slate-500 hover:text-[#402970] hover:bg-[#402970]/5 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 outline-none"
              title="Sign in"
            >
              <User size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area (Welcome text + Mock Chat history) */}
      <div className="flex-1 w-full max-w-[850px] mx-auto px-4 py-6 flex flex-col justify-start items-center gap-6 relative z-10 overflow-y-auto scrollbar-none select-none">

        {/* Welcome Section */}
        <div className="flex flex-col items-center justify-center text-center w-full gap-2 pt-20 pb-0 select-none animate-fadeIn">
          <h1 className="text-2xl sm:text-4xl lg:text-[40px] font-extrabold tracking-tight leading-tight bg-gradient-to-r from-purple-700 via-[#402970] to-indigo-700 bg-clip-text text-transparent max-w-4xl px-2">
            Skip the Scrolling.
            <span className="block mt-1">Just Chat to Shop Kapruka</span>
          </h1>
        </div>

        {/* Mock Chat History container */}
        <div className="w-full space-y-5 pb-24 animate-fadeIn mt-0" style={{ animationDelay: "150ms" }}>

          {/* User Mock Bubble */}
          <div className="flex items-start justify-end gap-3 w-full">
            <div className="flex flex-col items-end gap-2 max-w-[85%]">
              <div className="px-4 py-2.5 font-semibold shadow-xs text-[13px] bg-[#EDE9FE]/75 border border-violet-100/60 text-[#402970] rounded-2xl">
                What are the services this platform offers?
              </div>
            </div>
            {/* User Avatar Icon from /person.svg */}
            <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden shadow-xs select-none flex items-center justify-center">
              <img
                src="/person.svg"
                alt="User Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* AI Mock Bubble */}
          <div className="flex items-start justify-start gap-3 w-full">
            {/* AI Avatar Icon from /image.png */}
            <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden shadow-xs select-none mt-1 flex items-center justify-center">
              <img
                src="/image.png"
                alt="Kapuruka AI Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 flex flex-col gap-4 min-w-0 max-w-[85%]">

              {/* Text Bubble */}
              <div className="px-4 py-3.5 bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] rounded-2xl rounded-tl-xs leading-relaxed font-semibold max-w-full text-slate-800 text-[13px]">
                Okay, this is Kapruka Personal Shopping Agent, so we offer a bunch of services in a conversational way. Here are the core services you can access:
              </div>

              {/* Product Carousel Mock */}
              <div className="w-full">
                <div ref={scrollContainerRef} className="flex overflow-x-auto gap-4 pb-2 scrollbar-none snap-x snap-mandatory scroll-smooth w-full">

                  {/* Card 1: Smart Product Discovery */}
                  <div className="bg-white rounded-2xl border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.015)] flex flex-col w-[170px] h-[170px] shrink-0 p-4 select-none justify-between hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-slate-200/60 transition-all duration-300">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#402970] flex items-center justify-center shrink-0">
                      <Compass size={18} className="text-[#402970]" />
                    </div>
                    <div className="flex-1 flex flex-col justify-end mt-2 min-h-0">
                      <h6 className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2">
                        Smart Discovery
                      </h6>
                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-3 mt-1.5">
                        Browse categories and search the live product catalog using natural language.
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Dynamic Cart Management */}
                  <div className="bg-white rounded-2xl border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.015)] flex flex-col w-[170px] h-[170px] shrink-0 p-4 select-none justify-between hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-slate-200/60 transition-all duration-300">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#402970] flex items-center justify-center shrink-0">
                      <ShoppingCart size={17} className="text-[#402970]" />
                    </div>
                    <div className="flex-1 flex flex-col justify-end mt-2 min-h-0">
                      <h6 className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2">
                        Dynamic Cart
                      </h6>
                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-3 mt-1.5">
                        Add, modify, or update quantities of items dynamically through chat.
                      </p>
                    </div>
                  </div>

                  {/* Card 3: End-to-End Guest Checkout */}
                  <div className="bg-white rounded-2xl border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.015)] flex flex-col w-[170px] h-[170px] shrink-0 p-4 select-none justify-between hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-slate-200/60 transition-all duration-300">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#402970] flex items-center justify-center shrink-0">
                      <CreditCard size={18} className="text-[#402970]" />
                    </div>
                    <div className="flex-1 flex flex-col justify-end mt-2 min-h-0">
                      <h6 className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2">
                        Guest Checkout
                      </h6>
                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-3 mt-1.5">
                        Gather customer shipping details natively within the conversation.
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Live Order Tracking */}
                  <div className="bg-white rounded-2xl border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.015)] flex flex-col w-[170px] h-[170px] shrink-0 p-4 select-none justify-between hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-slate-200/60 transition-all duration-300">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#402970] flex items-center justify-center shrink-0">
                      <Package size={18} className="text-[#402970]" />
                    </div>
                    <div className="flex-1 flex flex-col justify-end mt-2 min-h-0">
                      <h6 className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2">
                        Order Tracking
                      </h6>
                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-3 mt-1.5">
                        Check the real-time status of an existing order number directly via chat.
                      </p>
                    </div>
                  </div>

                  {/* Card 5: Quick Reordering */}
                  <div className="bg-white rounded-2xl border border-slate-100/90 shadow-[0_2px_12px_rgba(0,0,0,0.015)] flex flex-col w-[170px] h-[170px] shrink-0 p-4 select-none justify-between hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-slate-200/60 transition-all duration-300">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-[#402970] flex items-center justify-center shrink-0">
                      <RefreshCw size={17} className="text-[#402970]" />
                    </div>
                    <div className="flex-1 flex flex-col justify-end mt-2 min-h-0">
                      <h6 className="text-[12px] font-bold text-slate-800 leading-snug line-clamp-2">
                        Quick Reordering
                      </h6>
                      <p className="text-[10px] text-slate-500 leading-normal line-clamp-3 mt-1.5">
                        Instantly reorder past purchases and gifts with a single message.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Concluding Question Bubble */}
              <div className="px-4 py-3 bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] rounded-2xl rounded-tl-xs leading-relaxed font-semibold max-w-full text-slate-800 text-[13px]">
                What are you looking for?
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* Sticky Bottom Prompt Console (Gemini inspired) */}
      <div className="w-full bg-gradient-to-t from-[#fbfbfe] via-[#fbfbfe]/95 to-transparent pt-6 pb-6 px-4 md:px-6 shrink-0 relative z-30">
        <div className="max-w-[760px] mx-auto w-full relative group">


          <div className="w-full relative">
            {/* Input card backing glow */}
            <div className={`absolute -inset-0.5 bg-gradient-to-r from-[#402970] to-purple-500 blur-md transition-all duration-300 pointer-events-none ${isFocused ? "opacity-35" : "opacity-15 group-hover:opacity-20"} rounded-[26px]`} />

            {/* Input card container */}
            <div className={`w-full bg-white border transition-all duration-300 flex flex-col relative z-20 ${isFocused ? "border-[#402970]/30 shadow-lg shadow-[#402970]/5" : "border-slate-200/80 shadow-sm"} rounded-[26px]`}>
              <div className="w-full py-1.5 pl-2.5 pr-2 flex items-center gap-1.5">

                {/* File Attachment Button */}
                <button
                  disabled={true}
                  type="button"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-350 transition-all cursor-not-allowed shrink-0 relative"
                  title="File attachment disabled"
                >
                  <Paperclip size={19} />
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => {
                    setIsFocused(false);
                    setTimeout(() => {
                      setShowDropdown(false);
                      setSelectedIndex(-1);
                    }, 180);
                  }}
                  placeholder="i want to buy ...."
                  rows={1}
                  className="flex-1 resize-none border-none outline-none text-slate-800 placeholder-slate-400 bg-transparent text-[14px] sm:text-[15px] py-2 leading-normal max-h-[160px] overflow-y-auto scrollbar-none"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                />

                {/* Send Button */}
                <button
                  onClick={handleSubmit}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!inputText.trim()}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 ${
                    inputText.trim()
                      ? "bg-[#402970] hover:bg-[#33205a] text-white shadow-md shadow-purple-500/20 active:scale-95"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Send size={16} className="ml-[1px]" />
                </button>
              </div>
            </div>

            {/* Autocomplete Dropdown - Floats ABOVE the input bar */}
            {showDropdown && suggestions.length > 0 && (
              <div
                className="absolute bottom-full left-0 right-0 mb-3 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-[0_-10px_35px_rgba(64,41,112,0.1)] rounded-2xl p-1.5 flex flex-col z-35 origin-bottom animate-fadeInScale"
              >
                {suggestions.map((suggestion, index) => {
                  const queryTrim = inputText.trim();
                  const queryLower = queryTrim.toLowerCase();
                  const suggLower = suggestion.toLowerCase();
                  const hasPrefix = suggLower.startsWith(queryLower);
                  const prefix = hasPrefix ? suggestion.substring(0, queryTrim.length) : "";
                  const suffix = hasPrefix ? suggestion.substring(queryTrim.length) : suggestion;

                  return (
                    <button
                      key={index}
                      onMouseDown={(e) => e.preventDefault()} // Prevents textarea blur
                      onClick={() => {
                        onSend(suggestion);
                        setInputText("");
                        setShowDropdown(false);
                        setSelectedIndex(-1);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left px-3.5 py-2.5 text-sm sm:text-[15px] rounded-xl transition-all duration-150 flex items-center justify-between group cursor-pointer ${
                        selectedIndex === index
                          ? "bg-[#402970]/5 text-[#402970] font-semibold"
                          : "text-slate-650 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Search
                          size={14}
                          className={`shrink-0 transition-colors ${
                            selectedIndex === index ? "text-[#402970]" : "text-slate-400 group-hover:text-[#402970]/60"
                          }`}
                        />
                        <span className="truncate">
                          {hasPrefix ? (
                            <>
                              <span className="text-slate-400 font-normal">{prefix}</span>
                              <span className={`font-semibold ${selectedIndex === index ? "text-[#402970]" : "text-slate-800"}`}>
                                {suffix}
                              </span>
                            </>
                          ) : (
                            <span className={`font-semibold ${selectedIndex === index ? "text-[#402970]" : "text-slate-700"}`}>
                              {suggestion}
                            </span>
                          )}
                        </span>
                      </div>
                      {selectedIndex === index && (
                        <span className="text-[10px] sm:text-xs text-[#402970] font-bold bg-[#402970]/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 animate-fadeIn select-none">
                          Select
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Small disclaimer footer */}
        <p className="text-[10px] text-center text-slate-400 mt-2.5 select-none font-medium">
          Kapuruka Sourcing AI may display inaccurate info, so double-check responses.
        </p>
      </div>
    </div>
  );
}
