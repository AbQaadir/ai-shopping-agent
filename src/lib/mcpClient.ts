/**
 * mcpClient.ts
 * ---------------------------------------------------------------------------
 * Lightweight, secure MCP (Model Context Protocol) HTTP client for the
 * Kapruka public MCP server (https://mcp.kapruka.com/mcp).
 *
 * Transport: JSON-RPC 2.0 over HTTP POST (stateless, no SSE tunnel needed).
 *
 * Security notes:
 *   - MCP URL is read exclusively from env vars — never hard-coded.
 *   - No authentication headers are embedded in source code.
 *   - Timeout is enforced per-call to prevent hung server-side requests.
 *   - Errors are sanitised before logging (no raw response bodies in prod).
 * ---------------------------------------------------------------------------
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface MCPToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Raw JSON-RPC 2.0 response shape returned by the MCP server */
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content?: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
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

// ── Core MCP Client ────────────────────────────────────────────────────────

let _requestId = 1;

/**
 * Generic MCP tool caller.
 * Sends a JSON-RPC 2.0 `tools/call` request to the Kapruka MCP server.
 *
 * @param toolName - Exact MCP tool name (e.g. "kapruka_search_products")
 * @param args     - Tool arguments object
 * @returns Parsed tool result text or throws on error
 */
async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const mcpUrl = process.env.KAPRUKA_MCP_URL;
  if (!mcpUrl) {
    throw new Error("KAPRUKA_MCP_URL is not set in environment variables");
  }

  const timeoutMs = parseInt(process.env.KAPRUKA_MCP_TIMEOUT_MS || "10000", 10);

  const body = {
    jsonrpc: "2.0",
    id: _requestId++,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  // Enforce a per-request timeout using AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (fetchErr: unknown) {
    clearTimeout(timer);
    const msg = fetchErr instanceof Error ? fetchErr.message : "Unknown network error";
    // Sanitise — don't expose internal URL in client-facing errors
    throw new Error(`MCP network error for tool "${toolName}": ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status} for tool "${toolName}"`);
  }

  const contentType = response.headers.get("content-type") || "";

  let rawText: string;

  // MCP may respond with text/event-stream (SSE) or application/json
  if (contentType.includes("text/event-stream")) {
    // Read SSE stream and collect the last data event
    const text = await response.text();
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s*/, "").trim())
      .filter(Boolean);
    rawText = dataLines[dataLines.length - 1] || "{}";
  } else {
    rawText = await response.text();
  }

  let json: JsonRpcResponse;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`MCP returned non-JSON response for tool "${toolName}"`);
  }

  if (json.error) {
    throw new Error(`MCP tool error [${json.error.code}]: ${json.error.message}`);
  }

  if (!json.result) {
    throw new Error(`MCP returned empty result for tool "${toolName}"`);
  }

  if (json.result.isError) {
    const errText = json.result.content?.[0]?.text || "Unknown tool error";
    throw new Error(`MCP tool "${toolName}" returned error: ${errText}`);
  }

  return json.result.content?.[0]?.text || "";
}

/**
 * Safe wrapper — catches errors and returns a typed MCPToolResult.
 * Use this in tool functions that should not hard-crash the SSE stream.
 */
async function safeCallMCPTool<T>(
  toolName: string,
  args: Record<string, unknown>,
  parser: (text: string) => T
): Promise<MCPToolResult<T>> {
  try {
    const text = await callMCPTool(toolName, args);
    const data = parser(text);
    return { success: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Unknown MCP error";
    console.error(`[MCP] ${toolName} failed:`, error);
    return { success: false, error };
  }
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
    category?: string;
    maxPrice?: number;
    inStockOnly?: boolean;
    page?: number;
  } = {}
): Promise<MCPToolResult<KaprukaProduct[]>> {
  const args: Record<string, unknown> = { query };
  if (options.category) args.category = options.category;
  if (options.maxPrice !== undefined) args.max_price = options.maxPrice;
  if (options.inStockOnly !== undefined) args.in_stock = options.inStockOnly;
  if (options.page !== undefined) args.page = options.page;

  return safeCallMCPTool("kapruka_search_products", args, (text) => {
    const raw = parseJSON<{ products?: KaprukaProduct[]; items?: KaprukaProduct[] }>(text);
    return (raw.products || raw.items || []) as KaprukaProduct[];
  });
}

/**
 * Pillar 1 — Get full details for a specific Kapruka product.
 */
export async function getProduct(productId: string): Promise<MCPToolResult<KaprukaProduct>> {
  return safeCallMCPTool("kapruka_get_product", { product_id: productId }, (text) => {
    return parseJSON<KaprukaProduct>(text);
  });
}

/**
 * Pillar 1 — List all top-level Kapruka categories.
 */
export async function listCategories(): Promise<MCPToolResult<KaprukaCategory[]>> {
  return safeCallMCPTool("kapruka_list_categories", {}, (text) => {
    const raw = parseJSON<{ categories?: KaprukaCategory[] }>(text);
    return raw.categories || [];
  });
}

/**
 * Pillar 1 — Create a guest checkout order.
 * Returns a 60-minute locked click-to-pay URL.
 *
 * Security: recipient info is passed through only — never stored in source code.
 */
export async function createOrder(
  productId: string,
  quantity: number,
  recipient: {
    name: string;
    phone: string;
    address: string;
    city: string;
  }
): Promise<MCPToolResult<KaprukaOrderResult>> {
  return safeCallMCPTool(
    "kapruka_create_order",
    {
      product_id: productId,
      quantity,
      recipient_name: recipient.name,
      recipient_phone: recipient.phone,
      delivery_address: recipient.address,
      delivery_city: recipient.city,
    },
    (text) => parseJSON<KaprukaOrderResult>(text)
  );
}

/**
 * Pillar 2 — Check if Kapruka Grasshoppers can deliver to a city on a date.
 */
export async function checkDelivery(
  city: string,
  date: string,          // YYYY-MM-DD
  isPerishable = false
): Promise<MCPToolResult<KaprukaDeliveryResult>> {
  return safeCallMCPTool(
    "kapruka_check_delivery",
    { city, date, is_perishable: isPerishable },
    (text) => parseJSON<KaprukaDeliveryResult>(text)
  );
}

/**
 * Pillar 2 — Track a Kapruka order by ID.
 */
export async function trackOrder(orderId: string): Promise<MCPToolResult<KaprukaTrackingResult>> {
  return safeCallMCPTool(
    "kapruka_track_order",
    { order_id: orderId },
    (text) => parseJSON<KaprukaTrackingResult>(text)
  );
}

/**
 * Pillar 2 — Search for valid Kapruka Grasshoppers delivery cities.
 */
export async function listDeliveryCities(
  query: string
): Promise<MCPToolResult<KaprukaCity[]>> {
  return safeCallMCPTool("kapruka_list_delivery_cities", { query }, (text) => {
    const raw = parseJSON<{ cities?: KaprukaCity[] }>(text);
    return raw.cities || [];
  });
}
