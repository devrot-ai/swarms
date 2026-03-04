import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { startMissionSession } from "@/lib/mission-control/missionControl";
import { buildCeoPlan } from "@/lib/mission-control/ceoAgent";
import { buildCooTasks } from "@/lib/mission-control/cooAgent";
import { agentChat, isAnyProviderAvailable } from "@/lib/mission-control/llm";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import { missionStore } from "@/lib/mission-control/stores";
import { userKeyStore } from "@/lib/mission-control/userKeyStore";
import { MissionEvent } from "@/lib/mission-control/types";

interface LaunchInput {
  uid: string;
  template?: "CEO" | "Marketing" | "Engineering" | "Design" | "Quick Task";
  modelMode: "default" | "apikey" | "ollama";
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function templateBrief(template: LaunchInput["template"]) {
  switch (template) {
    case "CEO":
      return "Plan mission objectives and KPIs for a safe multi-agent launch.";
    case "Marketing":
      return "Create a launch campaign with citations and testable deliverables.";
    case "Engineering":
      return "Build and validate orchestration APIs and audit-safe runtime logic.";
    case "Design":
      return "Design a realtime mission workspace with timeline, thinking and artifacts.";
    default:
      return "Complete a lightweight mission with safe defaults and fast iteration.";
  }
}

function emitTrace(
  sessionId: string,
  agentId: string,
  type: MissionEvent["type"],
  message: string,
  confidence: number,
  status: MissionEvent["status"],
  data: Record<string, unknown>,
) {
  const auditId = id("aud");
  missionStore.appendAudit({
    auditId,
    sessionId,
    timestampUtc: nowIso(),
    actorId: agentId,
    action: `trace.${type.toLowerCase()}`,
    details: data,
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LaunchInput;

    if (!body?.uid || !body?.modelMode) {
      return NextResponse.json(
        { error: "uid and modelMode are required." },
        { status: 400 },
      );
    }

    if (body.modelMode === "apikey" && !userKeyStore.get(body.uid)) {
      return NextResponse.json(
        { error: "No validated API key found for user. Validate key before launch." },
        { status: 400 },
      );
    }
    // Ollama does not require a stored API key.

    const brief = body.template
      ? templateBrief(body.template)
      : "Autonomously orchestrate a full multi-agent mission. The AI decides which departments and agents to activate based on the objective.";
    const ceo = buildCeoPlan({
      userBrief: brief,
      companyMemory: "Workspace launch follows validated onboarding path.",
      riskPolicy: "Strict approval for destructive/external actions",
    });

    const missionSession = startMissionSession({
      mission: {
        projectName: `${body.template ?? "Auto"} Mission Workspace`,
        objective: ceo.mission,
        timeline: {
          startDate: new Date().toISOString().slice(0, 10),
          targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10),
          milestones: ["Onboard", "Plan", "Execute", "Review"],
        },
        requiredDepartments: [
          "Program Management",
          "Security & Compliance",
          "Agent Runtime",
          "Data & Audit",
          "Frontend Realtime UX",
          "QA & Verification",
        ],
        kpis: ceo.KPIs,
        computeBudget: {
          tokenLimitTotal: ceo.budget_tokens.total,
          maxTokensPerTask: ceo.budget_tokens.max_per_task,
          costGuardrailUsd: 25,
        },
        uncertainty: 0.2,
      },
    });

    const coo = buildCooTasks({
      mission: ceo.mission,
      sessionId: missionSession.sessionId,
      timelineDays: 7,
      startDateUtc: nowIso(),
    });

    emitTrace(
      missionSession.sessionId,
      "system",
      "STATUS",
      "Mission workspace created — starting AI agent pipeline…",
      0.95,
      "RUNNING",
      { trace: "trace.started" },
    );

    /* ------------------------------------------------------------------ */
    /* Kick off real LLM agent work in the background (non-blocking).     */
    /* Results stream into the workspace via SSE/event bus.               */
    /* ------------------------------------------------------------------ */
    const sid = missionSession.sessionId;
    const anyProviderUp = await isAnyProviderAvailable();

    if (anyProviderUp) {
      // Fire-and-forget: run agent pipeline asynchronously
      (async () => {
        try {
          emitTrace(sid, "system", "STATUS", "LLM provider connected — agents are thinking…", 0.95, "RUNNING", {});

          // CEO agent analyses the mission
          const ceoResponse = await agentChat(
            "ceo_agent",
            `You are launching a new mission workspace.\n\nMission brief: "${brief}"\n\n` +
            `Think through this step by step and provide:\n` +
            `1. **Mission Objective** — What exactly we're building/doing\n` +
            `2. **Departments to Activate** — Which teams and why each is needed\n` +
            `3. **KPIs** — Specific, measurable success criteria\n` +
            `4. **Priority Assignments** — P0/P1/P2 with reasoning\n` +
            `5. **Risk Assessment** — Potential issues and mitigations\n\n` +
            `Be specific and detailed. Show your reasoning.`,
            `Project: ${ceo.mission}`,
          );
          emitTrace(sid, "ceo_agent", "THOUGHT", ceoResponse.content, 0.92, "RUNNING", { model: ceoResponse.model, tokens: ceoResponse.tokensUsed });

          // COO breaks it into tasks
          const cooResponse = await agentChat(
            "coo_agent",
            `The CEO created this plan:\n${ceoResponse.content}\n\n` +
            `Break this into specific, concrete tasks. For EACH task:\n` +
            `- **Task title** — descriptive name\n` +
            `- **What to do** — detailed steps, not just a title\n` +
            `- **Assigned to** — which agent/department handles it\n` +
            `- **Priority** — P0/P1/P2\n` +
            `- **Estimated time** — realistic estimate\n\n` +
            `Do NOT use [PENDING] placeholders. Describe actual work.`,
            `Mission: ${ceo.mission}`,
          );
          emitTrace(sid, "coo_agent", "ACTION", cooResponse.content, 0.90, "RUNNING", { model: cooResponse.model, tokens: cooResponse.tokensUsed });

          // Worker agent starts first task
          const workerResponse = await agentChat(
            "worker_agent",
            `The COO assigned these tasks:\n${cooResponse.content}\n\n` +
            `Pick the highest-priority task and START WORKING on it immediately.\n\n` +
            `If code is required, write the ACTUAL CODE in markdown code blocks.\n` +
            `If it's a planning/analysis task, produce the actual deliverable.\n\n` +
            `Show:\n` +
            `1. Which task you're working on\n` +
            `2. Your approach\n` +
            `3. The actual output (code, document, analysis, etc.)\n` +
            `4. Status and any blockers`,
            `Mission: ${ceo.mission}`,
          );
          emitTrace(sid, "worker_agent", "ACTION", workerResponse.content, 0.88, "RUNNING", { model: workerResponse.model, tokens: workerResponse.tokensUsed });

          emitTrace(sid, "system", "STATUS", "Initial agent pipeline complete. Use the chat to give further instructions.", 0.95, "COMPLETED", {});
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown agent error";
          emitTrace(sid, "system", "STATUS", `Agent pipeline error: ${msg}`, 0.5, "BLOCKED", { error: msg });
        }
      })();
    } else {
      emitTrace(sid, "system", "STATUS",
        "⚠ No LLM provider available. Start Ollama locally with `ollama serve`, or set GEMINI_API_KEY or OPENAI_API_KEY in your .env.local.",
        0.5, "BLOCKED", {},
      );
    }

    return NextResponse.json(
      {
        sessionId: missionSession.sessionId,
        timeline: coo.tasks,
        streaming: {
          websocket: `/ws/session/${missionSession.sessionId}`,
          sseFallback: `/api/mission-control/events/${missionSession.sessionId}`,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to launch workspace.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
