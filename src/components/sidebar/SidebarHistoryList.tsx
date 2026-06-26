"use client";

import SidebarHistoryItem from "./SidebarHistoryItem";

interface SidebarHistoryListProps {
  history: Array<{ id: string; query: string; date: string }>;
  activeHistoryId?: string;
  onSelectHistory: (id: string) => void;
  onDeleteHistory: (id: string) => void;
}

export default function SidebarHistoryList({
  history,
  activeHistoryId,
  onSelectHistory,
  onDeleteHistory,
}: SidebarHistoryListProps) {
  return (
    <div className="px-0 py-0 space-y-0.5 w-full flex flex-col items-start animate-fadeIn">
      {history.map((item, idx) => (
        <SidebarHistoryItem
          key={item.id}
          id={item.id}
          query={item.query}
          isActive={activeHistoryId === item.id}
          onClick={() => onSelectHistory(item.id)}
          onDelete={() => onDeleteHistory(item.id)}
        />
      ))}
    </div>
  );
}
