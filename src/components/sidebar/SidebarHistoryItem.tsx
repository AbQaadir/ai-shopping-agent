"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, AlertTriangle } from "lucide-react";

interface SidebarHistoryItemProps {
  id: string;
  query: string;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export default function SidebarHistoryItem({
  query,
  isActive,
  onClick,
  onDelete,
}: SidebarHistoryItemProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  return (
    <>
      <button
        onClick={onClick}
        className={`group w-full text-left px-3 py-1.5 rounded-xl text-xs transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer border-none outline-none focus:outline-none focus:ring-0 ${
          isActive 
            ? "bg-slate-100 text-slate-900 font-semibold" 
            : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 font-medium"
        }`}
        title={query}
      >
        <span className="truncate flex-1">{query}</span>
        <span
          onClick={handleDelete}
          title="Delete chat"
          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50/80 p-1 rounded-lg transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center"
        >
          <Trash2 size={13} />
        </span>
      </button>

      {showConfirm && typeof document !== "undefined" && createPortal(
        <div 
          className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-[#402970]/10 text-[#402970] rounded-xl">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete chat?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 pl-1">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                  onDelete();
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#402970] hover:bg-[#301e56] transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
