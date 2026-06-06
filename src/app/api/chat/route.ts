import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: "Missing sessionId or message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Ensure the chat session exists
    let session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      session = await prisma.chatSession.create({
        data: {
          id: sessionId,
          title: message.substring(0, 45) || "New Sourcing Task",
          status: "active",
        },
      });
    }

    // 2. Save user message to database
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message,
      },
    });

    // 3. Match database products based on query keywords
    const allProducts = await prisma.product.findMany({
      include: { supplier: true },
    });

    const searchWords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const matched = allProducts.filter((p) => {
      const text = (p.title + " " + p.supplier.name).toLowerCase();
      return searchWords.some((w: string) => text.includes(w));
    });

    const finalProducts = matched.length > 0 ? matched.slice(0, 4) : allProducts.slice(0, 4);

    const inlineProducts = finalProducts.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.priceRange,
      moq: `${p.minOrderQuantity} pieces`,
      supplier: p.supplier.name,
      location: p.supplier.countryCode,
      years: p.supplier.yearsOnPlatform,
      verified: p.supplier.rating >= 4.7,
      image: p.title.toLowerCase().includes("moon") ? "🌙" : p.title.toLowerCase().includes("swivel") ? "🔄" : "🏕️",
      bgColor: "bg-slate-50",
    }));

    // 4. Setup Gemini SDK if API Key is available
    const apiKey = process.env.GEMINI_API_KEY;
    let geminiStream: any = null;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const systemPrompt = "You are an AI sourcing agent for Kapuruka.com (a premium sourcing and shopping platform). Respond to the user's query about sourcing goods. Keep your reply concise (2-3 sentences max). Confirm that you have matched verified suppliers and relevant products in the database.";
        geminiStream = await model.generateContentStream({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\nUser Query: ${message}` }] },
          ],
        });
      } catch (err) {
        console.error("Gemini initialization failed:", err);
      }
    }

    // 5. Construct Next.js ReadableStream response for Server-Sent Events (SSE)
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        // Stream AI Thinking Steps
        const steps = [
          { status: "parsing_specs" },
          { status: "searching_suppliers" },
          { status: "analyzing_items" },
          { status: "verification_checks" },
        ];

        for (const step of steps) {
          sendEvent("step", step);
          await new Promise((resolve) => setTimeout(resolve, 350));
        }

        // Generate response text (stream from Gemini or fallback locally)
        let fullResponseText = "";
        
        if (geminiStream) {
          try {
            for await (const chunk of geminiStream.stream) {
              const textChunk = chunk.text();
              fullResponseText += textChunk;
              sendEvent("text", textChunk);
            }
          } catch (geminiError) {
            console.error("Gemini streaming error, using fallback:", geminiError);
            geminiStream = null;
          }
        }

        if (!geminiStream) {
          // Fallback static typing simulation
          const fallbackText = `I have found matching items from verified suppliers in the database for "${message}". You can review their ratings, price ranges, and minimum order quantities (MOQ) on the right dashboard.`;
          fullResponseText = fallbackText;
          const words = fallbackText.split(" ");
          for (const word of words) {
            sendEvent("text", word + " ");
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
        }

        // Save assistant response to DB
        await prisma.chatMessage.create({
          data: {
            sessionId: sessionId,
            role: "assistant",
            content: fullResponseText,
            thoughtProcess: JSON.stringify(steps),
            products: JSON.stringify(inlineProducts),
          },
        });

        // Send matched products payload
        sendEvent("products", inlineProducts);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
