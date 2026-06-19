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
  currency?: string;
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

// ── Conversational Order Flow Types ───────────────────────────────────────────

export interface CartItem {
  id: string;
  supplierId?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  inStock?: boolean;
  stockQty?: number;
}

export type OrderFlowPhase =
  | "qty_ask"           // AI asked quantity — show quantity picker widget
  | "delivery_ask"      // AI asked delivery location — show saved address + buttons
  | "address_ask"       // AI asked user to type a rough location / address — no bubble
  | "map_open"          // AI opened map — show embedded Google Map for pin drop
  | "payment_ask"       // AI asked payment method — show COD / Card buttons
  | "confirmed"         // Order placed — show confirmation card
  | "out_of_stock";     // Product out of stock — show apology

export interface SavedAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
}

/** Categorized saved delivery address per user */
export interface UserAddress {
  id: string;
  type: "home" | "work" | "custom";
  label: string;          // "Home" | "Work" | user-typed
  recipientName: string;  // who receives delivery
  phone: string;          // delivery contact number
  addressLine: string;    // street / rough address text
  city: string;
  lat?: number;           // from Google Maps pin
  lng?: number;
  formattedAddress?: string; // full formatted address from geocoder
  isDefault: boolean;
}

export interface GeocodedLocation {
  lat: number;
  lng: number;
  label: string;           // short place name (e.g. "Bogahakumbura")
  formattedAddress: string; // full formatted address from Geocoding API
}

export interface OrderFlowStepData {
  phase: OrderFlowPhase;
  product?: InlineProduct;
  cartItems?: CartItem[];
  stockStatus?: "in_stock" | "out_of_stock" | "limited";
  stockQty?: number;              // estimated available quantity
  savedAddress?: SavedAddress;    // user's default saved address
  savedAddresses?: UserAddress[]; // all user saved addresses for delivery_ask phase
  geocodedLocation?: GeocodedLocation; // geocoded result for map_open phase
  confirmedQuantity?: number;     // quantity confirmed by user
  confirmedAddress?: SavedAddress; // delivery address confirmed by user
  paymentMethod?: "cod" | "card"; // confirmed payment method
  checkoutUrl?: string;           // card payment URL after order placed
  orderId?: string;               // order reference after placement
  errorMessage?: string;          // e.g. "requested qty exceeds stock"
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

export interface ProductGroup {
  title: string;
  products: InlineProduct[];
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
    terms?: string[]; // parallel search terms for capsule rendering (baseLlmTerms)
    term?: string;    // single term for per-pipeline steps (searching_kapruka, validating_relevance)
  }[];
  activeToolCall?: { name: string; args: unknown } | null;
  activeToolCalls?: Array<{ name: string; args: unknown }>; // accumulates parallel tool calls

  // Pillar 1 & 3: products
  inlineProductsHeader?: string;
  inlineProducts?: InlineProduct[];
  productGroups?: ProductGroup[];
  showViewProductsButton?: boolean;

  // Pillar 2: delivery
  deliveryResult?: DeliveryResult;
  trackingResult?: TrackingResult;
  citySuggestions?: Array<{ name: string; alias?: string; province?: string }>;



  // Pillar 5: services
  serviceListing?: ServiceListing;

  // Checkout links
  checkoutLinks?: CheckoutLink[];
  checkoutFormProduct?: InlineProduct;

  // Conversational order flow — NEW (phase-driven step bubbles)
  orderFlowStep?: OrderFlowStepData;

  // Conversational order flow — LEGACY (kept for backward compat with old chat history)
  orderFlowProduct?: InlineProduct;
  orderFlowStockStatus?: "in_stock" | "out_of_stock" | "limited";
  orderFlowStockQty?: number;

  // Google Search Grounding sources
  groundingSources?: Array<{ title: string; uri: string }>;

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
