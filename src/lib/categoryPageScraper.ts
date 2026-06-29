/**
 * @module categoryPageScraper
 *
 * Server-side scraper for Kapruka.com category pages.
 *
 * This module is a TypeScript port of the original Python category scraper.
 * It extracts product listings from Kapruka category/browse pages using two
 * complementary strategies:
 *
 * 1. **__NEXT_DATA__ extraction (preferred)** — Parses the embedded Next.js
 *    hydration payload (`<script id="__NEXT_DATA__">`) which contains the full
 *    product array in `props.pageProps.products`.
 *
 * 2. **DOM fallback** — When the hydration payload is absent, the scraper falls
 *    back to iterating `.catalogueV2Repeater` elements and pulls data from
 *    JSON-LD blocks, anchor `data-*` attributes, and visible DOM nodes.
 *
 * Both strategies normalise output into the {@link ScrapedProduct} interface,
 * which mirrors the project's {@link KaprukaProduct} shape.
 *
 * @example
 * ```ts
 * import { scrapeProductsFromCategoryUrl } from '@/lib/categoryPageScraper';
 *
 * const products = await scrapeProductsFromCategoryUrl(
 *   'https://www.kapruka.com/shops/specialoccasions/birthday-gifts.asp',
 * );
 * console.log(products.length, 'products scraped');
 * ```
 */

import * as cheerio from 'cheerio';
import { config } from './config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A product extracted from a Kapruka category page.
 *
 * The shape intentionally mirrors `KaprukaProduct` from `mcpClient.ts` so that
 * scraped data can be used interchangeably with MCP-sourced data.
 */
export interface ScrapedProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  url?: string;
  inStock: boolean;
  category?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Browser-like User-Agent to avoid bot-detection blocks. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Timeout (ms) for each HTTP request. */
const FETCH_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely reads a nested property from an object using a dot-separated path.
 *
 * @param obj  - The source object.
 * @param path - Dot-separated key path, e.g. `"price.amount"`.
 * @returns The resolved value, or `undefined` if any segment is missing.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Converts a raw `__NEXT_DATA__` product object into a {@link ScrapedProduct}.
 *
 * Handles the common field-name variations found across different Kapruka
 * category responses.
 */
function normalizeRawProduct(raw: Record<string, unknown>): ScrapedProduct | null {
  // --- name (required) ---
  const name = (raw['name'] ?? raw['title'] ?? '') as string;
  if (!name) return null;

  // --- id ---
  const id = String(raw['id'] ?? raw['productId'] ?? '');

  // --- price ---
  let price = 0;
  if (typeof raw['price'] === 'number') {
    price = raw['price'];
  } else if (raw['price'] && typeof raw['price'] === 'object') {
    const priceObj = raw['price'] as Record<string, unknown>;
    price = typeof priceObj['amount'] === 'number' ? priceObj['amount'] : 0;
  }

  // --- currency ---
  let currency = 'LKR';
  if (typeof raw['currency'] === 'string') {
    currency = raw['currency'];
  } else if (raw['price'] && typeof raw['price'] === 'object') {
    const priceObj = raw['price'] as Record<string, unknown>;
    if (typeof priceObj['currency'] === 'string') {
      currency = priceObj['currency'];
    }
  }

  // --- imageUrl ---
  const imageUrl = (raw['image'] ?? raw['imageUrl'] ?? raw['image_url'] ?? undefined) as
    | string
    | undefined;

  // --- url ---
  const url = (raw['url'] ?? raw['link'] ?? undefined) as string | undefined;

  // --- inStock ---
  const inStockRaw = raw['inStock'] ?? raw['in_stock'];
  const inStock = inStockRaw !== undefined ? Boolean(inStockRaw) : true;

  // --- category ---
  let category: string | undefined;
  if (typeof raw['category'] === 'string') {
    category = raw['category'];
  } else if (raw['category'] && typeof raw['category'] === 'object') {
    category = (raw['category'] as Record<string, unknown>)['name'] as string | undefined;
  }

  // --- description ---
  const description = (raw['description'] ?? raw['summary'] ?? undefined) as
    | string
    | undefined;

  return { id, name, price, currency, imageUrl, url, inStock, category, description };
}

/**
 * Normalises an array of raw product objects from `__NEXT_DATA__` into
 * {@link ScrapedProduct ScrapedProduct[]}, discarding entries that lack a name.
 */
function normalizeProducts(rawProducts: Record<string, unknown>[]): ScrapedProduct[] {
  const results: ScrapedProduct[] = [];
  for (const raw of rawProducts) {
    const product = normalizeRawProduct(raw);
    if (product) {
      results.push(product);
    }
  }
  return results;
}

/**
 * Extracts products from the Next.js `__NEXT_DATA__` script tag.
 *
 * @returns An array of {@link ScrapedProduct} if the tag exists and contains
 *          products, otherwise `null` so the caller can fall back to DOM parsing.
 */
function extractFromNextData($: cheerio.CheerioAPI): ScrapedProduct[] | null {
  const scriptEl = $('script#__NEXT_DATA__');
  if (!scriptEl.length) return null;

  try {
    const json = JSON.parse(scriptEl.html() ?? '{}') as Record<string, unknown>;
    const products = getNestedValue(json, 'props.pageProps.products');
    if (Array.isArray(products) && products.length > 0) {
      return normalizeProducts(products as Record<string, unknown>[]);
    }
  } catch {
    // Malformed JSON — fall through to DOM strategy.
  }

  return null;
}

/**
 * Parses a price string like `"Rs. 3,450.00"` or `"LKR 2500"` into a number.
 *
 * @returns The numeric price, or `0` if parsing fails.
 */
function parsePrice(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Extracts products from the DOM by iterating `.catalogueV2Repeater` elements.
 *
 * For each repeater the function tries three data sources in order:
 * 1. Embedded `<script type="application/ld+json">` (JSON-LD)
 * 2. Anchor tag `data-dfid` / `data-dfcustomresultid` attributes
 * 3. Visible DOM elements (heading, price, image)
 */
function extractFromDom($: cheerio.CheerioAPI): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];

  $('.catalogueV2Repeater').each((_idx, el) => {
    const $card = $(el);

    let name = '';
    let price = 0;
    let currency = 'LKR';
    let imageUrl: string | undefined;
    let url: string | undefined;
    let inStock = true;
    let id = '';

    // --- 1. JSON-LD ---
    const ldScript = $card.find('script[type="application/ld+json"]');
    if (ldScript.length) {
      try {
        const ld = JSON.parse(ldScript.html() ?? '{}') as Record<string, unknown>;
        name = (ld['name'] as string) ?? '';
        imageUrl = (ld['image'] as string) ?? undefined;
        url = (ld['url'] as string) ?? undefined;

        const offers = ld['offers'] as Record<string, unknown> | undefined;
        if (offers) {
          const offerPrice = offers['price'];
          price =
            typeof offerPrice === 'number'
              ? offerPrice
              : typeof offerPrice === 'string'
                ? parsePrice(offerPrice)
                : 0;
          currency = (offers['priceCurrency'] as string) ?? 'LKR';
          const availability = (offers['availability'] as string) ?? '';
          inStock = !availability.toLowerCase().includes('outofstock');
        }
      } catch {
        // Invalid JSON-LD — continue to other sources.
      }
    }

    // --- 2. Anchor data-attributes & href ---
    const anchor = $card.find('a[data-dfid], a[data-dfcustomresultid], a[href]').first();
    if (anchor.length) {
      id = id || (anchor.attr('data-dfid') ?? anchor.attr('data-dfcustomresultid') ?? '');
      url = url || anchor.attr('href') || undefined;
    }

    // --- 3. Fallback DOM elements ---
    if (!name) {
      const headingEl = $card.find('.catalogueV2heading');
      name = headingEl.text().trim();
    }

    if (price === 0) {
      const priceEl = $card.find('.CatalogueV2price, .catalogueV2converted').first();
      if (priceEl.length) {
        price = parsePrice(priceEl.text());
      }
    }

    if (!imageUrl) {
      const imgEl = $card.find('img').first();
      imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || undefined;
    }

    // Only include products that have at least a name.
    if (name) {
      products.push({ id, name, price, currency, imageUrl, url, inStock });
    }
  });

  return products;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches a single Kapruka category page URL and extracts products.
 *
 * The function first attempts to read the `__NEXT_DATA__` hydration payload
 * (Method 1). If that is unavailable or empty it falls back to DOM-based
 * extraction via `.catalogueV2Repeater` elements (Method 2).
 *
 * @param url - Full URL of a Kapruka category / browse page.
 * @returns A promise that resolves to the array of scraped products.
 *
 * @example
 * ```ts
 * const products = await scrapeProductsFromCategoryUrl(
 *   'https://www.kapruka.com/shops/specialoccasions/birthday-gifts.asp',
 * );
 * ```
 */
export async function scrapeProductsFromCategoryUrl(
  url: string,
  options?: { country?: string }
): Promise<ScrapedProduct[]> {
  let html = '';
  let usedBrightData = false;

  const targetCountry = options?.country?.toUpperCase() || 'LK';

  if (targetCountry === 'LK' && config.brightData.apiKey && config.brightData.zone) {
    try {
      console.log(`[categoryPageScraper] Fetching ${url} via Bright Data targeting LK...`);
      const bdResponse = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.brightData.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone: config.brightData.zone,
          url: url,
          format: 'raw',
          country: 'lk'
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (bdResponse.ok) {
        html = await bdResponse.text();
        usedBrightData = true;
      } else {
        console.warn(`[categoryPageScraper] Bright Data returned status ${bdResponse.status}. Falling back to direct fetch.`);
      }
    } catch (err) {
      console.warn(`[categoryPageScraper] Bright Data fetch failed: ${(err as Error).message}. Falling back to direct fetch.`);
    }
  }

  if (!usedBrightData) {
    console.log(`[categoryPageScraper] Fetching ${url} directly...`);
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[categoryPageScraper] HTTP ${response.status} for ${url}`,
      );
      return [];
    }

    html = await response.text();
  }

  const $ = cheerio.load(html);

  // Method 1 — __NEXT_DATA__
  const nextDataProducts = extractFromNextData($);
  if (nextDataProducts !== null && nextDataProducts.length > 0) {
    return nextDataProducts;
  }

  // Method 2 — DOM fallback
  return extractFromDom($);
}

/**
 * Rate-limited orchestrator that scrapes multiple Kapruka category URLs.
 *
 * URLs are fetched **sequentially** with a configurable stagger delay to
 * avoid overwhelming the server. Errors for individual URLs are caught and
 * logged — the orchestrator never throws.
 *
 * @param urls           - Array of `{ url, label }` objects to scrape.
 * @param maxConcurrent  - Maximum concurrent requests (reserved for future
 *                         parallel mode; currently sequential). Defaults to `3`.
 * @param staggerMs      - Milliseconds to wait between consecutive fetches.
 *                         Defaults to `150`.
 * @returns An array matching the input order, each entry containing the label
 *          and the scraped products (empty array on failure).
 *
 * @example
 * ```ts
 * const results = await scrapeMultipleCategoryUrls([
 *   { url: 'https://www.kapruka.com/shops/birthday-gifts.asp', label: 'Birthday' },
 *   { url: 'https://www.kapruka.com/shops/cakes.asp', label: 'Cakes' },
 * ]);
 * for (const { label, products } of results) {
 *   console.log(`${label}: ${products.length} products`);
 * }
 * ```
 */
export async function scrapeMultipleCategoryUrls(
  urls: Array<{ url: string; label: string }>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  maxConcurrent: number = 3,
  staggerMs: number = 150,
  options?: { country?: string }
): Promise<Array<{ label: string; products: ScrapedProduct[] }>> {
  const results: Array<{ label: string; products: ScrapedProduct[] }> = [];

  for (let i = 0; i < urls.length; i++) {
    const { url, label } = urls[i];

    try {
      const products = await scrapeProductsFromCategoryUrl(url, options);
      results.push({ label, products });
    } catch (error) {
      console.warn(
        `[categoryPageScraper] Failed to scrape "${label}" (${url}):`,
        error instanceof Error ? error.message : error,
      );
      results.push({ label, products: [] });
    }

    // Stagger delay between requests (skip after the last one).
    if (i < urls.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, staggerMs));
    }
  }

  return results;
}
