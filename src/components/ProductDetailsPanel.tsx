"use client";

import React, { useState } from "react";
import { 
  X, 
  LayoutGrid, 
  List, 
  Star, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  ShieldCheck, 
  Box
} from "lucide-react";

interface ProductDetailsPanelProps {
  onClose: () => void;
  products?: ProductDetail[];
}

export interface ProductDetail {
  id: string;
  title: string;
  price: string;
  moq: string;
  supplier: string;
  location: string;
  years: number;
  rating?: number;
  reviews?: number;
  verified: boolean;
  image: string; // Emoji representing the chair or placeholder
  bgColor: string; // Background color for mock image
  requirements?: string[];
}

export default function ProductDetailsPanel({ onClose, products: propProducts }: ProductDetailsPanelProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activePage, setActivePage] = useState(1);

  // Mocked products matching Kapuruka AI search output for camping chairs under $15
  const staticProducts: ProductDetail[] = [
    {
      id: "dp1",
      title: "Folding Moon Chair Portable Breathable Mesh Backrest Seat for Outdoor Camping",
      price: "$3.40 - $3.60",
      moq: "12 bags",
      supplier: "Beijing Liyi Technology Co., Ltd.",
      location: "CN",
      years: 1,
      rating: 4.8,
      reviews: 30,
      verified: false,
      image: "🏕️",
      bgColor: "bg-amber-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp2",
      title: "360° Swivel Folding Camping Chair 3-Legged Portable Stool for Hiking Fishing",
      price: "$5.50",
      moq: "20 pieces",
      supplier: "Henan Haiku Outdoor Products Co., Ltd.",
      location: "CN",
      years: 1,
      rating: 4.5,
      reviews: 218,
      verified: false,
      image: "🔄",
      bgColor: "bg-emerald-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp3",
      title: "Lightweight Outdoor Beach Oxford Chair for Picnic & Travel",
      price: "$2.29 - $2.86",
      moq: "6 pieces",
      supplier: "YIWU FULLYUAN DAILY SUPPLIES CO.",
      location: "CN",
      years: 1,
      rating: 4.7,
      reviews: 300,
      verified: false,
      image: "🏖️",
      bgColor: "bg-sky-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp4",
      title: "Outdoor Folding High-Back Camping Chair Portable Armchair with Cup Holder",
      price: "$3.20",
      moq: "50 pieces",
      supplier: "Langfang Jinzhao Stationery Co., Ltd.",
      location: "CN",
      years: 5,
      rating: 4.6,
      reviews: 50,
      verified: false,
      image: "🥤",
      bgColor: "bg-blue-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp5",
      title: "Wholesale Lightweight Portable Outdoor Hiking Picnic Chair",
      price: "$3.20 - $4.00",
      moq: "50 pieces",
      supplier: "CIXI RUNFENG COMMODITY CO.",
      location: "CN",
      years: 10,
      rating: 4.9,
      reviews: 754,
      verified: true,
      image: "🎒",
      bgColor: "bg-indigo-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp6",
      title: "Outdoor Folding Arc Moon Chair Portable Lightweight Oxford Cloth Bench",
      price: "$1.81 - $2.94",
      moq: "1 piece",
      supplier: "Wuhan Pioneersky Cultural Co., Ltd.",
      location: "CN",
      years: 1,
      rating: 4.4,
      reviews: 12,
      verified: false,
      image: "🌙",
      bgColor: "bg-violet-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp7",
      title: "Portable Folding Tripod Chair Ultralight Stool with Carry Bag",
      price: "$1.50 - $2.10",
      moq: "100 pieces",
      supplier: "Ningbo Outdo Hiking Gear Co., Ltd.",
      location: "CN",
      years: 2,
      rating: 4.3,
      reviews: 45,
      verified: true,
      image: "🏕️",
      bgColor: "bg-green-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp8",
      title: "Heavy Duty Camping Quad Chair with Cool Bag & Side Table",
      price: "$8.50 - $9.90",
      moq: "10 pieces",
      supplier: "Hangzhou Joy Outdoor Co., Ltd.",
      location: "CN",
      years: 4,
      rating: 4.6,
      reviews: 88,
      verified: false,
      image: "🧊",
      bgColor: "bg-teal-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp9",
      title: "Reclining Outdoor Camp Chair with Adjustable Footrest & Headrest",
      price: "$12.40 - $14.50",
      moq: "5 pieces",
      supplier: "Shaoxing Leisure Products Factory",
      location: "CN",
      years: 3,
      rating: 4.9,
      reviews: 110,
      verified: true,
      image: "🛌",
      bgColor: "bg-[#402970]/10",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp10",
      title: "Compact Backpacking Chair High Back Foldable Camping Stool",
      price: "$6.80 - $7.50",
      moq: "30 pieces",
      supplier: "Tianjin Sports Gear Co., Ltd.",
      location: "CN",
      years: 1,
      rating: 4.4,
      reviews: 62,
      verified: false,
      image: "🎒",
      bgColor: "bg-slate-200",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp11",
      title: "Kids Miniature Folding Camp Chair with Safety Lock Mechanisms",
      price: "$2.99 - $3.50",
      moq: "50 pieces",
      supplier: "Yiwu Children Goods Import & Export",
      location: "CN",
      years: 8,
      rating: 4.8,
      reviews: 190,
      verified: true,
      image: "🧒",
      bgColor: "bg-pink-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    },
    {
      id: "dp12",
      title: "Directors Folding Chair with Side Table & Accessory Pockets",
      price: "$11.20 - $13.80",
      moq: "10 pieces",
      supplier: "Foshan Goldway Furniture Co., Ltd.",
      location: "CN",
      years: 6,
      rating: 4.7,
      reviews: 140,
      verified: false,
      image: "🎬",
      bgColor: "bg-rose-100",
      requirements: ["camping chair", "foldable", "price < 15 USD"]
    }
  ];

  const products = propProducts && propProducts.length > 0 ? propProducts : staticProducts;

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden animate-fadeIn relative">
      
      {/* Header Panel */}
      <div className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#402970]/5 border border-[#402970]/15 flex items-center justify-center text-[#402970]">
            <Box size={16} />
          </div>
          <span className="font-bold text-slate-800 text-sm">Product search</span>
        </div>
 
        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Grid/List togglers */}
          <div className="flex bg-slate-50 border border-slate-100 rounded-lg p-0.5">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
 
          <div className="w-[1px] h-6 bg-slate-200"></div>
 
          {/* Close Panel */}
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            title="Close details"
          >
            <X size={18} />
          </button>
        </div>
      </div>
 
      {/* Scrollable Products List Container */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-32 bg-white">
        
        {viewMode === "grid" ? (
          /* GRID VIEW LAYOUT (responsive columns) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((prod) => (
              <div 
                key={prod.id} 
                className="bg-white rounded-xl p-2.5 flex flex-col justify-between hover:shadow-md transition-all duration-200 relative border border-slate-100/60 group"
              >
                <div>
                  {/* Image Block */}
                  <div className={`w-full aspect-[4/3] ${prod.bgColor} rounded-xl flex items-center justify-center text-4xl mb-4 group-hover:scale-[1.01] transition-transform select-none relative`}>
                    <span>{prod.image}</span>
                    {prod.verified && (
                      <div className="absolute top-2 left-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5 shadow-sm">
                        <ShieldCheck size={10} />
                        Verified
                      </div>
                    )}
                  </div>
 
                  {/* Removed Requirements Status Pill */}
 
                  {/* Product Title */}
                  <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 hover:text-[#402970] cursor-pointer mb-2">
                    {prod.title}
                  </h4>
 
                  {/* Price & MOQ */}
                  <div className="flex flex-col gap-0.5 mb-2.5">
                    <span className="text-sm font-extrabold text-slate-800">{prod.price}</span>
                    <span className="text-[11px] text-slate-400 font-semibold">Min. order: {prod.moq}</span>
                  </div>
                </div>
 
                {/* Supplier Detail Rows */}
                <div className="pt-2 border-t border-slate-50 text-[11px]">
                  <div className="text-slate-500 truncate font-semibold mb-1" title={prod.supplier}>
                    {prod.supplier}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-bold">{prod.location}</span>
                    <span>•</span>
                    <span>{prod.years} yr{prod.years > 1 ? "s" : ""}</span>
                    {prod.rating && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-0.5">
                           <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span className="font-bold text-slate-600">{prod.rating}</span>
                          <span className="text-slate-400">({prod.reviews})</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW LAYOUT (horizontal full-width rows) */
          <div className="space-y-4">
            {products.map((prod) => (
              <div 
                key={prod.id} 
                className="bg-white rounded-xl p-3 flex flex-col sm:flex-row gap-3 sm:gap-4 hover:shadow-md border border-slate-100/60 transition-all duration-200 relative group"
              >
                {/* Image Frame */}
                <div className={`w-full sm:w-28 h-40 sm:h-24 ${prod.bgColor} rounded-xl shrink-0 flex items-center justify-center text-4xl sm:text-3xl group-hover:scale-[1.01] transition-transform select-none relative`}>
                  <span>{prod.image}</span>
                  {prod.verified && (
                    <div className="absolute bottom-1 left-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded px-1.5 py-0.2 text-[8px] font-bold flex items-center gap-0.5">
                      <ShieldCheck size={9} />
                      Verified
                    </div>
                  )}
                </div>
 
                {/* Content Block */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-4">
                      
                      {/* Removed Requirements Badge */}
 
                      <span className="text-xs font-extrabold text-[#402970] whitespace-nowrap">{prod.price}</span>
                    </div>
 
                    <h4 className="text-xs font-bold text-slate-800 leading-snug truncate hover:text-[#402970] cursor-pointer">
                      {prod.title}
                    </h4>
 
                    <p className="text-[11px] text-slate-400 font-semibold">Min. order: {prod.moq}</p>
                  </div>
 
                  <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-50 text-[10px]">
                    <div className="text-slate-500 font-semibold truncate max-w-[200px] sm:max-w-[250px]">
                      {prod.supplier}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="font-bold">{prod.location}</span>
                      <span>•</span>
                      <span>{prod.years} yr{prod.years > 1 ? "s" : ""}</span>
                      {prod.rating && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-0.5">
                            <Star size={9} className="fill-amber-400 text-amber-400" />
                            <span className="font-bold text-slate-600">{prod.rating}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
 
              </div>
            ))}
          </div>
        )}

        {/* Pagination & Footer controls */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500 shrink-0 select-none">
          {/* Pages count */}
          <div className="flex items-center gap-2">
            <button 
              disabled={activePage === 1}
              onClick={() => setActivePage(1)}
              className="p-1 hover:bg-white border border-transparent hover:border-slate-200 rounded disabled:opacity-30 disabled:hover:border-transparent transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setActivePage(1)}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                activePage === 1 
                  ? "bg-slate-800 text-white border-slate-800" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              1
            </button>
            <button 
              onClick={() => setActivePage(2)}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                activePage === 2 
                  ? "bg-slate-800 text-white border-slate-800" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              2
            </button>
            <span className="text-slate-400 px-1">...</span>
            <button 
              onClick={() => setActivePage(2)}
              className="p-1 hover:bg-white border border-transparent hover:border-slate-200 rounded transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Report an issue */}
          <button className="text-slate-400 hover:text-slate-600 flex items-center gap-1 hover:underline transition-all">
            <AlertTriangle size={13} />
            Report an issue
          </button>
        </div>

      </div>
    </div>
  );
}
