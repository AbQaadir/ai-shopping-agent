"use client";

import SidebarHistoryItem from "./SidebarHistoryItem";

interface SidebarHistoryListProps {
  history: Array<{ id: string; query: string; date: string }>;
  activeHistoryId?: string;
  onSelectHistory: (id: string) => void;
}

export default function SidebarHistoryList({
  history,
  activeHistoryId,
  onSelectHistory
}: SidebarHistoryListProps) {
  return (
    <div className="pl-4 pr-1 py-1 space-y-1 max-h-[400px] overflow-y-auto scrollbar-none animate-fadeIn border-l border-slate-100/80 ml-5">
      {history.map((item, idx) => (
        <SidebarHistoryItem
          key={item.id}
          id={item.id}
          query={item.query}
          isActive={activeHistoryId === item.id}
          onClick={() => onSelectHistory(item.id)}
          showStatusDot={idx % 2 === 0}
        />
      ))}
    </div>
  );
}
