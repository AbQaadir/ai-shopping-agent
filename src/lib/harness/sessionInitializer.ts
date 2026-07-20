import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/db';
import { config } from '@/lib/config';
import type { SessionContext, UserProfile } from '@/lib/harness/types';

const LOG_PREFIX = '[Harness:SessionInit]';

export async function initOrLoad(params: {
  sessionId: string;
  userId: string | null;
  chatHistory: any[];
  checkoutState: any | null;
  session: any;
  ai: GoogleGenAI | null;
}): Promise<SessionContext | null> {
  if (!config.harness?.sessionInitEnabled) return null;

  try {
    let existingContext: SessionContext | null = null;
    if (params.session?.sessionContext) {
      if (typeof params.session.sessionContext === 'string') {
        try {
          existingContext = JSON.parse(params.session.sessionContext);
        } catch (e) {
          // ignore parse error
        }
      } else {
        existingContext = params.session.sessionContext as SessionContext;
      }
    }

    if (existingContext) {
      const updatedAt = params.session.updatedAt ? new Date(params.session.updatedAt) : new Date();
      const gapMs = Date.now() - updatedAt.getTime();
      const gapMinutes = Math.floor(gapMs / (1000 * 60));

      if (gapMinutes < 30) {
        return existingContext;
      } else {
        const resumeMessage = getResumeMessage(existingContext, gapMinutes);
        return { ...existingContext, resumeMessage };
      }
    }

    if (params.chatHistory.length <= 2) {
      if (params.ai) {
        const firstUserMsg = params.chatHistory.find((m) => m.role === 'user')?.content || '';
        const newContext = await generateSessionContext({
          sessionId: params.sessionId,
          userId: params.userId,
          firstMessage: firstUserMsg,
          checkoutState: params.checkoutState,
          ai: params.ai,
        });
        return newContext;
      }
    }

    // Default fallback
    return {
      sessionGoal: 'Shopping session in progress',
      userProfile: {
        savedAddressCount: 0,
        preferredCity: null,
        pastOrderCategories: [],
        isRepeatCustomer: false,
      },
      lastKnownState: {
        phase: params.checkoutState?.phase || null,
        cartSummary: 'Empty cart',
        unresolvedIntents: [],
      },
      sessionTimestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`${LOG_PREFIX} failed silently:`, (err as Error).message);
    return null;
  }
}

export async function generateSessionContext(params: {
  sessionId: string;
  userId: string | null;
  firstMessage: string;
  checkoutState: any | null;
  ai: GoogleGenAI;
}): Promise<SessionContext> {
  const profile: UserProfile = {
    savedAddressCount: 0,
    preferredCity: null,
    pastOrderCategories: [],
    isRepeatCustomer: false,
  };

  if (params.userId && params.userId !== 'guest') {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { addresses: true },
    });
    if (user) {
      if (user.addresses && Array.isArray(user.addresses)) {
        profile.savedAddressCount = user.addresses.length;
        const defaultAddr = (user.addresses as any[]).find((a) => a.isDefault) || user.addresses[0];
        if (defaultAddr && (defaultAddr as any).city) {
          profile.preferredCity = (defaultAddr as any).city;
        }
      }
      profile.isRepeatCustomer = true;
    }
  }

  let sessionGoal = 'Shopping session in progress';
  if (params.firstMessage) {
    try {
      const prompt = `In one sentence, what is this user trying to shop for? Message: "${params.firstMessage}". Be specific and concise. Just the goal, no filler.`;
      const res = await params.ai.models.generateContent({
        model: config.gemini.fastModel,
        contents: prompt,
      });
      if (res.text) {
        sessionGoal = res.text.trim().replace(/^['"]|['"]$/g, '');
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} LLM context generation failed, falling back to default.`);
    }
  }

  const context: SessionContext = {
    sessionGoal,
    userProfile: profile,
    lastKnownState: {
      phase: params.checkoutState?.phase || null,
      cartSummary: params.checkoutState?.cartItems?.length 
        ? `${params.checkoutState.cartItems.length} item(s) in cart` 
        : 'Empty cart',
      unresolvedIntents: [],
    },
    sessionTimestamp: new Date().toISOString(),
  };

  // Fire-and-forget save
  prisma.chatSession.update({
    where: { id: params.sessionId },
    data: { sessionContext: context as any },
  }).catch((e) => {
    console.error(`${LOG_PREFIX} Failed to save context to DB:`, e.message);
  });

  return context;
}

export function getResumeMessage(context: SessionContext, gapMinutes: number): string {
  if (context.lastKnownState?.phase && context.lastKnownState.phase !== 'null') {
    return `Welcome back! You were in the middle of checkout. Your cart has ${context.lastKnownState.cartSummary || 'items'}.`;
  }
  if (context.sessionGoal && context.sessionGoal !== 'Shopping session in progress') {
    return `Welcome back! You were shopping for ${context.sessionGoal}.`;
  }
  return 'Welcome back!';
}
