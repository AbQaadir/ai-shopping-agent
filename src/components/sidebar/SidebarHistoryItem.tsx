"use client";

interface SidebarHistoryItemProps {
  id: string;
  query: string;
  isActive: boolean;
  onClick: () => void;
}

export default function SidebarHistoryItem({
  query,
  isActive,
  onClick
}: SidebarHistoryItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-xl text-xs transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer border-none outline-none focus:outline-none focus:ring-0 ${
        isActive 
          ? "bg-slate-100 text-slate-900 font-semibold" 
          : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 font-medium"
      }`}
      title={query}
    >
      <span className="truncate">{query}</span>
      <span className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 font-bold select-none">→</span>
    </button>
  );
}
