"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  LayoutGrid,
  List,
  ShoppingCart,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  Tag,
} from "lucide-react";
import type { InlineProduct } from "@/types/sourcing";
import { cleanProductTitle } from "@/lib/product";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: InlineProduct[];
  searchQuery?: string;
  onBuyProduct?: (product: InlineProduct) => void;
  onToggleSelectProduct?: (product: InlineProduct) => void;
  selectedProductIds?: string[];
}

const ITEMS_PER_PAGE = 12;

function formatCurrency(price: number, currencyCode?: string): string {
  const code = currencyCode?.toUpperCase() || "LKR";
  if (code === "USD") {
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (code === "EUR") {
    return `€${price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (code === "GBP") {
    return `£${price.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (code === "AUD") {
    return `A$${price.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (code === "CAD") {
    return `C$${price.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `Rs. ${price.toLocaleString("en-LK")}`;
}

// ── Modal Product Card — Grid Mode ────────────────────────────────────────────

function ModalGridCard({
  product,
  isSelected,
  onToggle,
  onBuy,
}: {
  product: InlineProduct;
  isSelected: boolean;
  onToggle: () => void;
  onBuy: () => void;
}) {
  const displayName = cleanProductTitle(product.name || product.title);
  const displayPrice = product.price
    ? formatCurrency(product.price, product.currency)
    : product.priceDisplay || "N/A";
  const hasDiscount =
    product.originalPrice != null &&
    product.price != null &&
    product.originalPrice > product.price;
  const originalPriceDisplay = hasDiscount
    ? formatCurrency(product.originalPrice!, product.currency)
    : null;
  const outOfStock = product.inStock === false;

  return (
    <div
      className="group bg-white rounded-2xl overflow-hidden border transition-all duration-200 hover:shadow-xl flex flex-col cursor-pointer border-slate-100 hover:border-[#402970]/20 hover:shadow-[#402970]/5"
    >
      {/* Image */}
      <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={displayName}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
              outOfStock ? "opacity-40 grayscale" : ""
            }`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {product.image || "🛍️"}
          </div>
        )}

        {/* SME badge */}
        {product.isSME && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-0.5 px-2 py-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full shadow-md">
            🇱🇰 Local
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && !product.isSME && (
          <div className="absolute top-2.5 left-2.5 px-2 py-1 bg-[#402970] text-white text-[9px] font-bold rounded-full shadow-md">
            SALE
          </div>
        )}

        {/* Out of stock */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white bg-black/60 px-3 py-1.5 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Select overlay */}
        <div
          className={`absolute inset-0 flex items-end justify-center pb-3 transition-opacity duration-200 ${
            isSelected
              ? "opacity-100 bg-[#402970]/12"
              : "opacity-0 group-hover:opacity-100 bg-[#402970]/5"
          }`}
        >
          <button
            onClick={onToggle}
            className={`px-4 py-2 rounded-full text-[11px] font-bold shadow-lg cursor-pointer transition-all flex items-center gap-1.5 ${
              isSelected
                ? "bg-[#402970] text-white"
                : "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200"
            }`}
          >
            <Check size={11} className="stroke-[3.5]" />
            {isSelected ? "Selected" : "Select"}
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col flex-1">
        <h5 className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2 mb-2.5 flex-1">
          {displayName}
        </h5>

        <div className="space-y-2">
          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-[#402970]">{displayPrice}</span>
            {originalPriceDisplay && (
              <span className="text-[10px] text-slate-400 line-through">
                {originalPriceDisplay}
              </span>
            )}
          </div>

          {/* Stock + buy */}
          <div className="flex items-center justify-between">
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                !outOfStock
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  : "bg-red-50 text-red-500 border border-red-100"
              }`}
            >
              {!outOfStock ? "In Stock" : "Out of Stock"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Product Row — List Mode ─────────────────────────────────────────────

function ModalListRow({
  product,
  isSelected,
  onToggle,
  onBuy,
}: {
  product: InlineProduct;
  isSelected: boolean;
  onToggle: () => void;
  onBuy: () => void;
}) {
  const displayName = cleanProductTitle(product.name || product.title);
  const displayPrice = product.price
    ? formatCurrency(product.price, product.currency)
    : product.priceDisplay || "N/A";
  const hasDiscount =
    product.originalPrice != null &&
    product.price != null &&
    product.originalPrice > product.price;
  const originalPriceDisplay = hasDiscount
    ? formatCurrency(product.originalPrice!, product.currency)
    : null;
  const outOfStock = product.inStock === false;

  return (
    <div
      className="group flex gap-4 bg-white rounded-2xl border p-3.5 hover:shadow-lg transition-all duration-200 border-slate-100 hover:border-[#402970]/15"
    >
      {/* Thumbnail */}
      <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={displayName}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              outOfStock ? "opacity-50 grayscale" : ""
            }`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {product.image || "🛍️"}
          </div>
        )}
        {product.isSME && (
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-sm">
            🇱🇰
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white text-center px-1 leading-tight">
              Out of<br />Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h5 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 flex-1">
              {displayName}
            </h5>
            {/* Select toggle */}
            <button
              onClick={onToggle}
              className={`shrink-0 p-1.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#402970] text-white border-[#402970]"
                  : "border-slate-200 text-slate-400 hover:border-[#402970]/40 hover:text-[#402970]"
              }`}
            >
              <Check size={12} className="stroke-[3]" />
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-[#402970]">{displayPrice}</span>
            {originalPriceDisplay && (
              <span className="text-xs text-slate-400 line-through">{originalPriceDisplay}</span>
            )}
          </div>

          {product.category && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Tag size={10} />
              <span>{product.category}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            {product.isSME && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                🇱🇰 Local
              </span>
            )}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                !outOfStock
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-red-50 text-red-600 border border-red-100"
              }`}
            >
              {!outOfStock ? "In Stock" : "Out of Stock"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ProductCatalogModal ───────────────────────────────────────────────────

export default function ProductCatalogModal({
  isOpen,
  onClose,
  products,
  searchQuery = "Products",
  onBuyProduct,
  onToggleSelectProduct,
  selectedProductIds = [],
}: ProductCatalogModalProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const paginatedProducts = products.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setCurrentPage(1); // reset page on close
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Pagination helpers
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, "...", totalPages];
    if (currentPage >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, products.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-end sm:items-center justify-end sm:justify-center animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal panel — bottom sheet on mobile, centered on desktop */}
      <div className="relative w-full sm:max-w-5xl sm:mx-4 max-h-[92vh] sm:max-h-[88vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slideUp sm:animate-fadeInScale">

        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#402970]/8 flex items-center justify-center border border-[#402970]/15">
              <Search size={16} className="text-[#402970]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm leading-tight">
                Search Results
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                &ldquo;{searchQuery}&rdquo; &middot; {products.length} product{products.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Grid / List toggle */}
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-white text-[#402970] shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewMode === "list"
                    ? "bg-white text-[#402970] shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <List size={14} />
              </button>
            </div>

            <div className="w-px h-5 bg-slate-200" />

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Product grid/list area ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-none">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {paginatedProducts.map((prod) => (
                <ModalGridCard
                  key={prod.id}
                  product={prod}
                  isSelected={selectedProductIds.includes(prod.id)}
                  onToggle={() => onToggleSelectProduct?.(prod)}
                  onBuy={() => onBuyProduct?.(prod)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedProducts.map((prod) => (
                <ModalListRow
                  key={prod.id}
                  product={prod}
                  isSelected={selectedProductIds.includes(prod.id)}
                  onToggle={() => onToggleSelectProduct?.(prod)}
                  onBuy={() => onBuyProduct?.(prod)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {products.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Search size={32} className="mb-3 opacity-40" />
              <p className="text-sm font-semibold">No products found</p>
            </div>
          )}
        </div>

        {/* ── Pagination footer ── */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-sm">
            {/* Count */}
            <p className="text-[11px] text-slate-400 font-semibold hidden sm:block">
              Showing {startItem}–{endItem} of {products.length} products
            </p>
            <p className="text-[11px] text-slate-400 font-semibold sm:hidden">
              {startItem}–{endItem} / {products.length}
            </p>

            {/* Page buttons */}
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronLeft size={15} />
              </button>

              {/* Page numbers */}
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-[11px] text-slate-400">
                    &hellip;
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(Number(page))}
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      currentPage === page
                        ? "bg-[#402970] text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              {/* Next */}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
