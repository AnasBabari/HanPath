/**
 * OpenRouter AI Utility via Secure Proxy
 * Calls the Vercel Serverless Function at /api/chat
 */

const AUTO_FREE_ROUTE = "auto/free";

const DEFAULT_FREE_MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-2-9b-it:free",
];

export async function callOpenRouter(
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  model: string = AUTO_FREE_ROUTE
) {
  const finalMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const modelCandidates = model === AUTO_FREE_ROUTE 
    ? DEFAULT_FREE_MODELS 
    : [model, ...DEFAULT_FREE_MODELS];

  let lastError = "Failed to connect to AI";
  const attemptedModels: string[] = [];

  for (const modelId of modelCandidates) {
    attemptedModels.push(modelId);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: finalMessages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `HTTP Error ${response.status} - ${errorText}`;
        
        // Stop retrying if the API key is invalid or rejected by OpenRouter
        if (response.status === 401 || response.status === 403 || response.status === 500) {
          throw new Error(lastError);
        }
        continue;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : lastError;
      if (lastError.includes("401") || lastError.includes("403") || lastError.includes("500")) {
        throw err; // Fail fast on auth errors
      }
    }
  }

  throw new Error(`All fallback models failed (${attemptedModels.join(", ")}). Last error: ${lastError}`);
}
