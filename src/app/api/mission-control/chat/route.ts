import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { agentChat, isOllamaReachable } from "@/lib/mission-control/llm";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import { missionStore } from "@/lib/mission-control/stores";
import { MissionEvent } from "@/lib/mission-control/types";

interface ChatInput {
  sessionId: string;
  message: string;
  model?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function emit(
  sessionId: string,
  agentId: string,
  type: MissionEvent["type"],
  message: string,
  confidence: number,
  status: MissionEvent["status"],
) {
  const auditId = id("aud");
  missionStore.appendAudit({
    auditId,
    sessionId,
    timestampUtc: nowIso(),
    actorId: agentId,
    action: `chat.${type.toLowerCase()}`,
    details: { message },
  });

  missionEventBus.publish({
    eventId: id("evt"),
    sessionId,
    agentId,
    type,
    timestampUtc: nowIso(),
    confidence,
    uncertainty: 1 - confidence,
    status,
    message,
    auditId,
    artifactId: null,
  });
}

/* ------------------------------------------------------------------ */
/* Classify what the user wants → route to the right agent pipeline   */
/* ------------------------------------------------------------------ */
function classifyIntent(msg: string): "plan" | "research" | "task" | "status" | "general" {
  const lower = msg.toLowerCase();
  if (/plan|strategy|objective|kpi|goal|roadmap/i.test(lower)) return "plan";
  if (/research|find|search|look up|analyze|investigate/i.test(lower)) return "research";
  if (/task|build|create|make|deploy|fix|implement|code|design/i.test(lower)) return "task";
  if (/status|progress|update|how.*going|what.*done/i.test(lower)) return "status";
  return "general";
}

/* ------------------------------------------------------------------ */
/* Build context about the current session for the LLM                */
/* ------------------------------------------------------------------ */
function buildSessionContext(sessionId: string): string {
  const audit = missionStore.getAudits(sessionId);
  const artifacts = missionStore.getArtifacts(sessionId);
  const session = missionStore.getSession(sessionId);

  const parts: string[] = [];
  if (session) {
    parts.push(`Mission: ${session.mission.objective}`);
    parts.push(`Status: ${session.status}`);
    parts.push(`Departments: ${session.mission.requiredDepartments.join(", ")}`);
  }
  if (audit.length > 0) {
    parts.push(`Recent activity (${audit.length} total):`);
    for (const a of audit.slice(-5)) {
      parts.push(`  - ${a.timestampUtc.slice(11, 19)} ${a.action}`);
    }
  }
  if (artifacts.length > 0) {
    parts.push(`Artifacts produced: ${artifacts.map((a) => a.title).join(", ")}`);
  }
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* Pipeline steps: define agent sequence for each intent               */
/* ------------------------------------------------------------------ */
interface PipelineStep {
  agentId: string;
  thinkingLabel: string;
  eventType: MissionEvent["type"];
  buildPrompt: (message: string, context: string, prevResults: string[]) => string;
}

function getPipeline(intent: string): PipelineStep[] {
  switch (intent) {
    case "plan":
      return [
        {
          agentId: "ceo_agent",
          thinkingLabel: "CEO Agent is crafting the mission plan…",
          eventType: "THOUGHT",
          buildPrompt: (msg) =>
            `Create a detailed mission plan for: "${msg}"\n\n` +
            `Show your reasoning step by step. Include:\n` +
            `1. **Mission Objective** — What exactly are we trying to achieve?\n` +
            `2. **Departments to Activate** — Which teams, and why each is needed\n` +
            `3. **KPIs** — Measurable success criteria with specific targets\n` +
            `4. **Priority Assignments** — P0/P1/P2 with justification\n` +
            `5. **Risk Assessment** — What could go wrong and how to mitigate\n\n` +
            `Think through each decision and explain your reasoning. Be specific, not generic.`,
        },
        {
          agentId: "coo_agent",
          thinkingLabel: "COO Agent is breaking down into actionable tasks…",
          eventType: "ACTION",
          buildPrompt: (msg, _ctx, prev) =>
            `The CEO created this plan:\n${prev[0]}\n\n` +
            `Break this into concrete, ordered tasks. For EACH task provide:\n` +
            `- **Task title** — specific and descriptive\n` +
            `- **What to do** — detailed implementation steps, not just a title\n` +
            `- **Assigned to** — which agent/department\n` +
            `- **Priority** — P0/P1/P2\n` +
            `- **Estimated time** — realistic estimate\n` +
            `- **Dependencies** — what must be done first\n\n` +
            `Be SPECIFIC. Don't use placeholders like [PENDING]. Describe the actual work.`,
        },
      ];
    case "research":
      return [
        {
          agentId: "research_agent",
          thinkingLabel: "Research Agent is investigating the topic…",
          eventType: "THOUGHT",
          buildPrompt: (msg) =>
            `Research this topic and produce ACTUAL FINDINGS right now: "${msg}"\n\n` +
            `DO NOT say "I'll analyze" or "Research initiated". Produce the actual research:\n\n` +
            `## Key Findings\n` +
            `(Write 5-10 specific, detailed findings with real data)\n\n` +
            `## Analysis\n` +
            `(What the evidence tells us — specific insights)\n\n` +
            `## Comparisons\n` +
            `(Alternatives, pros/cons in a structured format)\n\n` +
            `## Recommendations\n` +
            `(Specific, actionable next steps)\n\n` +
            `Start writing findings immediately. Be thorough and specific.`,
        },
      ];
    case "task":
      return [
        {
          agentId: "coo_agent",
          thinkingLabel: "COO Agent is planning the implementation approach…",
          eventType: "ACTION",
          buildPrompt: (msg) =>
            `The user wants to build: "${msg}"\n\n` +
            `Create a detailed technical implementation plan:\n` +
            `1. **Architecture** — technical approach and design decisions\n` +
            `2. **File Structure** — what files to create, their purpose\n` +
            `3. **Implementation Steps** — ordered list with specifics\n` +
            `4. **Technology Choices** — what tools/libraries/frameworks to use and why\n` +
            `5. **Key Components** — describe the main pieces of the implementation\n\n` +
            `Be technically specific. This plan will be handed to a developer agent who will write the actual code.`,
        },
        {
          agentId: "worker_agent",
          thinkingLabel: "Worker Agent is writing the code…",
          eventType: "THOUGHT",
          buildPrompt: (msg, _ctx, prev) =>
            `You need to build: "${msg}"\n\nThe COO's implementation plan:\n${prev[0]}\n\n` +
            `NOW PRODUCE THE ACTUAL CODE. Write complete, working, production-ready code.\n\n` +
            `Requirements:\n` +
            `- Use markdown code blocks with language tags (e.g. \`\`\`html, \`\`\`css, \`\`\`typescript)\n` +
            `- Write ALL necessary files — every HTML, CSS, JS file needed\n` +
            `- Include file names as the first comment in each code block\n` +
            `- Make the code complete and ready to use — not snippets or placeholders\n` +
            `- Add brief explanations between code blocks\n\n` +
            `Start building now. Show the COMPLETE implementation with all code.`,
        },
      ];
    case "status":
      return [
        {
          agentId: "pm_agent",
          thinkingLabel: "PM Agent is compiling status report…",
          eventType: "THOUGHT",
          buildPrompt: (_msg, ctx) =>
            `The user wants a status update.\n\nCurrent mission context:\n${ctx || "No prior activity recorded yet."}\n\n` +
            `Provide a detailed status report:\n` +
            `1. **Overall Progress** — percentage complete, current phase\n` +
            `2. **Completed Work** — what's been done, with specifics\n` +
            `3. **In Progress** — what's currently being worked on\n` +
            `4. **Blockers & Risks** — anything slowing things down\n` +
            `5. **Next Steps** — what happens next, with timeline\n\n` +
            `Be specific and data-driven.`,
        },
      ];
    default:
      return [
        {
          agentId: "ceo_agent",
          thinkingLabel: "CEO Agent is analyzing your request…",
          eventType: "THOUGHT",
          buildPrompt: (msg) =>
            `The user says: "${msg}"\n\n` +
            `Analyze this request thoroughly. Show your reasoning.\n` +
            `If this involves building something, outline the technical approach.\n` +
            `If it's a question, answer with depth and supporting details.\n` +
            `Be specific and produce useful, actionable output.`,
        },
        {
          agentId: "coo_agent",
          thinkingLabel: "COO Agent is creating action items…",
          eventType: "ACTION",
          buildPrompt: (msg, _ctx, prev) =>
            `The CEO's analysis:\n${prev[0]}\n\nOriginal request: "${msg}"\n\n` +
            `Create specific, actionable next steps:\n` +
            `- **What** — exactly what needs to be done\n` +
            `- **Who** — which agent/department handles it\n` +
            `- **Expected Outcome** — what the deliverable looks like\n\n` +
            `Be concrete and practical, not vague.`,
        },
      ];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatInput;

    if (!body?.sessionId || !body?.message?.trim()) {
      return NextResponse.json(
        { error: "sessionId and message are required." },
        { status: 400 },
      );
    }

    const { sessionId, message, model } = body;
    const intent = classifyIntent(message);

    /* -- Emit user message into the event stream -- */
    emit(sessionId, "user", "THOUGHT", `User: ${message}`, 1.0, "RUNNING");

    /* -- Check Ollama connectivity -- */
    const ollamaUp = await isOllamaReachable();
    if (!ollamaUp) {
      return NextResponse.json(
        {
          error:
            "Ollama is not running. Start it with `ollama serve` and make sure a model is pulled.",
        },
        { status: 503 },
      );
    }

    /* -- Stream agent responses one at a time via SSE -- */
    const context = buildSessionContext(sessionId);
    const pipeline = getPipeline(intent);

    emit(sessionId, "system", "STATUS", `Routing to agents (intent: ${intent})…`, 0.95, "RUNNING");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const prevResults: string[] = [];

          for (let i = 0; i < pipeline.length; i++) {
            const step = pipeline[i];

            // Notify frontend that this agent is now thinking
            send({
              type: "progress",
              agent: step.agentId,
              step: i + 1,
              totalSteps: pipeline.length,
              label: step.thinkingLabel,
            });

            const prompt = step.buildPrompt(message, context, prevResults);
            const result = await agentChat(step.agentId, prompt, context, model);
            prevResults.push(result.content);

            // Emit to SSE event bus for timeline/audit panels
            emit(
              sessionId,
              step.agentId,
              step.eventType,
              result.content,
              0.88 + Math.random() * 0.1,
              "RUNNING",
            );

            // Send the agent response to the frontend stream
            send({
              type: "response",
              agent: step.agentId,
              message: result.content,
              timestamp: nowIso(),
              step: i + 1,
              totalSteps: pipeline.length,
              tokensUsed: result.tokensUsed,
              model: result.model,
            });
          }

          send({ type: "done", intent });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          send({ type: "error", error: msg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to process chat message.",
        details: msg,
      },
      { status: 500 },
    );
  }
}
