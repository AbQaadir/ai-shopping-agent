"use client";

import React, { useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, Sparkles, Check, Clock, User } from "lucide-react";

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

interface ChatTimelineProps {
  messages: Message[];
  isGenerating: boolean;
}

export default function ChatTimeline({ messages, isGenerating }: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Format timestamp helper
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 flex flex-col">
      {messages.map((msg) => {
        const isUser = msg.sender === "user";
        return (
          <div 
            key={msg.id}
            className={`flex gap-3 max-w-[85%] ${isUser ? "self-end flex-row-reverse" : "self-start"}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
              isUser 
                ? "bg-slate-200 text-slate-700" 
                : "bg-gradient-to-tr from-orange-400 to-[#ff6600] text-white shadow-sm"
            }`}>
              {isUser ? <User size={15} /> : <Sparkles size={15} />}
            </div>

            {/* Message Bubble */}
            <div className="flex flex-col gap-1">
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                isUser 
                  ? "bg-[#ff6600] text-white rounded-tr-none shadow-sm" 
                  : "bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-[0_2px_10px_rgba(0,0,0,0.01)]"
              }`}>
                {/* Text Content */}
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Attachments inside bubble */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100/10 pt-2.5">
                    {msg.attachments.map((file, fIdx) => (
                      <div 
                        key={fIdx} 
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                          isUser ? "bg-white/10 text-white" : "bg-slate-50 text-slate-600 border border-slate-100"
                        }`}
                      >
                        {file.type.startsWith("image/") ? (
                          <ImageIcon size={14} className={isUser ? "text-white/80" : "text-slate-500"} />
                        ) : (
                          <FileText size={14} className={isUser ? "text-white/80" : "text-slate-500"} />
                        )}
                        <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                        <span className={`text-[10px] ${isUser ? "text-white/60" : "text-slate-400"}`}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timestamp and status indicator */}
              <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isUser ? "justify-end" : "justify-start"}`}>
                <span>{formatTime(msg.timestamp)}</span>
                {isUser && (
                  <span>
                    {msg.status === "sending" && <Clock size={10} className="animate-spin text-[#ff6600]" />}
                    {msg.status === "analyzing" && <Sparkles size={10} className="animate-pulse text-[#ff6600]" />}
                    {msg.status === "sent" && <Check size={10} className="text-emerald-500 stroke-[3]" />}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing indicator */}
      {isGenerating && (
        <div className="flex gap-3 self-start max-w-[85%] animate-pulse">
          <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-tr from-orange-400 to-[#ff6600] text-white">
            <Sparkles size={15} className="animate-spin" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="px-4 py-3 bg-white text-slate-500 border border-slate-100 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-xs ml-1 font-medium">Sourcing products and manufacturers...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
