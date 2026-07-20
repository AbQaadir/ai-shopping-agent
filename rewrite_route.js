const fs = require('fs');

const content = fs.readFileSync('src/app/api/chat/route.ts', 'utf-8');

// The top part of the file has all the imports. Let's extract the imports.
// We'll also need to add the new imports from src/lib/chat
// We can just keep the original imports and append the new ones.
const importEndMarker = 'export const POST = withLogging(async function POST(req: NextRequest) {';
const importEndIdx = content.indexOf(importEndMarker);

if (importEndIdx === -1) {
    console.error("import end marker not found");
    process.exit(1);
}

let newImports = `
import { 
  verifyRequestSecurity,
  getOrCreateSession,
  handleEditMessageRollback,
  saveUserMessage,
  fetchUserAddresses,
  getAvailableProducts,
  classifyIntent,
  StreamContext,
  handleCheckoutFlow,
  handleShopFlow,
  ChatHandlerContext,
} from "@/lib/chat";
`;

let topPart = content.substring(0, importEndIdx) + newImports;

// Now we need the start of the POST function up to the ReadableStream
// Wait, a lot of logic was extracted.
// Let's just rewrite the POST function entirely, it's about 150 lines now.

let postFunction = `
export const POST = withLogging(async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    const {
      sessionId: rawSessionId,
      message,
      selectedProductIds, // optional array
      userId,
      editMessageId, // optional: if provided, user is editing a past message
      fetchedSelectedProducts = [], // fully populated selected products from client
      country,
      currency,
    } = body;

    const securityError = verifyRequestSecurity(req, rawSessionId, message);
    if (securityError) {
      return NextResponse.json({ error: securityError.message }, { status: securityError.status });
    }

    const sessionId = rawSessionId.trim();

    // 2. Load or create session
    let session;
    try {
      session = await getOrCreateSession(sessionId, userId, message);
    } catch (err: any) {
      if (err.message.includes("Forbidden")) {
         return NextResponse.json({ error: "Forbidden: You do not have permission to send messages to this shared chat." }, { status: 403 });
      }
      throw err;
    }

    // 3. Handle Message Edit Rollback
    if (editMessageId) {
      await handleEditMessageRollback(editMessageId, message, sessionId, userId, fetchedSelectedProducts);
    } else {
      // Normal flow: save user message
      await saveUserMessage(sessionId, message, fetchedSelectedProducts);
    }

    // 4. Extract conversation history for intent classification
    const recentMsgs = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    const historySnippet = recentMsgs
      .reverse()
      .map((m: any) => \`[\${m.role.toUpperCase()}]: \${m.content}\`)
      .join("\\n");

    // 5. Setup Gemini AI
    const apiKey = config.gemini.apiKey;
    let ai: GoogleGenAI | null = null;
    if (apiKey) {
      ai = new GoogleGenAI({ apiKey });
    }

    const hasSelectedProducts = !!(
      selectedProductIds &&
      Array.isArray(selectedProductIds) &&
      selectedProductIds.length > 0
    );

    // 6. Intent classification
    const intentResult = await classifyIntent(message, historySnippet, ai, hasSelectedProducts);

    // 7. Load checkout state and saved address
    let checkoutState = await getCheckoutState(sessionId);

    // Session Context Initialization
    let sessionContext: any = null;
    try {
      sessionContext = await initSession({
        sessionId: session.id,
        userId: userId ?? null,
        message,
        country: country || "LK",
      });
    } catch (err) {
      console.error("[Session Init] non-fatal error:", err);
    }

    // Fetch user addresses
    let allUserAddresses = await fetchUserAddresses(userId);
    let savedAddr = allUserAddresses.find((a: any) => a.isDefault) || allUserAddresses[0] || null;

    // Fetch available products
    let availableProducts = await getAvailableProducts(sessionId, fetchedSelectedProducts);

    // 8. Call Router Agent
    const routerDecision = await routerAgent(
      message,
      checkoutState,
      hasSelectedProducts,
      intentResult.intent,
      ai,
      config.gemini.fastModel
    );

    // 9. Build SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const streamContext = new StreamContext(controller);

        if (intentResult.isAgeRestricted) {
          streamContext.send({ type: "age_verification_required" });
        }

        if (sessionContext?.resumeMessage) {
          streamContext.send({ type: 'thought', step: 'session_resume', status: 'completed', content: sessionContext.resumeMessage });
        }

        // Build context for handlers
        const handlerCtx: ChatHandlerContext = {
          sessionId,
          userId,
          message,
          checkoutState,
          allUserAddresses,
          savedAddr,
          ai,
          fetchedSelectedProducts,
          availableProducts,
          streamContext,
          intent: intentResult.intent,
          isRelated: intentResult.isRelated,
          llmSearchTerms: intentResult.llmSearchTerms,
          historyTarget: intentResult.historyTarget,
          historyTimeline: intentResult.historyTimeline,
          isAgeRestricted: intentResult.isAgeRestricted,
          historySnippet,
          sessionContext,
          country,
          currency,
          criteria: body.criteria,
        };

        try {
          const handled = await handleCheckoutFlow(routerDecision.action, handlerCtx);
          if (!handled) {
            await handleShopFlow(routerDecision.action, handlerCtx);
          }
        } catch (err: any) {
          console.error("Stream error:", err);
          streamContext.send({ type: "thought", step: "error", status: "completed", content: "An internal error occurred." });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (error: any) {
    console.error("[route.ts] POST Error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Session conflict. Please refresh." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
});
`;

fs.writeFileSync('src/app/api/chat/route_new.ts', topPart + postFunction);
console.log("route_new.ts created!");
