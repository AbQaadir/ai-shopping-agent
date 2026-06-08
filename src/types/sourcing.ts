export interface InlineProduct {
  id: string;
  name?: string;
  title?: string; // legacy compat
  price?: number;          // LKR (from MCP)
  priceDisplay?: string;   // formatted
  originalPrice?: number;  // original LKR price (before discount)
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

export interface HistoryItem {
  id: string;
  query: string;
  date: string;
  queryType: "design" | "manufacturer" | "bestseller" | "product" | "general";
  messages: Message[];
}
