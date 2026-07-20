import { GoogleGenAI } from "@google/genai";
import { CheckoutState } from "@/lib/checkoutContext";
import { UserAddress, InlineProduct } from "@/types/sourcing";
import { KaprukaProduct } from "@/lib/tools";
import { StreamContext } from "../streamContext";
import { Intent } from "@/lib/nlp";

export interface ChatHandlerContext {
  sessionId: string;
  userId: string | undefined;
  message: string;
  checkoutState: CheckoutState | null;
  allUserAddresses: UserAddress[];
  savedAddr: UserAddress | null;
  ai: GoogleGenAI | null;
  fetchedSelectedProducts: KaprukaProduct[];
  availableProducts: InlineProduct[];
  streamContext: StreamContext;
  intent: Intent;
  isRelated: boolean;
  llmSearchTerms: any[];
  historyTarget: string | null;
  historyTimeline: string | null;
  isAgeRestricted: boolean;
  historySnippet: string;
  sessionContext: any;
  country?: string;
  currency?: string;
  criteria?: any;
  intentResult?: any;
}
