import React, { useState } from "react";
import { Copy, CheckCircle2, X } from "lucide-react";

interface ShareChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  chatTitle: string;
}

export default function ShareChatModal({ isOpen, onClose, url, chatTitle }: ShareChatModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      {/* Click outside to close */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp border border-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Share Chat</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors outline-none cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          <p className="text-sm text-slate-600">
            Anyone with this link will be able to view your conversation history and the products you've sourced, but they cannot send new messages.
          </p>

          {/* OG Preview Card */}
          <div className="w-full border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-50 flex flex-col">
            <div className="h-32 w-full bg-slate-200 overflow-hidden relative flex items-center justify-center">
              {/* Optional nice gradient instead of image if no image available */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#402970]/80 to-[#6a42c0] flex items-center justify-center">
                <img src="/kapruka-logo.jpg" alt="Logo" className="h-10 opacity-90 rounded bg-white p-1" />
              </div>
            </div>
            <div className="p-3.5 bg-white border-t border-slate-200">
              <h4 className="text-[13px] font-bold text-slate-800 truncate mb-1">
                {chatTitle || "Sourcing Chat"} | Kapruka AI
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                View this shared Kapruka AI sourcing chat. Discover matched products and automated sourcing results instantly.
              </p>
              <div className="mt-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                kapuruka-ai-shopping-agent.vercel.app
              </div>
            </div>
          </div>

          {/* URL Input Row */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap select-all font-mono">
              {url}
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 shadow-sm shrink-0 cursor-pointer ${
                copied
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent"
                  : "bg-[#402970] hover:bg-[#33205a] text-white border-transparent"
              }`}
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
