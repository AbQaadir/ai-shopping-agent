"use client";

import React, { useRef, useState } from "react";
import { 
  Paperclip, 
  ArrowUp, 
  ChevronRight, 
  X
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



  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-10 flex flex-col justify-center gap-12 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-[#402970]/10 to-purple-500/10 rounded-full blur-[100px] pointer-events-none -z-10"></div>
      
      {/* 1. Central Hero Sourcing Box */}
      <div className="flex flex-col items-center mt-6 text-center max-w-4xl mx-auto w-full">
        <h1 className="text-[32px] sm:text-4xl lg:text-[40px] font-extrabold text-[#402970] tracking-tight mb-8 leading-tight">
          All tasks in one ask, smart sourcing with AI
        </h1>
        
        {/* Glow-framed Prompt Card */}
        <div className="w-full relative group">
          {/* Subtle gradient backdrop shadow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#402970] to-purple-500 rounded-[28px] opacity-[0.08] group-hover:opacity-[0.15] blur-md transition-opacity duration-300 pointer-events-none"></div>
          
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
                    ? "bg-[#402970] hover:bg-[#33205a] text-white shadow-md shadow-purple-500/20 active:scale-95"
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

    </div>
  );
}
