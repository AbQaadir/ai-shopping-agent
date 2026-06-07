"use client";

import React, { useEffect, useRef } from "react";
import {
  Sparkles,
  Check,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Flag,
  ChevronRight,
  Box,
  Loader2,
  ShoppingCart,
  Truck,
  Package,
  MapPin,
  Globe,
  Wrench,
  Star,
  AlertTriangle,
  ExternalLink,
  Phone,
  CheckCircle,
  XCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

export interface InlineProduct {
  id: string;
  name?: string;
  title?: string; // legacy compat
  price?: number;          // LKR (from MCP)
  priceDisplay?: string;   // formatted
  imageUrl?: string;
  category?: string;
  inStock?: boolean;
  description?: string;
  url?: string;
  isSME?: boolean;
  // legacy fields
  moq?: string;
  supplier?: string;
  location?: string;
  years?: number;
  rating?: number;
  verified?: boolean;
  image?: string;
  bgColor?: string;
}

export interface DeliveryResult {
  city: string;
  canDeliver: boolean;
  deliveryDate?: string;
  flatRateLKR?: number;
  perishableAllowed?: boolean;
  warning?: string;
}

export interface TrackingStep {
  timestamp: string;
  status: string;
  location?: string;
  description: string;
}

export interface TrackingResult {
  orderId: string;
  currentStatus: string;
  estimatedDelivery?: string;
  steps: TrackingStep[];
}

export interface ImportEstimate {
  originalUrl: string;
  productTitle: string;
  usdPrice: number;
  usdToLkrRate: number;
  cifValueLKR: number;
  customsDutyLKR: number;
  customsDutyPct: number;
  palLKR: number;
  cessLKR: number;
  vatLKR: number;
  totalLandedLKR: number;
  breakdown: string;
  disclaimer: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  specialization: string;
  rating: number;
  reviewCount: number;
  experienceYears: number;
  coverageAreas: string[];
  pricingLKR: string;
  phone: string;
  verified: boolean;
  responseTime: string;
}

export interface ServiceListing {
  category: string;
  categoryLabel: string;
  providers: ServiceProvider[];
  needsCityInput: boolean;
  cityPrompt?: string;
}

export interface CheckoutLink {
  productId: string;
  productTitle: string;
  priceLKR: number;
  checkoutUrl: string;
  expiresAt: string;
}

export interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
  status?: "sending" | "sent" | "analyzing";
  isInitialPrompt?: boolean;
  samples?: string[];

  // Thought process
  thinkingSteps?: {
    step: string;
    status: "running" | "completed";
    content: string;
    durationMs?: number;
  }[];
  activeToolCall?: { name: string; args: unknown } | null;

  // Pillar 1 & 3: products
  inlineProductsHeader?: string;
  inlineProducts?: InlineProduct[];
  showViewProductsButton?: boolean;

  // Pillar 2: delivery
  deliveryResult?: DeliveryResult;
  trackingResult?: TrackingResult;
  citySuggestions?: Array<{ name: string; alias?: string; province?: string }>;

  // Pillar 4: import
  importEstimate?: ImportEstimate;

  // Pillar 5: services
  serviceListing?: ServiceListing;

  // Checkout links
  checkoutLinks?: CheckoutLink[];

  // Follow-ups
  followUpText?: string;
  followUpSamples?: string[];
}

interface ChatTimelineProps {
  messages: Message[];
  isGenerating: boolean;
  onSampleClick?: (sampleText: string) => void;
  onViewDetailsClick?: (products?: InlineProduct[]) => void;
  selectedProductIds?: string[];
  onToggleSelectProduct?: (product: InlineProduct) => void;
  onBuyProduct?: (product: InlineProduct) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatLKR(amount?: number) {
  if (!amount) return "N/A";
  return `Rs. ${amount.toLocaleString("en-LK")}`;
}

function renderFormattedText(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={idx} className="font-extrabold text-slate-800">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <strong key={idx} className="font-bold text-slate-800">{part.slice(1, -1)}</strong>;
    return part;
  });
}

function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    intent_routing: "Intent Classification",
    searching_kapruka: "Kapruka Product Search",
    sme_filter: "Local SME Filtering",
    checking_delivery: "Delivery Availability Check",
    tracking_order: "Order Tracking",
    calculating_import: "Import Cost Calculation",
    finding_providers: "Service Provider Search",
    generating_response: "AI Response Generation",
    parsing_specs: "Requirement Parsing",
    searching_suppliers: "Supplier Search",
    verification_checks: "Supplier Verification",
  };
  return labels[step] || step.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────

function DeliveryCard({ delivery }: { delivery: DeliveryResult }) {
  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-100">
        <Truck size={14} className="text-emerald-600" />
        <span className="text-xs font-extrabold text-slate-700">Grasshoppers Delivery Check</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-800">{delivery.city}</span>
          </div>
          {delivery.canDeliver ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
              <CheckCircle size={12} className="text-emerald-600" />
              <span className="text-xs font-extrabold text-emerald-700">Available</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-full border border-red-100">
              <XCircle size={12} className="text-red-500" />
              <span className="text-xs font-extrabold text-red-600">Not Available</span>
            </div>
          )}
        </div>

        {delivery.canDeliver && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <div className="text-xl font-extrabold text-[#402970]">
                {formatLKR(delivery.flatRateLKR)}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Flat Delivery Rate</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <div className="text-sm font-extrabold text-slate-800">
                {delivery.deliveryDate || "Tomorrow"}
              </div>
              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Estimated Arrival</div>
            </div>
          </div>
        )}

        {delivery.perishableAllowed === false && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-amber-700">
              Perishable items (cakes, fresh flowers) cannot be delivered to this city.
            </p>
          </div>
        )}

        {delivery.warning && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-amber-700">{delivery.warning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackingCard({ tracking }: { tracking: TrackingResult }) {
  const statusIcons: Record<string, string> = {
    pending: "⏳",
    packed: "📦",
    dispatched: "🚚",
    in_transit: "🚚",
    out_for_delivery: "🛵",
    delivered: "✅",
    failed: "❌",
  };

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-blue-600" />
          <span className="text-xs font-extrabold text-slate-700">Order Tracking</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 font-mono">#{tracking.orderId}</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{statusIcons[tracking.currentStatus.toLowerCase()] || "📦"}</span>
          <div>
            <div className="text-sm font-extrabold text-slate-800 capitalize">
              {tracking.currentStatus.replace(/_/g, " ")}
            </div>
            {tracking.estimatedDelivery && (
              <div className="text-[10px] text-slate-500 font-medium">
                Expected: {tracking.estimatedDelivery}
              </div>
            )}
          </div>
        </div>

        {tracking.steps && tracking.steps.length > 0 && (
          <div className="space-y-3 border-l-2 border-slate-100 pl-4 ml-2">
            {tracking.steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-white border-2 border-slate-300 top-0.5" />
                <div className="text-[10px] font-bold text-slate-400">{step.timestamp}</div>
                <div className="text-xs font-semibold text-slate-700">{step.description}</div>
                {step.location && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <MapPin size={9} />
                    {step.location}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportEstimateCard({ estimate }: { estimate: ImportEstimate }) {
  const domainMatch = estimate.originalUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
  const domain = domainMatch ? domainMatch[1] : "external store";

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-slate-100">
        <Globe size={14} className="text-violet-600" />
        <span className="text-xs font-extrabold text-slate-700">Sri Lanka Import Cost Estimate</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Product / source */}
        <div className="flex items-center gap-2">
          <ExternalLink size={12} className="text-slate-400 shrink-0" />
          <a
            href={estimate.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#402970] hover:underline truncate"
          >
            {estimate.productTitle.substring(0, 60)} — {domain}
          </a>
        </div>

        {/* Breakdown table */}
        <div className="rounded-xl border border-slate-100 overflow-hidden text-xs">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="px-3 py-2 text-slate-500 font-medium">CIF Value</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-700">
                  ${estimate.usdPrice.toFixed(2)} × {estimate.usdToLkrRate} LKR
                </td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.cifValueLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <td className="px-3 py-2 text-slate-500 font-medium">
                  Customs Duty ({(estimate.customsDutyPct * 100).toFixed(0)}%)
                </td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">on CIF</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.customsDutyLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="px-3 py-2 text-slate-500 font-medium">PAL (10%)</td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">Port & Airport Levy</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.palLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <td className="px-3 py-2 text-slate-500 font-medium">CESS (2.5%)</td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]" />
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.cessLKR)}
                </td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="px-3 py-2 text-slate-500 font-medium">VAT (18%)</td>
                <td className="px-3 py-2 text-right text-slate-400 text-[10px]">on total dutiable</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800">
                  {formatLKR(estimate.vatLKR)}
                </td>
              </tr>
              <tr className="bg-[#402970]/5">
                <td className="px-3 py-2.5 font-extrabold text-slate-800">Total Landed Cost</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right font-extrabold text-[#402970] text-sm">
                  {formatLKR(estimate.totalLandedLKR)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] font-medium text-amber-700 leading-relaxed">{estimate.disclaimer}</p>
        </div>

        {/* CTA */}
        <a
          href="https://www.kapruka.com/globalshop"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#402970] hover:bg-[#33205a] text-white text-xs font-bold rounded-xl transition-colors"
        >
          <Globe size={12} />
          Order via Kapruka Global Shop
        </a>
      </div>
    </div>
  );
}

function ServiceListingCard({ listing, onSampleClick }: { listing: ServiceListing; onSampleClick?: (text: string) => void }) {
  if (listing.needsCityInput) {
    return (
      <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-slate-100">
          <Wrench size={14} className="text-orange-600" />
          <span className="text-xs font-extrabold text-slate-700">{listing.categoryLabel}</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600 font-medium">{listing.cityPrompt}</p>
          <div className="flex flex-wrap gap-2">
            {["Colombo", "Kandy", "Galle", "Negombo", "Kurunegala"].map((city) => (
              <button
                key={city}
                onClick={() => onSampleClick?.(`Find ${listing.categoryLabel.toLowerCase()} in ${city}`)}
                className="px-3 py-1.5 text-xs font-semibold text-[#402970] bg-[#402970]/5 hover:bg-[#402970]/10 border border-[#402970]/10 rounded-full transition-colors cursor-pointer"
              >
                📍 {city}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-orange-600" />
          <span className="text-xs font-extrabold text-slate-700">{listing.categoryLabel}</span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">{listing.providers.length} verified providers</span>
      </div>

      {listing.cityPrompt && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <p className="text-[10px] font-medium text-amber-700">{listing.cityPrompt}</p>
        </div>
      )}

      <div className="p-4 space-y-3">
        {listing.providers.map((provider) => (
          <div key={provider.id} className="border border-slate-100 rounded-xl p-3 hover:border-slate-200 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-extrabold text-slate-800 truncate">{provider.name}</span>
                  {provider.verified && (
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded border border-emerald-100">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{provider.specialization}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 justify-end">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-extrabold text-slate-700">{provider.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400">({provider.reviewCount})</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{provider.experienceYears} yrs exp</div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50">
              <div>
                <div className="text-xs font-bold text-slate-700">{provider.pricingLKR}</div>
                <div className="text-[10px] text-slate-400">⚡ {provider.responseTime}</div>
              </div>
              <a
                href={`tel:${provider.phone.replace(/\s|\*/g, "")}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#402970] hover:bg-[#33205a] text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Phone size={10} />
                Book Now
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductCard({
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
  const displayName = product.name || product.title || "Product";
  const displayPrice = product.price
    ? `Rs. ${product.price.toLocaleString("en-LK")}`
    : product.priceDisplay || "N/A";

  return (
    <div className={`w-full bg-white rounded-xl p-3 flex flex-col justify-between hover:shadow-md transition-all relative group border ${isSelected ? "border-[#402970]/30 shadow-md" : "border-slate-100"}`}>
      {/* SME Badge */}
      {product.isSME && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">
          <span className="text-[8px]">🇱🇰</span>
          <span className="text-[8px] font-extrabold text-emerald-700">Local</span>
        </div>
      )}

      {/* Image area */}
      <div className="w-full aspect-[4/3] bg-slate-50 rounded-lg flex items-center justify-center mb-2 relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-3xl">{product.image || "🛍️"}</span>
        )}

        {product.inStock === false && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded">Out of Stock</span>
          </div>
        )}

        {/* Select overlay */}
        <div className={`absolute inset-0 bg-black/5 flex items-center justify-center transition-opacity duration-200 ${isSelected ? "opacity-100 bg-black/10" : "opacity-0 group-hover:opacity-100"}`}>
          <button
            onClick={onToggle}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold shadow-md cursor-pointer transition-all flex items-center gap-0.5 ${isSelected ? "bg-[#402970] text-white border border-[#402970]" : "bg-white text-slate-800 hover:bg-slate-50 border border-slate-200"}`}
          >
            <Check size={9} className="stroke-[3.5]" />
            <span>Select</span>
          </button>
        </div>
      </div>

      {/* Name */}
      <h5 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 mb-1.5">
        {displayName.length > 45 ? displayName.substring(0, 45) + "…" : displayName}
      </h5>

      <div className="text-xs border-t border-slate-50 pt-2 mt-auto space-y-1.5">
        <div className="font-extrabold text-[#402970] text-sm">{displayPrice}</div>
        {product.category && (
          <div className="text-slate-400 text-[10px] font-medium">{product.category}</div>
        )}

        {/* Buy Now Button */}
        {product.url && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onBuy();
            }}
            className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-[#402970] hover:bg-[#33205a] text-white text-[10px] font-bold rounded-lg transition-colors mt-1"
          >
            <ShoppingCart size={9} />
            Buy Now
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main ChatTimeline ────────────────────────────────────────────────────

export default function ChatTimeline({
  messages,
  isGenerating,
  onSampleClick,
  onViewDetailsClick,
  selectedProductIds = [],
  onToggleSelectProduct,
  onBuyProduct,
}: ChatTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 space-y-6 flex flex-col items-center w-full">
      <div className="w-full max-w-3xl space-y-6 flex flex-col">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div key={msg.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col gap-1 max-w-[88%] ${isUser ? "w-full items-end" : "w-full items-start"}`}>

                {/* User message */}
                {isUser ? (
                  <div className="px-4 py-2.5 bg-slate-100 text-slate-800 rounded-full font-semibold shadow-sm text-sm">
                    {msg.text}
                  </div>
                ) : (
                  /* AI message */
                  <div className="w-full text-slate-700 py-3 space-y-4">

                    {/* Initial prompt */}
                    {msg.isInitialPrompt ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-slate-800 text-base">How can I help you today?</h4>
                          <p className="text-slate-500 font-medium text-sm">I can search Kapruka products, check delivery, estimate import costs, or book home services.</p>
                        </div>
                        <div className="space-y-2">
                          <p className="font-extrabold text-slate-800 text-sm">Try one of these 👇</p>
                          <div className="space-y-1.5 pl-1">
                            {msg.samples?.map((sample, idx) => (
                              <button
                                key={idx}
                                onClick={() => onSampleClick?.(sample)}
                                className="flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold text-xs hover:underline cursor-pointer text-left py-0.5"
                              >
                                <span className="text-sm font-semibold">↙</span>
                                <span>&ldquo;{sample}&rdquo;</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">

                        {/* Thought process */}
                        {((msg.thinkingSteps && msg.thinkingSteps.length > 0) || msg.activeToolCall || msg.text) && (
                          <div className="text-xs w-full">
                            <details className="group border border-slate-100 rounded-xl bg-slate-50/40 overflow-hidden" open={isGenerating || !msg.text}>
                              <summary className="font-bold text-slate-500 cursor-pointer flex items-center justify-between px-3 py-2 select-none hover:bg-slate-100/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <Sparkles size={12} className="text-[#402970]" />
                                  <span>Thought Process</span>
                                </div>
                                <span className="text-[10px] text-slate-400 group-open:hidden">Show</span>
                                <span className="text-[10px] text-slate-400 hidden group-open:inline">Hide</span>
                              </summary>
                              <div className="p-4 border-t border-slate-100 bg-white space-y-3">
                                {msg.thinkingSteps && msg.thinkingSteps.length > 0 ? (
                                  <div className="space-y-3">
                                    {msg.thinkingSteps.map((step, idx) => (
                                      <div key={idx} className="space-y-1 pl-1">
                                        <div className="flex items-center gap-2 text-xs text-slate-700 font-extrabold">
                                          {step.status === "running" ? (
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                          ) : (
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 flex items-center justify-center text-[6px] text-white">✓</span>
                                          )}
                                          <span>{getStepLabel(step.step)}</span>
                                          {step.durationMs != null && step.durationMs > 0 && (
                                            <span className="text-[10px] text-slate-400 font-normal">
                                              ({(step.durationMs / 1000).toFixed(1)}s)
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-slate-500 text-xs font-medium pl-4 leading-relaxed">{step.content}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Loader2 size={12} className="animate-spin text-[#402970]" />
                                    <span>Processing your request...</span>
                                  </div>
                                )}

                                {msg.activeToolCall && (
                                  <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl flex items-center gap-2 animate-pulse">
                                    <Loader2 size={12} className="text-amber-600 animate-spin shrink-0" />
                                    <span className="text-xs font-bold text-amber-700">
                                      Calling: <code className="bg-amber-100/60 px-1 rounded">{msg.activeToolCall.name}</code>
                                    </span>
                                  </div>
                                )}

                                {/* Inline product count badge */}
                                {msg.inlineProducts && msg.inlineProducts.length > 0 && (
                                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 truncate">
                                      <Box size={14} className="text-[#402970]" />
                                      <span>Kapruka Search</span>
                                      <span className="text-slate-300 font-light">|</span>
                                      <span className="text-slate-500 font-medium">{msg.inlineProducts.length} products found</span>
                                    </div>
                                    <button
                                      onClick={() => onViewDetailsClick?.(msg.inlineProducts)}
                                      className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
                                    >
                                      View details
                                    </button>
                                  </div>
                                )}
                              </div>
                            </details>
                          </div>
                        )}

                        {/* AI text response */}
                        {msg.text && (
                          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
                            {msg.text.split("\n\n").map((para, pIdx) => (
                              <p key={pIdx}>{renderFormattedText(para)}</p>
                            ))}
                          </div>
                        )}

                        {/* ── Pillar 1/3: Product Grid ── */}
                        {msg.inlineProducts && msg.inlineProducts.length > 0 && (
                          <div className="space-y-3 pt-1">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                              {msg.inlineProductsHeader || "Kapruka Products"}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 select-none">
                              {msg.inlineProducts.map((prod) => (
                                <ProductCard
                                  key={prod.id}
                                  product={prod}
                                  isSelected={selectedProductIds.includes(prod.id)}
                                  onToggle={() => onToggleSelectProduct?.(prod)}
                                  onBuy={() => onBuyProduct?.(prod)}
                                />
                              ))}
                            </div>
                            {msg.showViewProductsButton && (
                              <div className="flex justify-center pt-1">
                                <button
                                  onClick={() => onViewDetailsClick?.(msg.inlineProducts)}
                                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full shadow-md transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  View all on Kapruka <ChevronRight size={13} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Pillar 2: Delivery Card ── */}
                        {msg.deliveryResult && <DeliveryCard delivery={msg.deliveryResult} />}

                        {/* ── Pillar 2: Tracking Card ── */}
                        {msg.trackingResult && <TrackingCard tracking={msg.trackingResult} />}

                        {/* ── Pillar 4: Import Estimate Card ── */}
                        {msg.importEstimate && <ImportEstimateCard estimate={msg.importEstimate} />}

                        {/* ── Pillar 5: Service Listing Card ── */}
                        {msg.serviceListing && (
                          <ServiceListingCard listing={msg.serviceListing} onSampleClick={onSampleClick} />
                        )}

                        {/* Follow-up suggestions */}
                        {msg.followUpSamples && msg.followUpSamples.length > 0 && (
                          <div className="space-y-2.5 pt-3 border-t border-slate-50">
                            <p className="text-xs font-bold text-slate-500">
                              {msg.followUpText || "You can continue with:"}
                            </p>
                            <div className="space-y-1.5 pl-1">
                              {msg.followUpSamples.map((sample, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => onSampleClick?.(sample)}
                                  className="flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold text-xs hover:underline cursor-pointer text-left py-0.5"
                                >
                                  <span className="text-sm font-semibold">↙</span>
                                  <span>{sample}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reaction bar */}
                    <div className="flex items-center gap-3 text-slate-400 select-none pt-1">
                      <button className="p-1 hover:bg-slate-50 hover:text-slate-600 rounded transition-colors" title="Good response">
                        <ThumbsUp size={14} />
                      </button>
                      <button className="p-1 hover:bg-slate-50 hover:text-slate-600 rounded transition-colors" title="Bad response">
                        <ThumbsDown size={14} />
                      </button>
                      <button className="p-1 hover:bg-slate-50 hover:text-slate-600 rounded ml-1 transition-colors" title="Report">
                        <Flag size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isUser ? "justify-end" : "justify-start"}`}>
                  <span>{formatTime(msg.timestamp)}</span>
                  {isUser && (
                    <span>
                      {msg.status === "sending" && <Clock size={10} className="animate-spin text-[#402970]" />}
                      {msg.status === "sent" && <Check size={10} className="text-emerald-500 stroke-[3]" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isGenerating && (
          <div className="self-start max-w-[85%] animate-pulse flex flex-col gap-1 py-3">
            <div className="flex items-center gap-2 text-slate-500">
              <span className="w-2 h-2 bg-[#402970] rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-[#402970] rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 bg-[#402970] rounded-full animate-bounce [animation-delay:0.4s]" />
              <span className="text-xs font-semibold">Searching Kapruka...</span>
            </div>
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
