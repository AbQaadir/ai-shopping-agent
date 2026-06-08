"use client";

import React, { useState } from "react";
import { LayoutGrid, List, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import type { InlineProduct } from "@/types/sourcing";

interface ProductGridProps {
  products: InlineProduct[];
  header?: string;
  onViewMore?: () => void;
  selectedIds: string[];
  onToggle?: (product: InlineProduct) => void;
  onBuy?: (product: InlineProduct) => void;
}

export default function ProductGrid({
  products,
  header,
  onViewMore,
  selectedIds,
  onToggle,
  onBuy,
}: ProductGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="space-y-3 pt-2">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-extrabold text-slate-800 text-sm">
            {header || "Kapruka Products"}
          </h4>
          <span className="px-2 py-0.5 bg-[#402970]/8 text-[#402970] text-[10px] font-bold rounded-full border border-[#402970]/15">
            {products.length} results
          </span>
        </div>

        {/* Grid / List toggle */}
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            title="Grid view"
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "grid"
                ? "bg-white text-[#402970] shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            title="List view"
            className={`p-1.5 rounded-md transition-all ${
              viewMode === "list"
                ? "bg-white text-[#402970] shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <List size={13} />
          </button>
        </div>
      </div>

      {/* ── Product display ── */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 select-none">
          {products.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              viewMode="grid"
              isSelected={selectedIds.includes(prod.id)}
              onToggle={() => onToggle?.(prod)}
              onBuy={() => onBuy?.(prod)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2 select-none">
          {products.map((prod) => (
            <ProductCard
              key={prod.id}
              product={prod}
              viewMode="list"
              isSelected={selectedIds.includes(prod.id)}
              onToggle={() => onToggle?.(prod)}
              onBuy={() => onBuy?.(prod)}
            />
          ))}
        </div>
      )}

      {/* ── View more products button ── */}
      {onViewMore && (
        <div className="flex justify-center pt-1">
          <button
            onClick={onViewMore}
            className="group flex items-center gap-2 px-6 py-2.5 border border-[#402970] text-[#402970] hover:bg-[#402970] hover:text-white text-xs font-bold rounded-full transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
          >
            View more products
            <ChevronRight
              size={13}
              strokeWidth={2.5}
              className="group-hover:translate-x-0.5 transition-transform duration-200"
            />
          </button>
        </div>
      )}
    </div>
  );
}
