"use client";

import React, { useState, useRef } from "react";
import { 
  Paperclip, 
  ArrowUp, 
  ChevronLeft, 
  X
} from "lucide-react";
import ChatTimeline from "./ChatTimeline";
import ProductSplitPanel from "./ProductSplitPanel";

interface FileAttachment {
  name: string;
  size: number;
  type: string;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  status?: "sending" | "sent" | "analyzing";
}

interface ChatViewProps {
  messages: Message[];
  isGenerating: boolean;
  onSend: (text: string, files: File[]) => void;
  onBackToLanding: () => void;
  queryType: "design" | "manufacturer" | "bestseller" | "product" | "general";
  activeQueryText: string;
}

export default function ChatView({
  messages,
  isGenerating,
  onSend,
  onBackToLanding,
  queryType,
  activeQueryText
}: ChatViewProps) {
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

  return (
    <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-64px)]">
      
      {/* LEFT COLUMN: CHAT WORKSPACE (col-span-7) */}
      <div className="lg:col-span-7 flex flex-col h-full bg-slate-50/50">
        
        {/* Chat header (Compact status bar) */}
        <div className="h-14 bg-white border-b border-slate-100 flex items-center px-4 justify-between shrink-0">
          <button 
            onClick={onBackToLanding}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Home
          </button>
          
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-slate-600">Sourcing Agent Connected</span>
          </div>
        </div>

        {/* Chat Timeline (Scrolls messages) */}
        <ChatTimeline messages={messages} isGenerating={isGenerating} />

        {/* Message Input Bar Container */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <div className="max-w-3xl mx-auto w-full relative">
            <div className="w-full bg-slate-50 rounded-2xl border border-slate-200 p-3 flex flex-col gap-2 relative">
              
              {/* Text Area */}
              <textarea
                value={inputText}
                onChange={handleTextChange}
                onKeyDown={handleKeyPress}
                placeholder="Ask follow-up questions or update requirements..."
                rows={2}
                className="w-full resize-none border-none outline-none text-slate-700 placeholder-slate-400 bg-transparent text-sm px-1 leading-relaxed min-h-[48px]"
              />

              {/* Uploaded Files Previews */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100/50">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 animate-fadeIn">
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <button 
                        onClick={() => removeFile(idx)}
                        className="p-0.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Controls Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100/40">
                <button
                  onClick={handlePaperclipClick}
                  className="p-2 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-all"
                  title="Attach blueprints/spec sheets"
                >
                  <Paperclip size={16} />
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
                  className={`p-2 rounded-full flex items-center justify-center transition-all ${
                    inputText.trim() || attachedFiles.length > 0
                      ? "bg-[#ff6600] hover:bg-[#e05900] text-white shadow-sm"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: PRODUCT SPLIT PANEL (col-span-5) */}
      <div className="lg:col-span-5 h-full overflow-hidden">
        <ProductSplitPanel key={queryType} queryType={queryType} queryText={activeQueryText} />
      </div>

    </div>
  );
}
