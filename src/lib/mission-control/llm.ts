/**
 * LLM client — talks to Ollama (or any OpenAI-compatible endpoint).
 *
 * Ollama exposes an OpenAI-compatible API at:
 *   POST http://localhost:11434/v1/chat/completions
 *
 * Set OLLAMA_BASE_URL in .env.local to override (e.g. a remote server).
 * Set OLLAMA_MODEL to choose which pulled model to use  (default: llama3).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  tokensUsed: number;
}

function getBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "") || "http://localhost:11434";
}

function getModel(): string {
  return process.env.OLLAMA_MODEL || "llama3";
}

/**
 * Send a chat completion request to Ollama's OpenAI-compatible endpoint.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number; model?: string },
): Promise<LlmResponse> {
  const base = getBaseUrl();
  const model = opts?.model || getModel();
  const temperature = opts?.temperature ?? 0.7;
  const maxTokens = opts?.maxTokens ?? 4096;

  const url = `${base}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(120_000), // 2 min timeout for slower models
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama request failed (${res.status}): ${text || res.statusText}. ` +
      `Make sure Ollama is running at ${base} and model "${model}" is pulled.`,
    );
  }

  const json = await res.json();
  const choice = json.choices?.[0];

  return {
    content: choice?.message?.content?.trim() ?? "",
    model: json.model ?? model,
    tokensUsed: json.usage?.total_tokens ?? 0,
  };
}

/* ---- Convenience: per-agent wrappers ---- */

const AGENT_PROMPTS: Record<string, string> = {
  ceo_agent: `You are the CEO Agent of an autonomous AI swarm. You make strategic decisions and coordinate the team.

Your responsibilities:
- Analyze requests and create clear, detailed mission plans
- Think step-by-step and show your reasoning process
- Identify which departments/agents to activate and WHY
- Define measurable KPIs and success criteria
- Set priorities (P0 = critical, P1 = important, P2 = nice-to-have)

Always show your thought process. Be specific and detailed, not generic. Use markdown formatting with headers, bullet points, and **bold** text for emphasis.`,

  coo_agent: `You are the COO Agent of an autonomous AI swarm. You turn plans into actionable work.

CRITICAL RULES:
- NEVER use [PENDING] or placeholder text — describe exactly what each task involves
- NEVER use generic task names — be specific about the technical work required
- Include file names, technology choices, and implementation details
- Each task should have enough detail that a developer could start working immediately

For each task provide:
- **Task title** — specific and descriptive
- **What to do** — detailed implementation steps (3-5 bullet points minimum)
- **Technology/tools** — what frameworks, languages, libraries to use
- **Assigned to** — which agent handles it
- **Priority** — P0/P1/P2 with justification
- **Estimated time** — realistic estimate

Produce the task breakdown immediately. Do not describe your process.`,

  research_agent: `You are the Research Agent of an autonomous AI swarm. You investigate topics deeply and produce ACTUAL research findings — not descriptions of what you would research.

CRITICAL RULES:
- NEVER say "I'll analyze" or "I'll investigate" — just DO IT and show the findings
- NEVER say "results will stream into your timeline" — present the results RIGHT NOW
- Produce the actual research output with specific data, facts, and analysis
- Include real examples, comparisons, and actionable insights

Your output format:
- Use markdown headers, bullet points, numbered lists, and **bold** for emphasis
- Include specific facts and data points
- Show pros/cons for alternatives
- Give concrete, actionable recommendations

Start producing findings immediately. Do not describe your process.`,

  worker_agent: `You are a Worker Agent in an autonomous AI swarm. You BUILD things and produce real output.

CRITICAL RULES:
- NEVER say "Workers assigned" or "Executing tasks" — actually DO THE WORK
- NEVER describe what you would build — BUILD IT and show the code
- NEVER use placeholder comments like "// add more here" — write complete code
- Write COMPLETE, WORKING, PRODUCTION-READY code in markdown code blocks

When asked to build something:
1. Show each file in its own code block with the language tag
2. Include the filename as the first comment
3. Write ALL necessary files — HTML, CSS, JS, config, etc.
4. Make code complete and ready to use
5. Add brief explanations between code blocks

Example format:
\`\`\`html
<!-- index.html -->
<!DOCTYPE html>
<html>...</html>
\`\`\`

\`\`\`css
/* styles.css */
body { ... }
\`\`\`

Start writing code immediately. Do not describe what you plan to do.`,

  pm_agent: `You are the Program Management Agent of an autonomous AI swarm. You track and report progress.

Your responsibilities:
- Give detailed, honest status reports with specifics
- Track what's been completed with concrete details
- Identify blockers, risks, and their mitigation plans
- Show progress percentages and metrics where possible
- Lay out clear next steps with owners and timelines

Be specific and data-driven. Don't be vague — reference actual tasks and deliverables. Use markdown formatting.`,
};

/**
 * Call the LLM as a specific agent with its system prompt.
 */
export async function agentChat(
  agentId: string,
  userMessage: string,
  context?: string,
  model?: string,
): Promise<LlmResponse> {
  const systemPrompt = AGENT_PROMPTS[agentId] ?? AGENT_PROMPTS.worker_agent;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  if (context) {
    messages.push({
      role: "system",
      content: `Context from the mission so far:\n${context}`,
    });
  }

  messages.push({ role: "user", content: userMessage });

  return chatCompletion(messages, model ? { model } : undefined);
}

/**
 * Quick health check — returns true if Ollama is reachable.
 */
export async function isOllamaReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List models available in Ollama.
 */
export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.models ?? []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}
