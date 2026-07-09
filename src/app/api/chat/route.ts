import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logger";

// Core Modules
import { ensureSession, saveUserMessage, rollbackToMessage, getConversationHistory, saveAssistantMessage } from "@/lib/core/session";
import { classifyIntent } from "@/lib/core/intent";
import { buildContextWindow } from "@/lib/core/context";
import { makeDecision } from "@/lib/core/decision";
import { executePlan } from "@/lib/core/toolPlanner";
import { streamMainResponse } from "@/lib/core/responseStream";
import { buildOrderFlowThoughtProcess, buildShopThoughtProcess, ThoughtStep } from "@/lib/core/thoughtProcess";
import { getCheckoutState, saveCheckoutState, clearCheckoutState } from "@/lib/checkoutContext";
import { streamWords } from "@/lib/core/streamHelpers";

// Agents
import { routerAgent } from "@/lib/agents/routerAgent";
import { orderAgent } from "@/lib/agents/orderAgent";
import { cartModifierAgent } from "@/lib/agents/cartModifierAgent";
import { categoryBrowseAgent } from "@/lib/agents/categoryBrowseAgent";

// Tools
import { getCachedCategories, pillar1_getProductDetails, KaprukaProduct } from "@/lib/tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const POST = withLogging(async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, message, userId, country, currency, selectedProductIds, editMessageId } = body;

    if (!sessionId || !message) {
      return new Response(JSON.stringify({ error: "Missing sessionId or message" }), { status: 400 });
    }

    const { session } = await ensureSession(sessionId, userId, message);

    let fetchedSelectedProducts: KaprukaProduct[] = [];
    if (selectedProductIds && Array.isArray(selectedProductIds) && selectedProductIds.length > 0) {
      const detailsList = await Promise.all(selectedProductIds.map(id => pillar1_getProductDetails(id).catch(() => null)));
      fetchedSelectedProducts = detailsList.filter((p): p is KaprukaProduct => p !== null);
    }

    let checkoutState = await getCheckoutState(sessionId);

    if (editMessageId) {
      const rollback = await rollbackToMessage(editMessageId, sessionId, userId, fetchedSelectedProducts);
      checkoutState = rollback.checkoutState;
    } else {
      await saveUserMessage(sessionId, message, fetchedSelectedProducts);
    }

    const rawHistory = await getConversationHistory(sessionId);
    
    const apiKey = config.gemini.apiKey;
    const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

    const hasSelectedProducts = fetchedSelectedProducts.length > 0;
    const contextWindow = await buildContextWindow(sessionId, message, rawHistory);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const intentClassification = await classifyIntent(message, contextWindow.historySnippet, hasSelectedProducts, ai!, config.gemini.fastModel);
        if (intentClassification.isAgeRestricted) send({ type: "age_verification_required" });

        const availableProducts = [...contextWindow.productMemory];
        fetchedSelectedProducts.forEach(fp => {
          if (!availableProducts.some(ap => ap.id === fp.id)) availableProducts.push(fp);
        });

        let allUserAddresses: any[] = [];
        if (userId && userId !== "guest") {
          try {
            const userRec = await prisma.user.findUnique({ where: { id: userId } });
            if (userRec?.addresses && Array.isArray(userRec.addresses)) {
              allUserAddresses = userRec.addresses as any[];
            }
          } catch (e) {}
        }
        const savedAddressLabels = allUserAddresses.map((a: any) => a.label || a.type);

        let routerDecision = { action: "shop" as any, reason: "Fallback" };
        if (ai) {
           routerDecision = await routerAgent(
             message,
             contextWindow.historySnippet,
             checkoutState,
             intentClassification.intent,
             ai,
             config.gemini.fastModel,
             savedAddressLabels,
             availableProducts
           );
        }

        const decision = await makeDecision(intentClassification, contextWindow, routerDecision.action, checkoutState);

        const saveOrderMessage = async (text: string, ofs: Record<string, unknown>, steps: ThoughtStep[] = []) => {
          const tp = buildOrderFlowThoughtProcess(String(ofs.phase || "unknown"), ofs as any);
          tp.steps = steps;
          await saveAssistantMessage(sessionId, text, tp);
        };

        const saveShopMessage = async (text: string, steps: ThoughtStep[] = [], intent: string) => {
          const tp = buildShopThoughtProcess({ intent, steps });
          await saveAssistantMessage(sessionId, text, tp);
        };

        if (decision.clarificationNeeded) {
           await streamWords(decision.clarificationNeeded, send);
           await saveShopMessage(decision.clarificationNeeded, [], intentClassification.intent);
           controller.close();
           return;
        }

        const action = routerDecision.action;
        const fastModel = config.gemini.fastModel;
        const reasoningModel = config.gemini.reasoningModel;

        if (action === "checkout_cancel") {
          await clearCheckoutState(sessionId);
          const ofs = { phase: "cancelled", cartItems: [] };
          send({ type: "order_flow_step", ...ofs });
          const text = "Checkout cancelled.";
          await streamWords(text, send);
          await saveOrderMessage(text, ofs);
        } else if (action === "checkout_continue" && checkoutState) {
          const result = await orderAgent(message, checkoutState, ai!, reasoningModel);
          checkoutState.phase = result.nextPhase as any;
          if (result.extractedData.quantity) checkoutState.confirmedQty = result.extractedData.quantity;
          if (result.extractedData.paymentMethod) checkoutState.paymentMethod = result.extractedData.paymentMethod as any;
          await saveCheckoutState(sessionId, checkoutState);
          const ofs = { phase: checkoutState.phase, cartItems: checkoutState.cartItems || [] };
          send({ type: "order_flow_step", ...ofs });
          await streamWords(result.responseText, send);
          await saveOrderMessage(result.responseText, ofs);
        } else if (action === "cart_modify" && checkoutState) {
          const cartItems = checkoutState.cartItems || [];
          const result = await cartModifierAgent(message, cartItems as any[], availableProducts, ai!, fastModel);
          checkoutState.cartItems = result.updatedCart;
          await saveCheckoutState(sessionId, checkoutState);
          const ofs = { phase: checkoutState.phase, cartItems: checkoutState.cartItems || [] };
          send({ type: "order_flow_step", ...ofs });
          await streamWords(result.responseText, send);
          await saveOrderMessage(result.responseText, ofs);
        } else if (intentClassification.intent === "category_browse" && ai) {
          const categoryTree = await getCachedCategories();
          const result = await categoryBrowseAgent(message, categoryTree, contextWindow.historySnippet, ai, fastModel);
          send({ type: "product_groups", groups: result.categoryGroups });
          await streamWords(result.responseIntro, send);
          await saveShopMessage(result.responseIntro, [], intentClassification.intent);
        } else {
          const execCtx = { ai, fastModel, checkoutState, userId, sessionId, currency, country, userMessage: message };
          const results = await executePlan(decision, send, execCtx);
          const text = await streamMainResponse(message, intentClassification, contextWindow, results, checkoutState, send, ai, fastModel, intentClassification.isAgeRestricted);
          await saveShopMessage(text, [], intentClassification.intent);
        }

        controller.close();
      }
    });

    return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Error" }), { status: 500 });
  }
});
