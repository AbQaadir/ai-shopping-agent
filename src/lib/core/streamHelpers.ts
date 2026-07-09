import { KaprukaTrackingResult } from "@/lib/mcpClient";

/**
 * Stream text word by word using the SSE send function.
 */
export async function streamWords(
  text: string,
  send: (payload: Record<string, unknown>) => void,
  delayMs: number = 22
): Promise<void> {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    send({ type: "text", content: words[i] + (i === words.length - 1 ? "" : " ") });
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

/**
 * Geocode a free-form location text using Google Maps API.
 */
export async function geocodeLocation(
  locationText: string
): Promise<{ lat: number; lng: number; formattedAddress: string; label: string } | null> {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!mapsKey) return null;
  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      locationText + ", Sri Lanka"
    )}&region=lk&key=${mapsKey}`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    if (geoData.status !== "OK" || !geoData.results?.[0]) return null;
    const result = geoData.results[0];
    const { lat, lng } = result.geometry.location;
    const formattedAddress = result.formatted_address;
    const comps = result.address_components || [];
    const label =
      comps.find((c: any) => c.types.includes("locality"))?.long_name ||
      comps.find((c: any) => c.types.includes("administrative_area_level_3"))?.long_name ||
      formattedAddress.split(",")[0];
    return { lat, lng, formattedAddress, label };
  } catch {
    return null;
  }
}

/**
 * Enrich MCP tracking result with our DB order data.
 */
export function enrichTrackingResult(
  rawTracking: KaprukaTrackingResult | null,
  dbOrder: {
    id: string;
    totalLKR: number;
    deliveryDate: string | null;
    personalMessage: string | null;
    items: Array<{ productName: string; quantity: number; priceLKR: number }>;
  }
): KaprukaTrackingResult | null {
  if (!rawTracking) return rawTracking;
  return {
    ...rawTracking,
    displayOrderRef: dbOrder.id,
    displayTotalLKR: dbOrder.totalLKR,
    displayItems: dbOrder.items.map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      priceLKR: i.priceLKR,
    })),
    displayPersonalMessage: dbOrder.personalMessage ?? undefined,
  };
}
