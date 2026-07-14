/**
 * mcpClient.ts
 * ---------------------------------------------------------------------------
 * MCP (Model Context Protocol) client for the Kapruka public MCP server.
 *
 * Uses the official @modelcontextprotocol/sdk which handles the mandatory
 * initialize → initialized handshake automatically before any tool call.
 *
 * Transport: StreamableHTTPClientTransport (stateless per-request sessions).
 *
 * Security notes:
 *   - MCP URL is read exclusively from env vars — never hard-coded.
 *   - No authentication headers are embedded in source code.
 *   - Errors are sanitised before logging (no raw response bodies in prod).
 * ---------------------------------------------------------------------------
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MCPContext {
  onLog?: (msg: any) => void;
  onProgress?: (prog: any) => void;
}

export interface MCPToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Kapruka product as returned by kapruka_search_products / kapruka_get_product */
export interface KaprukaProduct {
  id: string;
  name: string;
  price: number;           // LKR
  originalPrice?: number;  // LKR (before discount)
  currency: string;        // "LKR"
  imageUrl?: string;
  category?: string;
  inStock: boolean;
  stockCount?: number;
  description?: string;
  deliveryInfo?: string;
  url?: string;
  isSME?: boolean;         // Injected by Pillar 3 logic
  variants?: any[];
  attributes?: Record<string, any>;
  shipping?: Record<string, any>;
}

/** Kapruka order / checkout result from kapruka_create_order */
export interface KaprukaOrderResult {
  checkoutUrl: string;
  orderId?: string;
  expiresAt: string;       // ISO datetime — 60 min from creation
  totalLKR?: number;
}

/** Delivery check result from kapruka_check_delivery */
export interface KaprukaDeliveryResult {
  city: string;
  canDeliver: boolean;
  deliveryDate?: string;
  flatRateLKR?: number;
  perishableAllowed?: boolean;
  warning?: string;
}

/** Order tracking step */
export interface KaprukaTrackingStep {
  timestamp: string;
  status: string;
  location?: string;
  description: string;
}

/** Full tracking result from kapruka_track_order */
export interface KaprukaTrackingResult {
  orderId: string;
  currentStatus: string;
  estimatedDelivery?: string;
  steps: KaprukaTrackingStep[];

  // ── Enrichment fields injected from our DB (not from MCP) ──────────────
  // These overwrite / supplement the raw MCP response with user-specific data
  // from the logged-in user's Order record.
  displayOrderRef?: string;           // Our internal order ID to show the user
  displayTotalLKR?: number;           // Order total from our DB
  displayItems?: Array<{              // Product names / quantities from our DB
    name: string;
    quantity: number;
    priceLKR: number;
  }>;
  displayPersonalMessage?: string;    // Gift / personal message from checkout
  displayRecipient?: {                // Confirmed delivery address from checkout
    name: string;
    city: string;
  };
}

/** Delivery city from kapruka_list_delivery_cities */
export interface KaprukaCity {
  name: string;
  alias?: string;
  province?: string;
}

/** Category from kapruka_list_categories */
export interface KaprukaCategory {
  name: string;
  url?: string;
}

/** Deep category with subcategories from kapruka_list_categories (depth: 2) */
export interface KaprukaCategoryDeep {
  name: string;
  url?: string;
  subcategories?: Array<{
    name: string;
    url?: string;
  }>;
}

// ── Core MCP Client (using official SDK) ──────────────────────────────────

/**
 * Creates a fresh MCP client, connects with the initialize handshake,
 * calls the requested tool, and returns the text result.
 *
 * A new client+transport is created per call to keep the Next.js API route
 * stateless — this matches how Streamable HTTP transport works (each
 * initialize creates a new session-id via the Mcp-Session-Id header).
 */
async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>,
  mcpContext?: MCPContext
): Promise<string> {
  const mcpUrl = process.env.KAPRUKA_MCP_URL;
  if (!mcpUrl) {
    throw new Error("KAPRUKA_MCP_URL is not set in environment variables");
  }

  const client = new Client(
    { name: "kapruka-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  if (mcpContext?.onLog) {
    client.fallbackNotificationHandler = async (notification) => {
      if (notification.method === "notifications/message" && mcpContext.onLog) {
        mcpContext.onLog(notification.params);
      }
    };
  }

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

  // connect() performs initialize → initialized handshake automatically
  await client.connect(transport);

  try {
    const options: any = {};
    if (mcpContext?.onProgress) {
      options.onprogress = (progress: any) => mcpContext.onProgress!(progress);
    }

    const result = await client.callTool({ name: toolName, arguments: args }, undefined, options);

    // Extract text content from the tool result
    const content = result.content;
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error(`MCP tool "${toolName}" returned empty content`);
    }

    const textItem = content.find((c: { type: string }) => c.type === "text") as
      | { type: "text"; text: string }
      | undefined;

    if (!textItem) {
      throw new Error(`MCP tool "${toolName}" returned no text content`);
    }

    return textItem.text;
  } finally {
    // Always close the transport to release the session
    await client.close();
  }
}

function isRateLimit(err: unknown, text?: string): boolean {
  if (text && text.toLowerCase().includes("rate limit")) {
    return true;
  }
  if (err instanceof Error && err.message.toLowerCase().includes("rate limit")) {
    return true;
  }
  if (typeof err === "string" && err.toLowerCase().includes("rate limit")) {
    return true;
  }
  return false;
}

/**
 * Safe wrapper — catches errors and returns a typed MCPToolResult.
 * Use this in tool functions that should not hard-crash the SSE stream.
 * Includes rate limit retry logic.
 */
async function safeCallMCPTool<T>(
  toolName: string,
  args: Record<string, unknown>,
  parser: (text: string) => T,
  mcpContext?: MCPContext
): Promise<MCPToolResult<T>> {
  const maxRetries = 3;
  let delay = 300; // ms

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    let text = "";
    try {
      text = await callMCPTool(toolName, args, mcpContext);
      
      // Check if the response text itself is a rate limit error message
      if (text.toLowerCase().includes("rate limit")) {
        throw new Error(text);
      }
      
      const data = parser(text);
      return { success: true, data };
    } catch (err: unknown) {
      const isRate = isRateLimit(err, text);
      
      if (isRate && attempt <= maxRetries) {
        console.warn(`[MCP] ${toolName} rate limited (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2.5; // exponential backoff
        continue;
      }
      
      const error = err instanceof Error ? err.message : "Unknown MCP error";
      console.error(`[MCP] ${toolName} failed:`, error);
      return { success: false, error };
    }
  }
  return { success: false, error: "Max retries exceeded" };
}

/** Safely parse JSON from MCP text response */
function parseJSON<T>(text: string): T {
  return JSON.parse(text) as T;
}

// ── Named Tool Wrappers ────────────────────────────────────────────────────

/**
 * Pillar 1 — Search the live Kapruka product catalog.
 */
export async function searchProducts(
  query: string,
  options: {
    maxPrice?: number;
    inStockOnly?: boolean;
    page?: number;
    currency?: string;
  } = {},
  mcpContext?: MCPContext
): Promise<MCPToolResult<KaprukaProduct[]>> {
  const params: Record<string, unknown> = {
    q: query,
    response_format: "json",
    limit: 50,
  };
  if (options.maxPrice !== undefined) params.max_price = options.maxPrice;
  if (options.inStockOnly !== undefined) params.in_stock_only = options.inStockOnly;
  if (options.currency) params.currency = options.currency;

  return safeCallMCPTool("kapruka_search_products", { params }, (text) => {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      // If the MCP server returns a plain text string (e.g. "No products found..."),
      // we treat it as a successful query with 0 results.
      return [];
    }

    interface RawProduct {
      id: string;
      name: string;
      summary?: string;
      price: { amount: number | null; currency: string };
      compare_at_price: { amount: number; currency: string } | null;
      in_stock: boolean;
      stock_level?: string;
      image_url?: string | null;
      category?: { id: string; name: string; slug: string };
      rating?: number | null;
      ships_internationally?: boolean;
      url?: string;
    }
    interface RawResponse {
      results?: RawProduct[];
    }
    const raw = parseJSON<RawResponse>(text);
    const results = raw.results || [];
    
    // Deduplicate products by id to prevent key duplicates in React lists
    const seen = new Set<string>();
    const uniqueResults = results.filter((item) => {
      if (!item.id) return false;
      const key = item.id.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueResults.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price?.amount ?? 0,
      originalPrice: item.compare_at_price?.amount || undefined,
      currency: item.price?.currency || "LKR",
      imageUrl: item.image_url || undefined,
      category: item.category?.name || undefined,
      inStock: item.in_stock,
      description: item.summary || undefined,
      url: item.url || undefined,
    }));
  }, mcpContext);
}

/**
 * Pillar 1 — Get full details for a specific Kapruka product.
 */
export async function getProduct(productId: string, mcpContext?: MCPContext): Promise<MCPToolResult<KaprukaProduct>> {
  return safeCallMCPTool(
    "kapruka_get_product",
    {
      params: {
        product_id: productId,
        response_format: "json",
      },
    },
    (text) => {
      interface RawProductDetail {
        id: string;
        name: string;
        description?: string;
        summary?: string;
        price: { amount: number | null; currency: string };
        compare_at_price: { amount: number; currency: string } | null;
        in_stock: boolean;
        stock_level?: string;
        category?: { id: string; name: string; slug: string };
        images?: string[];
        url?: string;
        variants?: any[];
        attributes?: Record<string, any>;
        shipping?: Record<string, any>;
      }
      const raw = parseJSON<RawProductDetail>(text);
      return {
        id: raw.id,
        name: raw.name,
        price: raw.price?.amount ?? 0,
        originalPrice: raw.compare_at_price?.amount || undefined,
        currency: raw.price?.currency || "LKR",
        imageUrl: raw.images?.[0] || undefined,
        category: raw.category?.name || undefined,
        inStock: raw.in_stock,
        description: raw.description || raw.summary || undefined,
        url: raw.url || undefined,
        variants: raw.variants,
        attributes: raw.attributes,
        shipping: raw.shipping,
      };
    },
    mcpContext
  );
}

/**
 * Pillar 1 — List all top-level Kapruka categories.
 */
export async function listCategories(mcpContext?: MCPContext): Promise<MCPToolResult<KaprukaCategory[]>> {
  return safeCallMCPTool(
    "kapruka_list_categories",
    {
      params: {
        depth: 1,
        response_format: "json",
      },
    },
    (text) => {
      interface RawListCategoriesResponse {
        categories?: Array<{ name: string; url?: string }>;
      }
      const raw = parseJSON<RawListCategoriesResponse>(text);
      return (raw.categories || []).map((c) => ({
        name: c.name,
        url: c.url,
      }));
    },
    mcpContext
  );
}

/**
 * Pillar 1 — List all Kapruka categories with subcategories (depth: 2).
 * Returns the full category tree needed by the Category Browse Agent.
 */
export async function listCategoriesDeep(mcpContext?: MCPContext): Promise<MCPToolResult<KaprukaCategoryDeep[]>> {
  return safeCallMCPTool(
    "kapruka_list_categories",
    {
      params: {
        depth: 2,
        response_format: "json",
      },
    },
    (text) => {
      interface RawSubcategory {
        name: string;
        url?: string;
      }
      interface RawCategoryDeep {
        name: string;
        url?: string;
        subcategories?: RawSubcategory[];
        children?: RawSubcategory[];
      }
      interface RawListCategoriesDeepResponse {
        categories?: RawCategoryDeep[];
      }
      const raw = parseJSON<RawListCategoriesDeepResponse>(text);
      return (raw.categories || []).map((c) => ({
        name: c.name,
        url: c.url,
        subcategories: (c.subcategories || c.children || []).map((s) => ({
          name: s.name,
          url: s.url,
        })),
      }));
    },
    mcpContext
  );
}

// ── Category Cache (10-minute TTL) ────────────────────────────────────────

let _categoryCache: { data: KaprukaCategoryDeep[]; fetchedAt: number } | null = null;
const CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Returns the full depth-2 category tree, using a 10-minute in-memory cache
 * to avoid repeated MCP calls. Falls back to stale cache if a refresh fails.
 */
export async function getCachedCategories(mcpContext?: MCPContext): Promise<KaprukaCategoryDeep[]> {
  if (_categoryCache && Date.now() - _categoryCache.fetchedAt < CATEGORY_CACHE_TTL_MS) {
    return _categoryCache.data;
  }
  const result = await listCategoriesDeep(mcpContext);
  if (result.success && result.data) {
    _categoryCache = { data: result.data, fetchedAt: Date.now() };
    return result.data;
  }
  // If refresh failed but we have stale data, use it
  if (_categoryCache?.data) {
    console.warn("[MCP] Category refresh failed, using stale cache.");
    return _categoryCache.data;
  }
  console.error("[MCP] Category fetch failed and no cache available.");
  return [];
}

/**
 * Pillar 1 — Create a guest checkout order.
 * Returns a 60-minute locked click-to-pay URL.
 *
 * Security: recipient info is passed through only — never stored in source code.
 */
export async function createOrder(
  productIdOrItems: string | Array<{ productId: string; quantity: number }>,
  quantityOrRecipient: number | { name: string; phone: string; address: string; city: string },
  recipientDetail?: { name: string; phone: string; address: string; city: string },
  deliveryDate?: string,   // YYYY-MM-DD — user-chosen; falls back to tomorrow if omitted
  giftMessage?: string,    // optional gift_message passed to kapruka_create_order
  mcpContext?: MCPContext
): Promise<MCPToolResult<KaprukaOrderResult>> {
  // Resolve delivery date: use user-chosen date or fall back to tomorrow
  const resolvedDate = deliveryDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  let cartPayload: Array<{ product_id: string; quantity: number }> = [];
  let recipient: { name: string; phone: string; address: string; city: string };

  if (Array.isArray(productIdOrItems)) {
    cartPayload = productIdOrItems.map(item => ({
      product_id: item.productId,
      quantity: item.quantity,
    }));
    recipient = quantityOrRecipient as { name: string; phone: string; address: string; city: string };
  } else {
    cartPayload = [
      {
        product_id: productIdOrItems,
        quantity: quantityOrRecipient as number,
      },
    ];
    recipient = recipientDetail!;
  }

  const params = {
    cart: cartPayload,
    recipient: {
      name: recipient.name,
      phone: recipient.phone,
    },
    delivery: {
      address: recipient.address,
      city: recipient.city,
      date: resolvedDate,
    },
    sender: {
      name: "Kapruka Guest Client",
      anonymous: true,
    },
    // Include gift_message only when provided
    ...(giftMessage ? { gift_message: giftMessage } : {}),
    response_format: "json",
  };

  return safeCallMCPTool("kapruka_create_order", { params }, (text) => {
    interface RawOrderResponse {
      checkout_url: string;
      order_ref: string;
      expires_at: string;
      summary?: {
        grand_total: number;
      };
    }
    const raw = parseJSON<RawOrderResponse>(text);
    return {
      checkoutUrl: raw.checkout_url,
      orderId: raw.order_ref,
      expiresAt: raw.expires_at,
      totalLKR: raw.summary?.grand_total,
    };
  }, mcpContext);
}

/**
 * Pillar 2 — Check if Kapruka Grasshoppers can deliver to a city on a date.
 */
export async function checkDelivery(
  city: string,
  date: string,          // YYYY-MM-DD
  productId: string,
  mcpContext?: MCPContext
): Promise<MCPToolResult<KaprukaDeliveryResult>> {
  return safeCallMCPTool(
    "kapruka_check_delivery",
    {
      params: {
        city,
        delivery_date: date,
        product_id: productId,
        response_format: "json",
      },
    },
    (text) => {
      interface RawDeliveryResponse {
        city: string;
        available: boolean;
        next_available_date?: string;
        rate?: number;
        reason?: string;
        perishable_warning?: string | null;
      }
      const raw = parseJSON<RawDeliveryResponse>(text);
      return {
        city: raw.city,
        canDeliver: raw.available,
        deliveryDate: raw.next_available_date,
        flatRateLKR: raw.rate,
        warning: raw.reason || raw.perishable_warning || undefined,
      };
    },
    mcpContext
  );
}

/**
 * Pillar 2 — Track a Kapruka order by ID.
 */
export async function trackOrder(orderId: string, mcpContext?: MCPContext): Promise<MCPToolResult<KaprukaTrackingResult>> {
  return safeCallMCPTool(
    "kapruka_track_order",
    {
      params: {
        order_number: orderId,
        response_format: "json",
      },
    },
    (text) => {
      interface RawTrackingStep {
        step: string;
        timestamp: string;
        location?: string;
      }
      interface RawTrackingResponse {
        order_number: string;
        status_display: string;
        delivery_date?: string;
        progress?: RawTrackingStep[];
      }
      let raw: RawTrackingResponse;
      try {
        raw = parseJSON<RawTrackingResponse>(text);
      } catch (e) {
        // Kapruka API returns a plain string (e.g. "Error (ord-xxx)...") if tracking fails
        return {
          orderId,
          currentStatus: "Tracking Not Available",
          steps: [{
            timestamp: new Date().toISOString(),
            status: "Error",
            description: text || "Invalid tracking ID or order not found",
          }]
        };
      }
      
      return {
        orderId: raw.order_number,
        currentStatus: raw.status_display,
        estimatedDelivery: raw.delivery_date,
        steps: (raw.progress || []).map((step) => ({
          timestamp: step.timestamp,
          status: step.step,
          description: step.step,
          location: step.location,
        })),
      };
    },
    mcpContext
  );
}

/**
 * Pillar 2 — Search for valid Kapruka Grasshoppers delivery cities.
 */
export async function listDeliveryCities(
  query: string,
  mcpContext?: MCPContext
): Promise<MCPToolResult<KaprukaCity[]>> {
  return safeCallMCPTool(
    "kapruka_list_delivery_cities",
    {
      params: {
        query,
        response_format: "json",
        limit: 25,
      },
    },
    (text) => {
      interface RawCitiesResponse {
        cities?: Array<{ name: string; aliases?: string[]; province?: string }>;
      }
      const raw = parseJSON<RawCitiesResponse>(text);
      return (raw.cities || []).map((c) => ({
        name: c.name,
        alias: c.aliases?.join(", ") || undefined,
        province: c.province || undefined,
      }));
    },
    mcpContext
  );
}
