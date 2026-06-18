"use client";

import React from "react";
import { ShoppingCart, Check } from "lucide-react";
import type { InlineProduct } from "@/types/sourcing";

import { cleanProductTitle } from "@/lib/product";

interface ProductCardProps {
  product: InlineProduct;
  isSelected: boolean;
  onToggle: () => void;
  onBuy: () => void;
  viewMode?: "grid" | "list";
}

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

export default function ProductCard({
  product,
  isSelected,
  onToggle,
  onBuy,
  viewMode = "grid",
}: ProductCardProps) {
  const rawName = product.name || product.title || "Product";
  const displayName = cleanProductTitle(rawName);
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

  /* ── LIST ROW ─────────────────────────────────────────────────────── */
  if (viewMode === "list") {
    return (
      <div
        className="group flex gap-3 bg-white rounded-xl border p-3 hover:shadow-md transition-all duration-200 border-slate-100 hover:border-slate-200"
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-slate-50">
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
            <div className="w-full h-full flex items-center justify-center text-2xl bg-gradient-to-br from-slate-50 to-slate-100">
              {product.image || "🛍️"}
            </div>
          )}
          {/* SME micro-badge */}
          {product.isSME && (
            <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-emerald-500 text-white text-[7px] font-bold rounded-sm">
              🇱🇰
            </div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="space-y-1">
            <h5 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
              {product.url ? (
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#402970] hover:underline transition-colors duration-150 cursor-pointer"
                >
                  {displayName}
                </a>
              ) : (
                displayName
              )}
            </h5>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-extrabold text-[#402970]">{displayPrice}</span>
              {originalPriceDisplay && (
                <span className="text-[10px] text-slate-400 line-through">{originalPriceDisplay}</span>
              )}
            </div>
            {product.category && (
              <p className="text-[10px] text-slate-400 font-medium">{product.category}</p>
            )}
          </div>
          <div className="flex items-center justify-between pt-1.5">
            <div className="flex items-center gap-1.5">
              {product.isSME && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  🇱🇰 Local
                </span>
              )}
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  !outOfStock
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
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

  /* ── GRID CARD ────────────────────────────────────────────────────── */
  return (
    <div
      className="group bg-white rounded-xl overflow-hidden border transition-all duration-200 hover:shadow-lg flex flex-col border-slate-100 hover:border-slate-200"
    >
      {/* Image */}
      <div className="relative aspect-square bg-slate-50 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={displayName}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
              outOfStock ? "opacity-50 grayscale" : ""
            }`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-slate-50 to-slate-100">
            {product.image || "🛍️"}
          </div>
        )}

        {/* SME badge — top left */}
        {product.isSME && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full shadow-sm">
            🇱🇰 Local
          </div>
        )}

        {/* Discount badge — top right */}
        {hasDiscount && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-[#402970] text-white text-[8px] font-bold rounded-full shadow-sm">
            SALE
          </div>
        )}

        {/* Out of stock overlay */}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white bg-black/60 px-2 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Hover select overlay */}
        <div
          className={`absolute inset-0 flex items-end justify-center pb-2.5 transition-opacity duration-200 ${
            isSelected
              ? "opacity-100 bg-[#402970]/10"
              : "opacity-0 group-hover:opacity-100 bg-[#402970]/5"
          }`}
        >
          <button
            onClick={onToggle}
            className={`px-4 py-2 rounded-full text-[11px] font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5 ${
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
      <div className="p-2.5 flex flex-col flex-1">
        <h5 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 mb-2 flex-1">
          {product.url ? (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#402970] hover:underline transition-colors duration-150 cursor-pointer"
            >
              {displayName}
            </a>
          ) : (
            displayName
          )}
        </h5>

        <div className="space-y-1.5">
          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-[#402970]">{displayPrice}</span>
            {originalPriceDisplay && (
              <span className="text-[10px] text-slate-400 line-through">{originalPriceDisplay}</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                !outOfStock ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
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
