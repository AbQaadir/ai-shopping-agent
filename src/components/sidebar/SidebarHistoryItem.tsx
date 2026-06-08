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
      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer ${
        isActive 
          ? "bg-[#402970]/5 text-[#402970] font-semibold border-l-2 border-[#402970]" 
          : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800"
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
