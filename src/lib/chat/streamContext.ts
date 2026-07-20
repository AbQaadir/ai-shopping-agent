import { prisma } from "@/lib/db";

export class StreamContext {
  private encoder = new TextEncoder();
  
  constructor(private controller: ReadableStreamDefaultController) {}

  send(payload: Record<string, unknown>) {
    this.controller.enqueue(this.encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  }

  createMcpContext(stepName: string) {
    return {
      onLog: (msg: any) => {
        const text = typeof msg?.data === 'string' ? msg.data : (msg?.data?.message || JSON.stringify(msg?.data || msg));
        this.send({ type: "thought", step: stepName, status: "running", log: text });
      },
      onProgress: (prog: any) => {
        const pct = prog.total ? `${Math.round((prog.progress / prog.total) * 100)}%` : `${prog.progress}`;
        this.send({ type: "thought", step: stepName, status: "running", log: `Processing... (${pct})` });
      }
    };
  }

  async streamWords(text: string) {
    const words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      this.send({ type: "text", content: words[i] + (i === words.length - 1 ? "" : " ") });
      await new Promise((r) => setTimeout(r, 8));
    }
  }

  close() {
    this.controller.close();
  }
}

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

export async function saveOrderMessage(
  sessionId: string,
  text: string,
  orderFlowStepPayload: Record<string, unknown>
) {
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content: text,
      thoughtProcess: JSON.stringify({
        steps: [
          {
            step: "order_agent",
            status: "completed",
            content: `Phase: ${orderFlowStepPayload.phase}`,
            durationMs: 0,
          },
        ],
        intent: "product",
        orderFlowStep: orderFlowStepPayload,
      }),
    },
  });
}
