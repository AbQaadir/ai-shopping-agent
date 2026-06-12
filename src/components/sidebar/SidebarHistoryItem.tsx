"use client";

interface SidebarHistoryItemProps {
  id: string;
  query: string;
  isActive: boolean;
  onClick: () => void;
  showStatusDot?: boolean;
}

export default function SidebarHistoryItem({
  query,
  isActive,
  onClick,
  showStatusDot = false
}: SidebarHistoryItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3.5 py-3 rounded-xl text-xs transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer border-none outline-none focus:outline-none focus:ring-0 ${
        isActive 
          ? "bg-slate-100 text-slate-850 font-semibold" 
          : "text-slate-400 hover:bg-slate-100/50 hover:text-slate-700 font-medium"
      }`}
      title={query}
    >
      <span className="truncate">{query}</span>
      {showStatusDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
      )}
    </button>
  );
}
