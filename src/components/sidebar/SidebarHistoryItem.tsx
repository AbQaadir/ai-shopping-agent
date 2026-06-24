"use client";

import React from "react";
import { Trash2 } from "lucide-react";

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
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chat?")) {
      onDelete();
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer border-none outline-none focus:outline-none focus:ring-0 ${
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
        className="text-slate-400 hover:text-red-500 hover:bg-red-50/80 p-1 rounded-lg transition-all shrink-0 cursor-pointer flex items-center justify-center"
      >
        <Trash2 size={13} />
      </span>
    </button>
  );
}
