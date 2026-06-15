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
    <div className="pl-7 pr-1 py-1 space-y-1 w-full flex flex-col items-start animate-fadeIn">
      {history.map((item, idx) => (
        <SidebarHistoryItem
          key={item.id}
          id={item.id}
          query={item.query}
          isActive={activeHistoryId === item.id}
          onClick={() => onSelectHistory(item.id)}
        />
      ))}
    </div>
  );
}
