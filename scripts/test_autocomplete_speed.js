const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  try {
    const envPath = path.join(__dirname, "../.env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const parts = trimmed.split("=");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            let val = parts.slice(1).join("=").trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            }
            process.env[key] = val;
          }
        }
      });
    }
  } catch (err) {
    console.error("Error reading .env:", err);
  }
}

loadEnv();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Please set GEMINI_API_KEY in .env");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ];

  const inputText = "unique gifts for my";
  const systemInstruction = `You are Kapuruka's AI shopping assistant autocomplete engine.
Your task is to generate 3 realistic, context-appropriate completions of the user's partially typed input.
- Keep completions natural and short (between 3 and 10 words).
- Focus on Sri Lankan B2B wholesale, gifting, cakes, products, local services, or general e-commerce.
- The suggestions MUST start with or build upon the exact text of the user's input, completing their thought.
- Return ONLY a JSON array of strings containing the fully completed sentences.
- Do NOT repeat the user's input exactly as the final suggestions if there is no completion.
- Do NOT provide markdown styling or explanations. Return exactly a JSON array.`;

  const prompt = `
[User partially typed input]
"${inputText}"

Generate 3 completions for the user's input.
Output format MUST be: ["Completion 1", "Completion 2", "Completion 3"]`;

  console.log(`Testing autocomplete options... Input: "${inputText}"\n`);

  for (const model of models) {
    console.log(`--- Testing Model: ${model} ---`);
    for (const withConfig of [false, true]) {
      const configObj = withConfig
        ? {
            systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 60,
            temperature: 0.1,
          }
        : {
            systemInstruction,
            responseMimeType: "application/json",
          };

      const start = Date.now();
      try {
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
          config: configObj,
        });
        const duration = Date.now() - start;
        console.log(`  Config optimized=${withConfig}: Duration = ${duration}ms`);
        console.log(`  Output: ${result.text?.trim()}`);
      } catch (err) {
        console.error(`  Error: ${err.message}`);
      }
    }
    console.log("");
  }
}

run();
