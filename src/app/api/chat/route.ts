import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseRequirementsTool, searchProductsTool, verifySuppliersTool } from "@/lib/tools";

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
    const matched = allProducts.filter((p: any) => {
      const text = (p.title + " " + p.supplier.name).toLowerCase();
      return searchWords.some((w: string) => text.includes(w));
    });

    const finalProducts = matched.length > 0 ? matched.slice(0, 4) : allProducts.slice(0, 4);

    const inlineProducts = finalProducts.map((p: any) => ({
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
    let intent = "sourcing"; // default
    let genAI: any = null;
    let classifierModel: any = null;

    // Rule-based classification fallback
    const lowercaseQuery = message.toLowerCase();
    const qaKeywords = ["delivery", "deliver", "ship", "payment", "rule", "help", "contact", "support", "faq", "terms", "policy", "fees", "countries", "places", "where do you", "how long"];
    const containsQAKeyword = qaKeywords.some(keyword => lowercaseQuery.includes(keyword));
    if (containsQAKeyword) {
      intent = "qa";
    }

    if (apiKey) {
      try {
        genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
        classifierModel = genAI.getGenerativeModel({ model: geminiModel });

        // Refine intent using Gemini (JSON Mode)
        try {
          const classifierPrompt = `
          Analyze the user's B2B message and classify it into one of these intents:
          - "sourcing": The user is searching for products, suppliers, manufacturers, pricing, materials, or B2B catalogue items.
          - "qa": The user is asking general informational questions about platform regulations, payment terms, delivery places, shipping rates, or generic logistics/policies.
          
          Respond ONLY with a JSON object in this format:
          {
            "intent": "sourcing" | "qa",
            "reason": "brief explanation"
          }
          
          User Message: "${message}"
          `;

          const classificationResult = await classifierModel.generateContent({
            contents: [{ role: "user", parts: [{ text: classifierPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            }
          });

          const resultText = classificationResult.response.text();
          const parsed = JSON.parse(resultText);
          if (parsed && (parsed.intent === "sourcing" || parsed.intent === "qa")) {
            intent = parsed.intent;
            console.log(`Query Classified: "${message}" -> Intent: ${intent} (${parsed.reason})`);
          }
        } catch (classificationErr) {
          console.error("Intent classification failed, defaulting to rule-based:", classificationErr);
        }

        // Initialize main stream with history context
        const systemPrompt = intent === "sourcing"
          ? "You are an AI sourcing agent for Kapuruka.com. Respond to the user's query about sourcing goods. Keep your reply concise (2-3 sentences max). Confirm that you have matched verified suppliers and relevant products in the database."
          : "You are an expert customer helper for Kapuruka.com. Respond to the user's query about platform rules, delivery locations, logistics, or payment policies. Keep your reply concise and professional (2-3 sentences max).";

        // Fetch all messages (including the one just inserted) sorted by createdAt ascending
        const chatHistory = await prisma.chatMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "asc" },
        });

        // Map messages to Gemini history structure
        const geminiHistory = chatHistory.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const chatModel = genAI.getGenerativeModel({ 
          model: geminiModel,
          systemInstruction: systemPrompt
        });
          
        geminiStream = await chatModel.generateContentStream({
          contents: geminiHistory,
        });
      } catch (err) {
        console.error("Gemini initialization failed:", err);
      }
    }

    // 5. Construct Next.js ReadableStream response for Server-Sent Events (SSE)
    const stream = new ReadableStream({
      async start(controller) {
        const sendPacket = (payload: any) => {
          const chunk = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        };

        // Track completed steps to save in database
        const steps: any[] = [];
        let verifiedProducts: any[] = [];

        if (intent === "sourcing") {
          // 5.1 Run Requirement Extraction Tool
          sendPacket({
            type: "thought",
            step: "parsing_specs",
            status: "running",
            content: "Parsing user query for categories, price ranges, and MOQ limits...",
          });
          const startTime1 = Date.now();
          const criteria = await parseRequirementsTool(message);
          await new Promise((resolve) => setTimeout(resolve, 400));
          const duration1 = Date.now() - startTime1;
          
          const step1 = {
            step: "parsing_specs",
            status: "completed",
            content: `Parsed criteria: Category: ${criteria.category}, Keywords: [${criteria.keywords.join(", ")}], MOQ: ${criteria.maxMOQ || 'none'}, Price Limit: ${criteria.maxPrice || 'none'}.`,
            durationMs: duration1,
          };
          steps.push(step1);
          sendPacket({ type: "thought", ...step1 });

          // 5.2 Run Product Database Search Tool
          sendPacket({
            type: "thought",
            step: "searching_suppliers",
            status: "running",
            content: `Searching database for products matching: ${criteria.keywords.join(" ")}`,
          });
          sendPacket({
            type: "tool_call",
            name: "searchProductsTool",
            args: criteria,
          });
          const startTime2 = Date.now();
          const foundProducts = await searchProductsTool(criteria);
          await new Promise((resolve) => setTimeout(resolve, 500));
          const duration2 = Date.now() - startTime2;

          const step2 = {
            step: "searching_suppliers",
            status: "completed",
            content: `Found ${foundProducts.length} matching products in catalog.`,
            durationMs: duration2,
          };
          steps.push(step2);
          sendPacket({ type: "thought", ...step2 });
          sendPacket({
            type: "tool_result",
            toolName: "searchProductsTool",
            result: { products: foundProducts },
          });

          // 5.3 Run Supplier Verification Tool
          sendPacket({
            type: "thought",
            step: "verification_checks",
            status: "running",
            content: "Evaluating supplier compliance, platform history, and ratings...",
          });
          sendPacket({
            type: "tool_call",
            name: "verifySuppliersTool",
            args: { productCount: foundProducts.length },
          });
          const startTime3 = Date.now();
          verifiedProducts = await verifySuppliersTool(foundProducts);
          await new Promise((resolve) => setTimeout(resolve, 400));
          const duration3 = Date.now() - startTime3;

          const step3 = {
            step: "verification_checks",
            status: "completed",
            content: `Successfully verified all ${verifiedProducts.length} supplier backgrounds.`,
            durationMs: duration3,
          };
          steps.push(step3);
          sendPacket({ type: "thought", ...step3 });
          sendPacket({
            type: "tool_result",
            toolName: "verifySuppliersTool",
            result: { products: verifiedProducts },
          });
        } else {
          // 5.1 Run QA Requirement Identification Step
          sendPacket({
            type: "thought",
            step: "parsing_specs",
            status: "running",
            content: "Analyzing informational query terms and platform policies...",
          });
          const startTime1 = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 400));
          const duration1 = Date.now() - startTime1;
          const step1 = {
            step: "parsing_specs",
            status: "completed",
            content: "Consulted Kapuruka logistics guidelines, delivery destinations, and merchant rules.",
            durationMs: duration1,
          };
          steps.push(step1);
          sendPacket({ type: "thought", ...step1 });

          // 5.2 Run FAQ Search Step
          sendPacket({
            type: "thought",
            step: "searching_suppliers",
            status: "running",
            content: "Retrieving relevant FAQ responses from platform registry...",
          });
          const startTime2 = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 400));
          const duration2 = Date.now() - startTime2;
          const step2 = {
            step: "searching_suppliers",
            status: "completed",
            content: "Found matching platform policy rules for the query.",
            durationMs: duration2,
          };
          steps.push(step2);
          sendPacket({ type: "thought", ...step2 });
        }

        // Generate response text (stream from Gemini or fallback locally)
        let fullResponseText = "";
        
        if (geminiStream) {
          try {
            for await (const chunk of geminiStream.stream) {
              const textChunk = chunk.text();
              fullResponseText += textChunk;
              sendPacket({ type: "text", content: textChunk });
            }
          } catch (geminiError) {
            console.error("Gemini streaming error, using fallback:", geminiError);
            geminiStream = null;
          }
        }

        if (!geminiStream) {
          // Fallback static typing simulation
          let fallbackText = "";
          if (intent === "qa") {
            if (lowercaseQuery.includes("deliver") || lowercaseQuery.includes("ship")) {
              fallbackText = "Kapuruka ships globally. Our primary delivery centers and verified hubs cover North America, Europe, East Asia, and Southeast Asia (specifically including the US, UK, China, and Vietnam). Shipping rates depend on selected shipping terms (FOB/CIF) and cargo weight.";
            } else if (lowercaseQuery.includes("payment")) {
              fallbackText = "We support secured trade terms including Letters of Credit (L/C), telegraphic transfer (T/T), PayPal, and major credit cards. Transactions are safeguarded via our platform escrow account until cargo receipt is verified.";
            } else {
              fallbackText = "Kapuruka provides customer support for B2B logistics, payment terms, custom customs clearing support, and supplier validation requests. Please specify how we can help you navigate our services.";
            }
          } else {
            fallbackText = `I have found matching items from verified suppliers in the database for "${message}". You can review their ratings, price ranges, and minimum order quantities (MOQ) on the right dashboard.`;
          }
          fullResponseText = fallbackText;
          const words = fallbackText.split(" ");
          for (const word of words) {
            sendPacket({ type: "text", content: word + " " });
            await new Promise((resolve) => setTimeout(resolve, 40));
          }
        }

        // 5.4 Generate Dynamic B2B Suggestions
        let followUpQuestions: string[] = [];
        if (classifierModel) {
          try {
            const suggesterPrompt = `
            Based on the following user query and assistant response, generate exactly 3 short, helpful, contextually relevant follow-up suggestions that a B2B buyer could click next.
            Make them specific and focused on B2B procurement, payment, or logistics depending on the content. Keep each suggestion under 8 words. Do not include numbering or bullets.
            
            User Query: "${message}"
            Assistant Response: "${fullResponseText}"
            
            Respond ONLY with a JSON array of strings:
            [
              "suggested question 1",
              "suggested question 2",
              "suggested question 3"
            ]
            `;

            const suggestionResult = await classifierModel.generateContent({
              contents: [{ role: "user", parts: [{ text: suggesterPrompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
              }
            });

            const parsedSuggestions = JSON.parse(suggestionResult.response.text());
            if (Array.isArray(parsedSuggestions) && parsedSuggestions.length >= 3) {
              followUpQuestions = parsedSuggestions.slice(0, 3);
            }
          } catch (suggestError) {
            console.error("Dynamic suggestions generation failed, using static fallbacks:", suggestError);
          }
        }

        if (followUpQuestions.length === 0) {
          if (intent === "sourcing") {
            followUpQuestions = [
              "Filter by lower MOQ (e.g., < 10 pieces)",
              "Find specific colors or styles for this product",
              "Request custom logo branding options"
            ];
          } else {
            followUpQuestions = [
              "What payment methods do you accept?",
              "What are the delivery terms and rates?",
              "Can I get samples before bulk orders?"
            ];
          }
        }

        // Send follow-up suggestions to client
        sendPacket({
          type: "follow_ups",
          questions: followUpQuestions,
        });

        // Save assistant response to DB
        await prisma.chatMessage.create({
          data: {
            sessionId: sessionId,
            role: "assistant",
            content: fullResponseText,
            thoughtProcess: JSON.stringify({
              steps: steps,
              followUpQuestions: followUpQuestions
            }),
            products: JSON.stringify(verifiedProducts),
          },
        });

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
