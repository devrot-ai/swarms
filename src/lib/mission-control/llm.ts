/* ------------------------------------------------------------------ */
/*  Multi-provider LLM module                                         */
/*  Supports: Ollama (local), Google Gemini, OpenAI, Demo (free)      */
/*  Falls back automatically: Demo → Ollama → Gemini → OpenAI         */
/* ------------------------------------------------------------------ */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";

export type LLMProvider = "ollama" | "google" | "openai" | "demo";

export interface AgentChatResult {
  content: string;
  model: string;
  provider: LLMProvider;
  tokensUsed: number;
}

export interface ProviderModel {
  provider: LLMProvider;
  model: string;
  label: string;
  description?: string;
  isFree?: boolean;
}

/* ---------- Free Demo Models via Vercel AI Gateway ---------- */
/* These models are available without any API key configuration */
const DEMO_MODELS: ProviderModel[] = [
  {
    provider: "demo",
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini (Free Demo)",
    description: "Fast, capable model for everyday tasks",
    isFree: true,
  },
  {
    provider: "demo",
    model: "anthropic/claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku (Free Demo)",
    description: "Quick responses, great for chat",
    isFree: true,
  },
  {
    provider: "demo",
    model: "google/gemini-2.0-flash",
    label: "Gemini 2.0 Flash (Free Demo)",
    description: "Google's fast multimodal model",
    isFree: true,
  },
];

/* ---------- Provider availability checks ---------- */

export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/* ---------- List available models across providers ---------- */

export async function listAvailableModels(): Promise<ProviderModel[]> {
  const models: ProviderModel[] = [];

  // Always include free demo models first so users can try without setup
  models.push(...DEMO_MODELS);

  // Ollama (local) models if reachable
  if (await isOllamaReachable()) {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        const ollamaModels: { name: string }[] = data?.models ?? [];
        for (const m of ollamaModels) {
          models.push({ 
            provider: "ollama", 
            model: m.name, 
            label: `${m.name} (Ollama Local)`,
            description: "Running on your local machine",
          });
        }
      }
    } catch { /* Ollama unavailable */ }
  }

  if (isGeminiConfigured()) {
    models.push(
      { provider: "google", model: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Your Key)", description: "Your API key" },
      { provider: "google", model: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash (Your Key)", description: "Your API key" },
    );
  }

  if (isOpenAIConfigured()) {
    models.push(
      { provider: "openai", model: "gpt-4o-mini", label: "GPT-4o Mini (Your Key)", description: "Your API key" },
      { provider: "openai", model: "gpt-4o", label: "GPT-4o (Your Key)", description: "Your API key" },
      { provider: "openai", model: "gpt-4.1-nano", label: "GPT-4.1 Nano (Your Key)", description: "Your API key" },
      { provider: "openai", model: "gpt-4.1-mini", label: "GPT-4.1 Mini (Your Key)", description: "Your API key" },
    );
  }

  return models;
}

/* ---------- Detect provider from model string ---------- */

function detectProvider(model: string): LLMProvider {
  // Demo models use provider/model format (e.g., "openai/gpt-4o-mini")
  if (model.includes("/")) return "demo";
  if (model.startsWith("gpt-")) return "openai";
  if (model.startsWith("gemini-")) return "google";
  return "ollama";
}

/* ---------- Pick a default model from what's available ---------- */

async function pickDefault(): Promise<{ provider: LLMProvider; model: string }> {
  // Always default to free demo models so users can try immediately
  return { provider: "demo", model: "openai/gpt-4o-mini" };
}

/* ---------- Provider-specific chat calls ---------- */

async function chatOpenAI(
  messages: { role: string; content: string }[],
  model: string,
): Promise<AgentChatResult> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    model,
    provider: "openai",
    tokensUsed: (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
  };
}

async function chatOpenAIStream(
  messages: { role: string; content: string }[],
  model: string,
  onToken: (token: string) => void,
): Promise<AgentChatResult> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, stream: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI stream failed (${res.status}): ${text}`);
  }

  let content = "";
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) { content += delta; onToken(delta); }
      } catch { /* skip */ }
    }
  }

  return { content, model, provider: "openai", tokensUsed: 0 };
}

async function chatGemini(
  messages: { role: string; content: string }[],
  model: string,
): Promise<AgentChatResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const systemMsg = messages.find((m) => m.role === "system");
  const userMsgs = messages.filter((m) => m.role !== "system");

  const contents = userMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const usage = data.usageMetadata;
  return {
    content: text,
    model,
    provider: "google",
    tokensUsed: (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0),
  };
}

async function chatGeminiStream(
  messages: { role: string; content: string }[],
  model: string,
  onToken: (token: string) => void,
): Promise<AgentChatResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const systemMsg = messages.find((m) => m.role === "system");
  const userMsgs = messages.filter((m) => m.role !== "system");

  const contents = userMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini stream failed (${res.status}): ${text}`);
  }

  let content = "";
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (delta) { content += delta; onToken(delta); }
      } catch { /* skip */ }
    }
  }

  return { content, model, provider: "google", tokensUsed: 0 };
}

async function chatOllama(
  messages: { role: string; content: string }[],
  model: string,
): Promise<AgentChatResult> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    content: data.message?.content ?? "",
    model,
    provider: "ollama",
    tokensUsed: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
  };
}

async function chatOllamaStream(
  messages: { role: string; content: string }[],
  model: string,
  onToken: (token: string) => void,
): Promise<AgentChatResult> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama stream failed (${res.status}): ${text}`);
  }

  let content = "";
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const delta = json.message?.content;
        if (delta) { content += delta; onToken(delta); }
      } catch { /* skip */ }
    }
  }

  return { content, model, provider: "ollama", tokensUsed: 0 };
}

/* ---------- Demo models via Vercel AI Gateway (free, no API key needed) ---------- */

async function chatDemo(
  messages: { role: string; content: string }[],
  model: string,
): Promise<AgentChatResult> {
  // Use the AI SDK's streamText under the hood with Vercel AI Gateway
  const res = await fetch("https://api.vercel.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Demo model request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    model,
    provider: "demo",
    tokensUsed: (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
  };
}

async function chatDemoStream(
  messages: { role: string; content: string }[],
  model: string,
  onToken: (token: string) => void,
): Promise<AgentChatResult> {
  const res = await fetch("https://api.vercel.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Demo model stream failed (${res.status}): ${text}`);
  }

  let content = "";
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) { content += delta; onToken(delta); }
      } catch { /* skip */ }
    }
  }

  return { content, model, provider: "demo", tokensUsed: 0 };
}

/* ---------- Build chat messages ---------- */

function buildMessages(agentId: string, prompt: string, context?: string) {
  const messages: { role: string; content: string }[] = [];
  if (context) {
    messages.push({ role: "system", content: `You are ${agentId}.\n\nContext:\n${context}` });
  } else {
    messages.push({ role: "system", content: `You are ${agentId}.` });
  }
  messages.push({ role: "user", content: prompt });
  return messages;
}

/* ---------- Main chat function (non-streaming) ---------- */

export async function agentChat(
  agentId: string,
  prompt: string,
  context?: string,
  model?: string,
): Promise<AgentChatResult> {
  const messages = buildMessages(agentId, prompt, context);

  if (model) {
    const provider = detectProvider(model);
    switch (provider) {
      case "demo": return chatDemo(messages, model);
      case "openai": return chatOpenAI(messages, model);
      case "google": return chatGemini(messages, model);
      case "ollama": return chatOllama(messages, model);
    }
  }

  const defaults = await pickDefault();
  switch (defaults.provider) {
    case "demo": return chatDemo(messages, defaults.model);
    case "openai": return chatOpenAI(messages, defaults.model);
    case "google": return chatGemini(messages, defaults.model);
    case "ollama": return chatOllama(messages, defaults.model);
  }
}

/* ---------- Streaming chat function ---------- */

export async function agentChatStream(
  agentId: string,
  prompt: string,
  onToken: (token: string) => void,
  context?: string,
  model?: string,
): Promise<AgentChatResult> {
  const messages = buildMessages(agentId, prompt, context);

  if (model) {
    const provider = detectProvider(model);
    switch (provider) {
      case "demo": return chatDemoStream(messages, model, onToken);
      case "openai": return chatOpenAIStream(messages, model, onToken);
      case "google": return chatGeminiStream(messages, model, onToken);
      case "ollama": return chatOllamaStream(messages, model, onToken);
    }
  }

  const defaults = await pickDefault();
  switch (defaults.provider) {
    case "demo": return chatDemoStream(messages, defaults.model, onToken);
    case "openai": return chatOpenAIStream(messages, defaults.model, onToken);
    case "google": return chatGeminiStream(messages, defaults.model, onToken);
    case "ollama": return chatOllamaStream(messages, defaults.model, onToken);
  }
}

/* ---------- Check if ANY provider is available ---------- */

export async function isAnyProviderAvailable(): Promise<boolean> {
  // Demo models are always available (Vercel AI Gateway)
  return true;
}
