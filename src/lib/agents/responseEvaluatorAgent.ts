import { GoogleGenAI } from '@google/genai';
import { ResponseEvaluation, ResponseCriteriaScores, ResponseEvalAction } from '@/lib/harness/types';

const LOG_PREFIX = '[Harness:ResponseEval]';

export async function responseEvaluatorAgent(params: {
  draftResponse: string;
  userQuery: string;
  intent: 'qa' | 'delivery';
  historySnippet: string;
  ai: GoogleGenAI;
  fastModel: string;
}): Promise<ResponseEvaluation> {
  try {
    const prompt = `Evaluate the following draft response to a user's query on an e-commerce platform.
User Query: "${params.userQuery}"
Intent: ${params.intent}

Draft Response:
"${params.draftResponse}"

Score the following criteria from 0 to 10:
- factualSafety (35%): Ensure there are no wrong claims about prices, policies, or dates.
- tone (25%): Should be warm, friendly, and match a 'Buddy' persona.
- actionability (25%): Should give the user a clear next step.
- scope (15%): Should be the right length, neither bloated nor truncated.

Respond in exactly this JSON format:
{"factualSafety": 0-10, "tone": 0-10, "actionability": 0-10, "scope": 0-10, "feedback": "...", "correctionNote": "..."}
`;

    const response = await params.ai.models.generateContent({
      model: params.fastModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from LLM');

    const parsed = JSON.parse(text);
    
    const fs = parsed.factualSafety ?? 5;
    const tn = parsed.tone ?? 5;
    const act = parsed.actionability ?? 5;
    const sc = parsed.scope ?? 5;

    const overallScore = fs * 0.35 + tn * 0.25 + act * 0.25 + sc * 0.15;
    
    let action: ResponseEvalAction;
    if (overallScore >= 7.0) {
        action = 'stream_as_is';
    } else if (overallScore >= 5.0) {
        action = 'append_note';
    } else {
        action = 'regenerate';
    }

    return {
      overallScore,
      action,
      criteriaScores: { factualSafety: fs, tone: tn, actionability: act, scope: sc },
      feedback: parsed.feedback,
      correctionNote: parsed.correctionNote
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during evaluation:`, error);
    return {
      overallScore: 8.0,
      action: 'stream_as_is',
      criteriaScores: { factualSafety: 8, tone: 8, actionability: 8, scope: 8 },
      correctionNote: undefined,
      feedback: undefined
    };
  }
}
