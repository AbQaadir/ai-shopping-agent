"use client";

import { useSourcing } from "@/context/SourcingContext";
import { useAuth } from "@/context/AuthContext";
import { Menu, Paperclip, Search, Send, ShoppingCart, User, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface LandingWorkspaceProps {
  onSend: (text: string, files: File[]) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export default function LandingWorkspace({ onSend, onSuggestionClick }: LandingWorkspaceProps) {
  const { setIsMobileSidebarOpen, setIsViewingCart } = useSourcing();
  const { user, openAuthModal } = useAuth();
  const [inputText, setInputText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Client-side cache to load previously typed prefixes instantly
  const autocompleteCache = useRef<Record<string, string[]>>({});

  useEffect(() => {
    const tx = textareaRef.current;
    if (tx) {
      tx.style.height = "auto";
      tx.style.height = `${tx.scrollHeight}px`;
    }
  }, [inputText]);

  useEffect(() => {
    if (!inputText || inputText.trim().length < 4) {
      setSuggestions([]);
      setShowDropdown(false);
      setSelectedIndex(-1);
      return;
    }

    const cacheKey = inputText.trim().toLowerCase();

    // Check client-side cache first
    if (autocompleteCache.current[cacheKey]) {
      const cached = autocompleteCache.current[cacheKey];
      if (cached.length > 0) {
        setSuggestions(cached);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
      return;
    }

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
          // Save to client-side cache
          autocompleteCache.current[cacheKey] = suggestionsList;

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

    // Reduced from 300ms to 250ms for snappier autocomplete response
    const debounceTimer = setTimeout(fetchSuggestions, 250);
    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [inputText]);

  const handleSubmit = () => {
    if (inputText.trim() || attachedFiles.length > 0) {
      onSend(inputText, attachedFiles);
      setInputText("");
      setAttachedFiles([]);
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
        onSend(selectedText, attachedFiles);
        setInputText("");
        setAttachedFiles([]);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden h-full relative">
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
            className="bg-white/85 backdrop-blur-md border border-slate-100/80 text-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-3.5 flex items-center gap-3 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] hover:border-[#402970]/20 hover:-translate-y-0.5 cursor-pointer outline-none select-none active:scale-95 group font-bold text-sm"
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
          className="bg-white/85 backdrop-blur-md border border-slate-100/80 text-[#402970] shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-3.5 flex items-center gap-3.5 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] hover:border-slate-200/80 hover:-translate-y-0.5 cursor-pointer outline-none select-none active:scale-95 group font-bold text-sm"
          title="Global Shopping Cart"
        >
          <div className="relative">
            <ShoppingCart size={19} className="text-slate-650 group-hover:text-[#402970] transition-colors" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#402970]" />
          </div>
          <span className="text-slate-700 group-hover:text-[#402970] transition-colors">Global Cart</span>
        </button>
      </div>

      {/* Mobile-only minimal header */}
      <div className="md:hidden w-full h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-white shrink-0 select-none">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 outline-none"
          title="Open menu"
        >
          <Menu size={20} />
        </button>
        <img
          src="/kapuruka-logo.jpg"
          alt="Kapuruka"
          className="h-7 w-auto object-contain rounded-md"
        />
        <div className="flex items-center gap-1">
          {/* Minimal Sign-In icon — only for guests on mobile */}
          {!user && (
            <button
              onClick={() => openAuthModal("login")}
              className="p-2 text-slate-500 hover:text-[#402970] hover:bg-[#402970]/5 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 outline-none"
              title="Sign in"
            >
              <User size={20} />
            </button>
          )}
          <button
            onClick={() => setIsViewingCart(true)}
            className="p-2 -mr-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 outline-none relative"
            title="Open global cart"
          >
            <ShoppingCart size={20} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#402970]" />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center gap-6 sm:gap-10 relative overflow-y-auto animate-fadeIn">

      {/* Background glow */}
      <div className="absolute top-[10%] sm:top-[15%] left-1/2 -translate-x-1/2 w-[320px] sm:w-[700px] h-[180px] sm:h-[350px] bg-gradient-to-tr from-[#402970]/8 to-purple-400/8 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none -z-10" />

      {/* Hero Section */}
      <div className="flex flex-col items-center text-center max-w-3xl mx-auto w-full gap-4 sm:gap-6 mt-2 sm:mt-4">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-purple-700 via-[#402970] to-indigo-700 bg-clip-text text-transparent max-w-2xl px-2">
          Sri Lanka&apos;s AI Shopping, Delivery & Services
        </h1>

        {/* Prompt input */}
        <div className="w-full relative group px-2 sm:px-0">
          {/* Attached files row above the pill */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-2 bg-white/90 backdrop-blur-md rounded-xl border border-slate-100 shadow-sm self-start animate-fadeIn animate-slideInRight mb-2">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-medium text-slate-600">
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button onClick={() => setAttachedFiles((p) => p.filter((_, i) => i !== idx))} className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="w-full relative">
            {/* Background glow of the search input - remains rounded-full always */}
            <div className={`absolute -inset-1 bg-gradient-to-r from-[#402970] to-purple-500 blur-lg transition-all duration-300 pointer-events-none ${isFocused ? "opacity-40" : "opacity-20 group-hover:opacity-30"} rounded-full`} />

            {/* Input field card - stays rounded-full since suggestions float below */}
            <div className={`w-full bg-white border transition-all duration-300 flex flex-col relative z-20 ${isFocused ? "border-[#402970]/30 shadow-lg shadow-[#402970]/5" : "border-slate-100 shadow-sm"} rounded-full`}>
              <div className="w-full py-1.5 pl-2 pr-1.5 flex items-center gap-2">
                {/* Attachment Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onMouseDown={(e) => e.preventDefault()}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-550 hover:text-[#402970] transition-all cursor-pointer shrink-0 relative"
                  title="Attach files"
                >
                  <Paperclip size={19} />
                  {attachedFiles.length > 0 && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  )}
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />

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
                    }, 150);
                  }}
                  placeholder='Try: "Show me birthday cakes under Rs. 3,000"...'
                  rows={1}
                  className="flex-1 resize-none border-none outline-none text-slate-700 placeholder-slate-400 bg-transparent text-sm sm:text-[15px] py-1.5 leading-normal max-h-[120px] overflow-y-auto scrollbar-none"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                />

                {/* Send Button */}
                <button
                  onClick={handleSubmit}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={!inputText.trim() && attachedFiles.length === 0}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 ${
                    inputText.trim() || attachedFiles.length > 0
                      ? "bg-[#402970] hover:bg-[#33205a] text-white shadow-md shadow-purple-500/20 active:scale-95"
                      : "bg-slate-100 text-slate-350 cursor-not-allowed"
                  }`}
                >
                  <Send size={16} className="ml-[1px]" />
                </button>
              </div>
            </div>

            {/* Autocomplete Dropdown floating below the input card */}
            {showDropdown && suggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-slate-100/80 shadow-[0_10px_35px_rgba(64,41,112,0.08)] rounded-2xl p-1.5 flex flex-col z-35 origin-top animate-fadeInScale"
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
                        onSend(suggestion, attachedFiles);
                        setInputText("");
                        setAttachedFiles([]);
                        setShowDropdown(false);
                        setSelectedIndex(-1);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left px-3.5 py-2.5 text-sm sm:text-[15px] rounded-lg transition-all duration-150 flex items-center justify-between group cursor-pointer ${
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
                              <span className={`font-semibold ${selectedIndex === index ? "text-[#402970]" : "text-slate-850"}`}>
                                {suffix}
                              </span>
                            </>
                          ) : (
                            <span className={`font-semibold ${selectedIndex === index ? "text-[#402970]" : "text-slate-755"}`}>
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
      </div>


    </div>
  </div>
  );
}
