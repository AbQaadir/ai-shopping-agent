"use client";

import React, { useState } from "react";
import { LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import type { InlineProduct } from "@/types/sourcing";

interface ProductGridProps {
  products: InlineProduct[];
  header?: string;
  selectedIds: string[];
  onToggle?: (product: InlineProduct) => void;
  onBuy?: (product: InlineProduct) => void;
}

const ITEMS_PER_PAGE = 12;

export default function ProductGrid({
  products,
  header,
  selectedIds,
  onToggle,
  onBuy,
}: ProductGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const paginatedProducts = products.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 select-none transition-all duration-300">
          {paginatedProducts.map((prod) => (
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
        <div className="space-y-2 select-none transition-all duration-300">
          {paginatedProducts.map((prod) => (
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

      {/* ── Pagination footer ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100/60 pt-3 mt-4 shrink-0 animate-fadeIn">
          <p className="text-[10px] text-slate-400 font-semibold select-none">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, products.length)} of {products.length} products
          </p>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  currentPage === page
                    ? "bg-[#402970] text-white shadow-xs"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
