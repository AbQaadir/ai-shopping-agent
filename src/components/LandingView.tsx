"use client";

import React, { useRef, useState } from "react";
import { 
  Paperclip, 
  ArrowUp, 
  ChevronRight, 
  Download, 
  Check, 
  X,
  Workflow
} from "lucide-react";

interface LandingViewProps {
  onSend: (text: string, files: File[]) => void;
  onSuggestionClick: (suggestion: string) => void;
}

export default function LandingView({ onSend, onSuggestionClick }: LandingViewProps) {
  const [inputText, setInputText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (inputText.trim() || attachedFiles.length > 0) {
      onSend(inputText, attachedFiles);
      setInputText("");
      setAttachedFiles([]);
    }
  };

  const suggestions = [
    { text: "Verified manufacturer search", icon: "🔥" },
    { text: "Design with AI", icon: "🎨" },
    { text: "Product search", icon: "📦" },
    { text: "Analyze bestsellers", icon: "📊" },
    { text: "Evaluate suppliers", icon: "🔍" },
  ];

  // Channels mock data for Accio Work
  const channels = [
    { name: "Telegram", status: "Connected", users: 1, groups: 0, requests: 0, iconColor: "text-sky-500", bgColor: "bg-sky-50" },
    { name: "Discord", status: "Connected", users: 1, groups: 0, requests: 0, iconColor: "text-indigo-500", bgColor: "bg-indigo-50" },
    { name: "DingTalk", status: "Connected", users: 0, groups: 0, requests: 0, iconColor: "text-blue-500", bgColor: "bg-blue-50" },
    { name: "WeChat", status: "Groups unsupported", users: 1, groups: "unsupported", requests: 0, iconColor: "text-emerald-500", bgColor: "bg-emerald-50" },
    { name: "Feishu", status: "Connected", users: 1, groups: 1, requests: 0, iconColor: "text-cyan-500", bgColor: "bg-cyan-50" },
  ];

  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-10 flex flex-col justify-between gap-12 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-orange-400/10 to-pink-500/10 rounded-full blur-[100px] pointer-events-none -z-10"></div>
      
      {/* 1. Central Hero Sourcing Box */}
      <div className="flex flex-col items-center mt-6 text-center max-w-4xl mx-auto w-full">
        <h1 className="text-[32px] sm:text-4xl lg:text-[40px] font-extrabold text-slate-800 tracking-tight mb-8 leading-tight">
          All tasks in one ask, smart sourcing with AI
        </h1>
        
        {/* Glow-framed Prompt Card */}
        <div className="w-full relative group">
          {/* Subtle gradient backdrop shadow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-pink-500 rounded-[28px] opacity-[0.08] group-hover:opacity-[0.15] blur-md transition-opacity duration-300 pointer-events-none"></div>
          
          <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-4 flex flex-col relative">
            <textarea
              value={inputText}
              onChange={handleTextChange}
              onKeyDown={handleKeyPress}
              placeholder="Describe your needs..."
              rows={3}
              className="w-full resize-none border-none outline-none text-slate-700 placeholder-slate-400 bg-transparent text-[16px] px-2 py-1 leading-relaxed min-h-[80px]"
            />

            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pb-3 pt-1 border-b border-slate-50">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-xs font-medium text-slate-600 animate-fadeIn">
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button 
                      onClick={() => removeFile(idx)}
                      className="p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Controls */}
            <div className="flex items-center justify-between pt-3 px-2">
              <button
                onClick={handlePaperclipClick}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-all duration-200"
                title="Attach Files"
              >
                <Paperclip size={18} />
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
              />

              <button
                onClick={handleSubmit}
                disabled={!inputText.trim() && attachedFiles.length === 0}
                className={`p-2.5 rounded-full flex items-center justify-center transition-all duration-200 ${
                  inputText.trim() || attachedFiles.length > 0
                    ? "bg-[#ff6600] hover:bg-[#e05900] text-white shadow-md shadow-orange-500/20 active:scale-95"
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
                title="Send query"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Suggestion Badges */}
        <div className="flex items-center justify-center flex-wrap gap-2.5 mt-6 w-full px-2 max-w-3xl">
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(sug.text)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-100 rounded-full text-sm font-medium hover:border-slate-200 shadow-[0_2px_6px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.03)] active:scale-98 transition-all duration-200"
            >
              <span>{sug.icon}</span>
              <span>{sug.text}</span>
            </button>
          ))}
          <button className="p-2 bg-white border border-slate-100 hover:border-slate-200 rounded-full text-slate-400 hover:text-slate-600 shadow-sm transition-all" title="More options">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 3. Accio Work Promo and Integrated Channels Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-6">
        
        {/* Left column: Accio Work Pitch */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#ff6600]">Alibaba.com</span>
            <div className="w-[1px] h-4 bg-slate-300"></div>
            <span className="text-xl font-black bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">Accio Work</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-tight">
            Go beyond search — let <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">Accio Work</span> handle your entire sourcing workflow.
          </h2>

          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            From design and sourcing to marketing and CRM: all your AI tools in one spot.
          </p>

          <div className="flex items-center gap-3">
            {["Self-Evolving", "Proactive", "24/7"].map((badge, idx) => (
              <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-semibold text-emerald-600">
                <Check size={12} className="stroke-[3]" />
                {badge}
              </span>
            ))}
          </div>

          <div className="pt-2">
            <button className="bg-slate-900 hover:bg-slate-800 active:scale-98 text-white px-5 py-3 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-slate-900/10 transition-all">
              <Download size={16} />
              Download for desktop
            </button>
          </div>
        </div>

        {/* Right column: Channels Grid */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.01)] p-6 sm:p-8 flex flex-col justify-between">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Workflow size={16} className="text-[#ff6600]" />
                Channels Integration
              </h3>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                5 connected
              </span>
            </div>
            <p className="text-slate-400 text-[12px] leading-relaxed">
              Configure messaging platforms where your AI agents will engage with users. All connection data is stored locally — no cloud required.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((chan, idx) => (
              <div 
                key={idx} 
                className="p-4 bg-slate-50/50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-2xl transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between gap-4 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 ${chan.bgColor} rounded-lg flex items-center justify-center font-bold text-sm ${chan.iconColor}`}>
                      {chan.name[0]}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{chan.name}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    chan.status.includes("unsupported") 
                      ? "bg-slate-100 text-slate-500" 
                      : "bg-emerald-50 text-emerald-600"
                  }`}>
                    {chan.status.split(" ")[0]}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Users</span>
                    <span className="font-bold text-slate-700">{chan.users}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Groups</span>
                    <span className={`font-bold ${chan.groups === "unsupported" ? "text-slate-400" : "text-slate-700"}`}>
                      {chan.groups}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Requests</span>
                    <span className="font-bold text-slate-700">{chan.requests}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button className="flex-1 text-[11px] font-semibold py-1 bg-white border border-slate-100 hover:bg-slate-50 rounded text-slate-600 transition-colors">
                    Settings
                  </button>
                  <button className="flex-1 text-[11px] font-semibold py-1 hover:bg-red-50 hover:text-red-600 border border-transparent rounded text-slate-400 transition-colors">
                    Disconnect
                  </button>
                </div>
              </div>
            ))}

            {/* Custom Add Channel Box */}
            <div className="p-4 border border-dashed border-slate-200 hover:border-[#ff6600]/40 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer group bg-slate-50/20 hover:bg-[#ff6600]/5 transition-all">
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#ff6600]/10 flex items-center justify-center text-slate-400 group-hover:text-[#ff6600] transition-colors">
                +
              </div>
              <span className="text-xs font-semibold text-slate-500 group-hover:text-[#ff6600] transition-colors">
                Add Channel
              </span>
            </div>
          </div>

          {/* Carousel Dot Indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-6 pt-2">
            <span className="w-4 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
          </div>
        </div>

      </div>

    </div>
  );
}
