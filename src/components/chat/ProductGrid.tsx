"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import type { InlineProduct } from "@/types/sourcing";

interface ProductGridProps {
  products: InlineProduct[];
  selectedIds: string[];
  onToggle?: (product: InlineProduct) => void;
  onBuy?: (product: InlineProduct) => void;
  sortOrder?: "default" | "lowToHigh" | "highToLow";
  viewMode?: "grid" | "list";
}

const ITEMS_PER_PAGE = 12;

export default function ProductGrid({
  products,
  selectedIds,
  onToggle,
  onBuy,
  sortOrder = "default",
  viewMode = "grid",
}: ProductGridProps) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortOrder]);

  const sortedProducts = React.useMemo(() => {
    const sorted = [...products];
    if (sortOrder === "lowToHigh") {
      sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sortOrder === "highToLow") {
      sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
    return sorted;
  }, [products, sortOrder]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-3 pt-2">

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
