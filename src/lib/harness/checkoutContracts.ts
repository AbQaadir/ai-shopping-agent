import { GoogleGenAI } from "@google/genai";
import type { CheckoutPhase } from "@/lib/checkoutContext";

export interface CheckoutPhaseContract {
  phase: CheckoutPhase;
  systemAsk: string;
  acceptanceCriteria: string[];
  failureSignals: string[];
  maxRetries: number;
}

export interface ContractValidationResult {
  satisfied: boolean;
  reason: string;
  retryMessage?: string;
}

const LOG_PREFIX = '[Harness:Contract]';

export const CHECKOUT_CONTRACTS: Record<string, CheckoutPhaseContract> = {
  qty_ask: {
    phase: "qty_ask",
    systemAsk: "Confirm quantities for the order",
    acceptanceCriteria: [
      "user confirmed a quantity as a positive number",
      "user said yes/ok/confirm/proceed/looks good",
      "UI button was pressed: Confirm quantities"
    ],
    failureSignals: ["actually","wait","change","different","instead","never mind","nope","cancel"],
    maxRetries: 2
  },
  delivery_ask: {
    phase: "delivery_ask",
    systemAsk: "Ask if user wants to use saved address or enter a new one",
    acceptanceCriteria: [
      "user selected a saved address",
      "user clicked Use address button",
      "user explicitly asked for a new address"
    ],
    failureSignals: ["don't know","not sure","any","whatever","idk"],
    maxRetries: 2
  },
  new_address_form: {
    phase: "new_address_form",
    systemAsk: "Wait for the user to submit the new address form",
    acceptanceCriteria: ["UI form was submitted with structured New address confirmed: message"],
    failureSignals: [],
    maxRetries: 2
  },
  delivery_date_ask: {
    phase: "delivery_date_ask",
    systemAsk: "Ask for delivery date and optional personal message",
    acceptanceCriteria: [
      "user provided a date",
      "user said tomorrow or ASAP or specific date",
      "UI date picker submitted"
    ],
    failureSignals: ["no date","idk","skip"],
    maxRetries: 2
  },
  payment_ask: {
    phase: "payment_ask",
    systemAsk: "Ask for payment method (COD or Card)",
    acceptanceCriteria: [
      "user said cash/cod/card/online/credit/debit",
      "UI button was clicked"
    ],
    failureSignals: ["don't know","idk","whatever","not sure","maybe"],
    maxRetries: 2
  }
};

export function getContract(phase: string): CheckoutPhaseContract | null {
  return CHECKOUT_CONTRACTS[phase] || null;
}

export async function validatePhaseResponse(params: {
  phase: string;
  userMessage: string;
  historySnippet: string;
  checkoutState: any;
  ai: GoogleGenAI;
  fastModel: string;
}): Promise<ContractValidationResult> {
  const contract = getContract(params.phase);
  if (!contract) {
    console.log(`${LOG_PREFIX} No contract found for phase '${params.phase}'. Defaulting to satisfied.`);
    return { satisfied: true, reason: "No contract for phase" };
  }

  const criteriaList = contract.acceptanceCriteria.map(c => `- ${c}`).join('\n');
  const failureList = contract.failureSignals.length > 0
    ? contract.failureSignals.map(c => `- ${c}`).join('\n')
    : '(none)';

  const promptLines = [
    'You are a strict compliance evaluator for a checkout flow.',
    `Current phase: ${params.phase}`,
    `System Ask: ${contract.systemAsk}`,
    '',
    `User Message: "${params.userMessage}"`,
    '',
    'Acceptance Criteria (Any must be met):',
    criteriaList,
    '',
    'Failure Signals (If present, usually means not satisfied):',
    failureList,
    '',
    "Evaluate if the user's message satisfies the checkout phase requirements.",
    'Return JSON ONLY: { "satisfied": boolean, "reason": "Brief explanation", "retryMessage": "short polite re-ask if not satisfied" }',
  ];
  const prompt = promptLines.join('\n');

  try {
    const callPromise = params.ai.models.generateContent({
      model: params.fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            satisfied: { type: "BOOLEAN" },
            reason: { type: "STRING" },
            retryMessage: { type: "STRING", nullable: true }
          },
          required: ["satisfied", "reason"]
        }
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM timeout")), 3000)
    );

    const result = await Promise.race([callPromise, timeoutPromise]);
    const raw = (result.text || "{}").trim();
    const parsed = JSON.parse(raw);
    
    console.log(`${LOG_PREFIX} [${params.phase}] satisfied=${parsed.satisfied} reason="${parsed.reason}"`);
    return {
      satisfied: !!parsed.satisfied,
      reason: parsed.reason || "Evaluated by LLM",
      retryMessage: parsed.retryMessage
    };
  } catch (error) {
    console.warn(`${LOG_PREFIX} LLM evaluation failed or timed out. Failing OPEN (satisfied=true). Error:`, error);
    return { satisfied: true, reason: "Fail-open due to error" };
  }
}
