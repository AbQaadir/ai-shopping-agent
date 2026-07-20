import { GoogleGenAI } from '@google/genai';
import { SearchEvaluation, SearchCriteriaScores } from '@/lib/harness/types';

const LOG_PREFIX = '[Harness:SearchEval]';

export async function searchEvaluatorAgent(params: {
  originalQuery: string;
  searchTermsUsed: string[];
  results: any[];
  historySnippet: string;
  priceConstraints: { min: number | null; max: number | null };
  ai: GoogleGenAI;
  fastModel: string;
}): Promise<SearchEvaluation> {
  try {
    if (params.results.length === 0) {
      return {
        overallScore: 2.0,
        shouldRegenerate: true,
        feedback: 'No results returned',
        suggestedQueryRefinements: [params.originalQuery + ' Sri Lanka', params.originalQuery + ' gift'],
        criteriaScores: { queryMatch: 2, diversity: 2, priceAppropriateness: 2, completeness: 2 },
        passedCriteria: [],
        failedCriteria: ['queryMatch', 'diversity', 'priceAppropriateness', 'completeness']
      };
    }

    const prompt = `Evaluate the following search results for a user's query on an e-commerce platform in Sri Lanka.
User Query: "${params.originalQuery}"
Search Terms Used: ${JSON.stringify(params.searchTermsUsed)}
Price Constraints: Min = ${params.priceConstraints.min}, Max = ${params.priceConstraints.max}

First 8 Results (Name - Price):
${params.results.slice(0, 8).map((r, i) => `${i + 1}. ${r.name || r.title || 'Unknown'} - ${r.price || 'Unknown'}`).join('\n')}

Score the following criteria from 0 to 10:
- queryMatch: How well do the results match the user's intent and query?
- diversity: Is there a good variety of options (if applicable)?
- priceAppropriateness: Do the prices fit the user's constraints and general expectations?
- completeness: Are the results comprehensive?

Respond in exactly this JSON format:
{"queryMatch": 0-10, "diversity": 0-10, "priceAppropriateness": 0-10, "completeness": 0-10, "feedback": "...", "suggestedQueryRefinements": ["term1", "term2"]}
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
    
    const qm = parsed.queryMatch ?? 5;
    const div = parsed.diversity ?? 5;
    const pa = parsed.priceAppropriateness ?? 5;
    const comp = parsed.completeness ?? 5;

    const overallScore = qm * 0.35 + div * 0.20 + pa * 0.25 + comp * 0.20;
    const shouldRegenerate = overallScore < 6.0;

    return {
      overallScore,
      shouldRegenerate,
      feedback: parsed.feedback || 'Evaluation completed',
      suggestedQueryRefinements: parsed.suggestedQueryRefinements || [],
      criteriaScores: { queryMatch: qm, diversity: div, priceAppropriateness: pa, completeness: comp },
      passedCriteria: [],
      failedCriteria: []
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error during evaluation:`, error);
    return {
      overallScore: 7.0,
      shouldRegenerate: false,
      feedback: 'Evaluation skipped due to error',
      suggestedQueryRefinements: [],
      criteriaScores: { queryMatch: 7, diversity: 7, priceAppropriateness: 7, completeness: 7 },
      passedCriteria: ['all'],
      failedCriteria: []
    };
  }
}
