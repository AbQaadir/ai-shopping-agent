/**
 * Type-safe configuration layer that validates environment variables at startup.
 */

function getEnv(key: string, required = true, defaultValue?: string): string {
  const value = process.env[key];
  if (!value) {
    if (required) {
      throw new Error(`[Config Error] Environment variable "${key}" is required but not set.`);
    }
    return defaultValue || "";
  }
  return value;
}

export const config = {
  gemini: {
    apiKey: getEnv("GEMINI_API_KEY", false), // Fast/mock mode fallback handles empty keys
    fastModel: getEnv("FAST_GEMINI_MODEL", false, "gemini-3.1-flash-lite"),
    reasoningModel: getEnv("REASONING_GEMINI_MODEL", false, "gemini-3.5-flash"),
    autoCompleteModel: getEnv("AUTO_COMPLETE_LLM", false, "gemini-3.1-flash-lite"),
  },
  db: {
    url: getEnv("DATABASE_URL", false), // Prisma reads this directly, but validation helps debug container startups
  },
  brightData: {
    apiKey: getEnv("BRIGHTDATA_API_KEY", false),
    zone: getEnv("BRIGHTDATA_ZONE", false),
  },
  harness: {
    searchEvalEnabled: getEnv('HARNESS_SEARCH_EVAL_ENABLED', false, 'true') !== 'false',
    responseEvalEnabled: getEnv('HARNESS_RESPONSE_EVAL_ENABLED', false, 'true') !== 'false',
    contractValidationEnabled: getEnv('HARNESS_CONTRACT_VALIDATION_ENABLED', false, 'true') !== 'false',
    sessionInitEnabled: getEnv('HARNESS_SESSION_INIT_ENABLED', false, 'true') !== 'false',
    evalScoreThreshold: parseFloat(getEnv('HARNESS_EVAL_SCORE_THRESHOLD', false, '6.0')),
  }
};
