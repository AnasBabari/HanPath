/**
 * OpenRouter AI Utility
 * Uses fetch to interact with OpenRouter API.
 */

const AUTO_FREE_ROUTE = "auto/free";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const FREE_MODEL_CACHE_TTL_MS = 15 * 60 * 1000;
const LAST_WORKING_MODEL_KEY = "hanpath-last-working-free-model";
const DEFAULT_FREE_MODELS = [
  "arcee-ai/trinity-large-preview:free",
  "qwen/qwen3-4b:free",
  "qwen/qwen3-coder:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
];

let freeModelCache: { fetchedAt: number; models: string[] } | null = null;

function uniqueModels(models: string[]): string[] {
  return models.filter((value, index, arr) => arr.indexOf(value) === index);
}

function parseModelList(raw?: string): string[] {
  if (!raw) return [];

  return uniqueModels(
    raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  );
}

function readLastWorkingModel(): string | null {
  try {
    return localStorage.getItem(LAST_WORKING_MODEL_KEY);
  } catch {
    return null;
  }
}

function saveLastWorkingModel(modelId: string) {
  try {
    localStorage.setItem(LAST_WORKING_MODEL_KEY, modelId);
  } catch {
    // Ignore localStorage write failures.
  }
}

async function fetchAllFreeModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (
    freeModelCache &&
    now - freeModelCache.fetchedAt < FREE_MODEL_CACHE_TTL_MS &&
    freeModelCache.models.length
  ) {
    return freeModelCache.models;
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { data?: Array<{ id?: string }> };
    const discovered = uniqueModels(
      (data.data || [])
        .map((item) => item.id)
        .filter((id): id is string => typeof id === "string" && id.endsWith(":free"))
    );

    if (discovered.length) {
      freeModelCache = { fetchedAt: now, models: discovered };
    }

    return discovered;
  } catch {
    return [];
  }
}

function prioritizeLastWorkingModel(models: string[]): string[] {
  const lastWorkingModel = readLastWorkingModel();
  if (!lastWorkingModel || !models.includes(lastWorkingModel)) {
    return models;
  }

  return [
    lastWorkingModel,
    ...models.filter((modelId) => modelId !== lastWorkingModel),
  ];
}

async function resolveModelCandidates(requestedModel: string, apiKey: string): Promise<string[]> {
  const envModels = parseModelList(import.meta.env.VITE_OPENROUTER_FREE_MODELS);
  const preferredFreeModels = envModels.length
    ? uniqueModels([...envModels, ...DEFAULT_FREE_MODELS])
    : DEFAULT_FREE_MODELS;
  const discoveredFreeModels = await fetchAllFreeModels(apiKey);
  const mergedFreePool = uniqueModels([...preferredFreeModels, ...discoveredFreeModels]);
  const freePool = prioritizeLastWorkingModel(mergedFreePool);

  if (requestedModel === AUTO_FREE_ROUTE) {
    return freePool;
  }

  return uniqueModels([requestedModel, ...freePool]);
}

export async function callOpenRouter(
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  model: string = AUTO_FREE_ROUTE
) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("API Key missing from .env");

  const finalMessages = systemPrompt 
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  // Auto-route through free model candidates before returning an error.
  const modelCandidates = await resolveModelCandidates(model, apiKey);

  let lastError = "Failed to connect to AI";
  const attemptedModels: string[] = [];

  for (const modelId of modelCandidates) {
    attemptedModels.push(modelId);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://hanpath.com", // Optional, but good for OpenRouter
        "X-Title": "HànPath Learning App",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: finalMessages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (modelId.endsWith(":free")) {
        saveLastWorkingModel(modelId);
      }
      return data.choices?.[0]?.message?.content || "";
    }

    try {
      const errorData = await response.json();
      lastError = errorData?.error?.message || `HTTP Error ${response.status}`;
    } catch {
      lastError = `HTTP Error ${response.status}`;
    }

    // Auth/config problems won't be fixed by model fallback.
    if (response.status === 401 || response.status === 403) {
      throw new Error(lastError);
    }
  }

  throw new Error(
    `All fallback models failed (${attemptedModels.join(", ")}). Last error: ${lastError}`
  );
}
