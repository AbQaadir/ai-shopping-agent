"use client";

import React, { useState } from "react";
import { 
  Building2, 
  MapPin, 
  ShieldCheck, 
  TrendingUp, 
  Send, 
  Check, 
  Image as ImageIcon,
  Package,
  FileText
} from "lucide-react";

interface Product {
  id: string;
  title: string;
  price: string;
  moq: string;
  supplier: string;
  rating: number;
  image: string;
  tags: string[];
}

interface Supplier {
  id: string;
  name: string;
  location: string;
  verified: boolean;
  yearFounded: number;
  employees: string;
  mainProducts: string[];
  capacity: string;
}

interface ProductSplitPanelProps {
  queryType: "design" | "manufacturer" | "bestseller" | "product" | "general";
  queryText: string;
}

const getDefaultTab = (type: string): "products" | "suppliers" | "analytics" | "rfq" => {
  if (type === "bestseller") return "analytics";
  if (type === "manufacturer") return "suppliers";
  return "products";
};

export default function ProductSplitPanel({ queryType, queryText }: ProductSplitPanelProps) {
  const [activeTab, setActiveTab] = useState<"products" | "suppliers" | "analytics" | "rfq">(() =>
    getDefaultTab(queryType)
  );
  const [rfqSubmitted, setRfqSubmitted] = useState(false);
  const [rfqQty, setRfqQty] = useState("1000");
  const [rfqNotes, setRfqNotes] = useState("");

  // Mock Products
  const mockProducts: Product[] = [
    {
      id: "p1",
      title: "Ergonomic Mesh Office Chair with Lumbar Support & Dynamic Armrests",
      price: "$24.50 - $28.00",
      moq: "100 pieces",
      supplier: "Foshan Comfort Furniture Co., Ltd.",
      rating: 4.8,
      image: "🛋️",
      tags: ["Ergonomic", "BIFMA Certified", "High Density Foam"]
    },
    {
      id: "p2",
      title: "Premium Executive Leather Chair with Adjustable Height & Tilt",
      price: "$45.00 - $52.00",
      moq: "50 pieces",
      supplier: "Anji Wanxiang Furniture Factory",
      rating: 4.9,
      image: "💺",
      tags: ["Genuine Leather", "Tilt Tension", "Aluminium Base"]
    },
    {
      id: "p3",
      title: "Minimalist Task Chair for Home Office & Co-working Spaces",
      price: "$15.80 - $18.50",
      moq: "200 pieces",
      supplier: "Guangzhou Smart Space Equipment Co.",
      rating: 4.7,
      image: "🪑",
      tags: ["Space Saving", "Breathable Mesh", "Eco-friendly"]
    }
  ];

  // Mock Suppliers
  const mockSuppliers: Supplier[] = [
    {
      id: "s1",
      name: "Foshan Comfort Furniture Co., Ltd.",
      location: "Guangdong, China",
      verified: true,
      yearFounded: 2012,
      employees: "200 - 300 people",
      mainProducts: ["Office chairs", "Gaming chairs", "Mesh task seating"],
      capacity: "50,000 units / month"
    },
    {
      id: "s2",
      name: "Anji Wanxiang Furniture Factory",
      location: "Zhejiang, China",
      verified: true,
      yearFounded: 2008,
      employees: "150 - 200 people",
      mainProducts: ["Leather executive chairs", "Bar stools"],
      capacity: "35,000 units / month"
    },
    {
      id: "s3",
      name: "Guangzhou Smart Space Equipment Co.",
      location: "Guangdong, China",
      verified: false,
      yearFounded: 2016,
      employees: "50 - 100 people",
      mainProducts: ["Ergonomic stools", "Drafting chairs"],
      capacity: "20,000 units / month"
    }
  ];

  const handleRfqSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRfqSubmitted(true);
    setTimeout(() => {
      setRfqSubmitted(false);
    }, 4000);
  };

  return (
    <div className="h-full bg-slate-50 flex flex-col border-l border-slate-100">
      
      {/* 1. Navigation Tabs */}
      <div className="bg-white border-b border-slate-100 flex items-center justify-between px-6 h-14 shrink-0">
        <div className="flex gap-4">
          {([
            { id: "products", label: "Matches", icon: Package },
            { id: "suppliers", label: "Suppliers", icon: Building2 },
            { id: "analytics", label: "Analytics", icon: TrendingUp },
            { id: "rfq", label: "RFQ Hub", icon: Send },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 h-14 text-sm font-semibold border-b-2 px-1 transition-all duration-200 ${
                  activeTab === tab.id
                    ? "border-[#ff6600] text-[#ff6600]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-400 font-medium truncate max-w-[200px]" title={queryText}>
          Focus: {queryType.toUpperCase()}
        </span>
      </div>

      {/* 2. Scrollable content panel */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* DESIGN CONTEXT DRAWER */}
        {queryType === "design" && activeTab === "products" && (
          <div className="p-5 bg-gradient-to-r from-orange-500/5 to-pink-500/5 border border-orange-100 rounded-2xl flex flex-col gap-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon size={16} className="text-[#ff6600]" />
              AI Design Workspace
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              We parsed your design reference sketches. The AI has generated structural blueprints and recommended custom production lines:
            </p>
            <div className="w-full aspect-video bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
              {/* Fake Sketch drawing */}
              <div className="w-32 h-32 border border-dashed border-[#ff6600]/40 rounded-full flex items-center justify-center text-3xl font-light text-slate-300 relative">
                🛋️
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-orange-50 border border-orange-100 rounded text-[9px] font-bold text-[#ff6600]">
                  3D DRAFT
                </div>
                <div className="absolute bottom-1/4 left-1/4 w-2 h-2 rounded-full bg-[#ff6600]/60 animate-ping"></div>
              </div>
              <span className="text-xs text-slate-400 mt-3 font-semibold">Mesh Executive Draft (Version 1.0)</span>
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-600">Download Blueprint.PDF</span>
              <button className="text-[11px] font-bold text-[#ff6600] hover:underline flex items-center gap-1">
                <FileText size={12} />
                Get File
              </button>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Product Matches ({mockProducts.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mockProducts.map((prod) => (
                <div key={prod.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-all group">
                  <div>
                    {/* Image Placeholder */}
                    <div className="w-full aspect-square bg-slate-50 rounded-xl flex items-center justify-center text-4xl mb-3 group-hover:scale-[1.02] transition-transform">
                      {prod.image}
                    </div>
                    
                    <h4 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 mb-2">
                      {prod.title}
                    </h4>
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {prod.tags.slice(0, 2).map((t, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-[11px] text-slate-400">Unit Price</span>
                      <span className="text-sm font-extrabold text-[#ff6600]">{prod.price}</span>
                    </div>
                    <div className="flex justify-between items-baseline mb-3">
                      <span className="text-[11px] text-slate-400">MOQ</span>
                      <span className="text-xs font-semibold text-slate-700">{prod.moq}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveTab("rfq");
                        setRfqNotes(`Hi, I am interested in ordering the "${prod.title}". Please send a formal quotation including shipping to LK.`);
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors"
                    >
                      Source Product
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUPPLIERS TAB */}
        {activeTab === "suppliers" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Verified Manufacturers</h3>
            <div className="space-y-4">
              {mockSuppliers.map((sup) => (
                <div key={sup.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.01)] hover:shadow-md transition-all flex flex-col gap-3 relative">
                  {sup.verified && (
                    <span className="absolute top-4 right-4 bg-emerald-50 border border-emerald-100 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                      <ShieldCheck size={12} className="stroke-[2.5]" />
                      Verified Maker
                    </span>
                  )}
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 pr-20">{sup.name}</h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin size={12} />
                      {sup.location} • Est. {sup.yearFounded}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-2 border-y border-slate-50 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Employees</span>
                      <span className="font-semibold text-slate-700">{sup.employees}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Production Limit</span>
                      <span className="font-semibold text-slate-700">{sup.capacity}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase font-semibold">Main Lines</span>
                    <div className="flex flex-wrap gap-1">
                      {sup.mainProducts.map((p, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setActiveTab("rfq");
                      setRfqNotes(`Requesting factory inspection reports and catalog pricing from ${sup.name}.`);
                    }}
                    className="w-full py-2 bg-slate-50 hover:bg-[#ff6600]/5 text-slate-700 hover:text-[#ff6600] border border-slate-100 hover:border-[#ff6600]/20 font-bold rounded-lg text-xs transition-all"
                  >
                    Contact Manufacturer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Sourcing & Market Insights</h3>
            
            {/* Price Index Chart */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Global Pricing Trend</h4>
                  <p className="text-xs text-slate-400">Quarterly average unit price ($)</p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  -4.2% Cost Index
                </span>
              </div>

              {/* Styled SVG Trend Line Chart */}
              <div className="w-full h-32 mt-2 flex flex-col justify-end">
                <svg viewBox="0 0 400 100" className="w-full h-24 overflow-visible">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff6600" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="#ff6600" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="0" y1="20" x2="400" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                  <line x1="0" y1="50" x2="400" y2="50" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                  <line x1="0" y1="80" x2="400" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                  
                  {/* Area */}
                  <path d="M 0 80 Q 80 50 160 60 T 320 25 T 400 35 L 400 100 L 0 100 Z" fill="url(#chartGrad)" />
                  {/* Line */}
                  <path d="M 0 80 Q 80 50 160 60 T 320 25 T 400 35" fill="none" stroke="#ff6600" strokeWidth="2.5" />
                  
                  {/* Points */}
                  <circle cx="320" cy="25" r="4.5" fill="#ff6600" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="400" cy="35" r="4" fill="#ff6600" stroke="#ffffff" strokeWidth="2" />
                </svg>
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-1 mt-2">
                  <span>Q3 (Prev)</span>
                  <span>Q4</span>
                  <span>Q1</span>
                  <span>Q2 (Current)</span>
                </div>
              </div>
            </div>

            {/* Geographical Distribution */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-800">Top Factory Locations</h4>
              <div className="space-y-2.5">
                {[
                  { name: "Guangdong (Foshan, Shenzhen)", pct: 64, count: "124 Factories" },
                  { name: "Zhejiang (Ningbo, Anji)", pct: 26, count: "51 Factories" },
                  { name: "Hebei (Shengfang)", pct: 10, count: "20 Factories" }
                ].map((loc, idx) => (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span className="font-semibold">{loc.name}</span>
                      <span className="font-medium text-slate-400">{loc.count} ({loc.pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 rounded-full" style={{ width: `${loc.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* RFQ TAB */}
        {activeTab === "rfq" && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Direct Request for Quotation (RFQ)</h3>
              <p className="text-xs text-slate-400 mt-1">Submit your sourcing needs to all verified matching factories instantly.</p>
            </div>

            {rfqSubmitted ? (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-3 animate-fadeIn">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <Check size={24} className="stroke-[2.5]" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">RFQ Sent Successfully!</h4>
                <p className="text-xs text-slate-400 max-w-[280px]">
                  Matching factories have been notified. Quotes should arrive in your message inbox within 2 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRfqSubmit} className="space-y-4 text-xs">
                
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-semibold uppercase text-[10px]">Recipient Scope</label>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg font-medium text-slate-700 flex items-center gap-2">
                    <ShieldCheck size={15} className="text-[#ff6600]" />
                    <span>All verified manufacturers in list ({mockSuppliers.filter(s => s.verified).length})</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-500 font-semibold uppercase text-[10px]">Target Quantity (Pieces)</label>
                  <input 
                    type="number" 
                    value={rfqQty}
                    onChange={(e) => setRfqQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:border-[#ff6600] font-semibold text-slate-700" 
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-500 font-semibold uppercase text-[10px]">Specific Instructions / Delivery Info</label>
                  <textarea 
                    value={rfqNotes}
                    onChange={(e) => setRfqNotes(e.target.value)}
                    rows={4}
                    placeholder="Provide details like custom packaging, required shipping ports (e.g. Colombo Port, LK), and certification requirements..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:border-[#ff6600] text-slate-700 leading-relaxed"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 bg-[#ff6600] hover:bg-[#e05900] text-white font-bold rounded-lg text-xs shadow-md shadow-orange-500/10 active:scale-98 transition-all"
                >
                  Send RFQ Broadcast
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
