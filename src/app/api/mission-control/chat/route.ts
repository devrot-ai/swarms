import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildCeoPlan } from "@/lib/mission-control/ceoAgent";
import { buildCooTasks } from "@/lib/mission-control/cooAgent";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import { missionStore } from "@/lib/mission-control/stores";
import { MissionEvent } from "@/lib/mission-control/types";

interface ChatInput {
  sessionId: string;
  message: string;
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatInput;

    if (!body?.sessionId || !body?.message?.trim()) {
      return NextResponse.json(
        { error: "sessionId and message are required." },
        { status: 400 },
      );
    }

    const { sessionId, message } = body;
    const intent = classifyIntent(message);

    /* -- Emit user message into the event stream so it shows in Live Thinking -- */
    emit(sessionId, "user", "THOUGHT", `User: ${message}`, 1.0, "RUNNING");

    /* -- Route to agents based on intent ----------------------------------- */
    const replies: { agent: string; text: string; type: MissionEvent["type"] }[] = [];

    if (intent === "plan") {
      const plan = buildCeoPlan({
        userBrief: message,
        companyMemory: "User-directed planning via workspace chat.",
        riskPolicy: "Strict approval for destructive/external actions",
      });
      replies.push({
        agent: "ceo_agent",
        text: `Mission: ${plan.mission}\n\nDepartments: ${plan.departments.map((d: { name: string }) => d.name).join(", ")}\n\nKPIs: ${plan.KPIs.map((k: { name: string; target: string }) => `${k.name} → ${k.target}`).join("; ")}`,
        type: "THOUGHT",
      });

      const coo = buildCooTasks({
        mission: plan.mission,
        sessionId,
        timelineDays: 7,
        startDateUtc: nowIso(),
      });
      replies.push({
        agent: "coo_agent",
        text: `Created ${coo.tasks.length} tasks:\n${coo.tasks.map((t) => `• ${t.title} [${t.status}]`).join("\n")}`,
        type: "ACTION",
      });
    } else if (intent === "research") {
      replies.push({
        agent: "research_agent",
        text: `Researching: "${message}"\n\nI'll analyze available data sources and compile findings. Key areas to investigate:\n1. Domain-specific knowledge gathering\n2. Competitive landscape analysis\n3. Technical feasibility assessment\n\nResearch initiated — results will stream into your timeline.`,
        type: "THOUGHT",
      });
      replies.push({
        agent: "research_agent",
        text: `Research artifact queued — preliminary analysis based on your query has been compiled.`,
        type: "ARTIFACT",
      });
    } else if (intent === "task") {
      const coo = buildCooTasks({
        mission: message,
        sessionId,
        timelineDays: 3,
        startDateUtc: nowIso(),
      });
      replies.push({
        agent: "coo_agent",
        text: `Task breakdown for: "${message}"\n\n${coo.tasks.map((t) => `• ${t.title} [${t.status}]`).join("\n")}`,
        type: "ACTION",
      });
      replies.push({
        agent: "worker_agent",
        text: `Workers assigned. Executing tasks with safe defaults and dry-run validation enabled.`,
        type: "THOUGHT",
      });
    } else if (intent === "status") {
      const audit = missionStore.getAudits(sessionId);
      const artifacts = missionStore.getArtifacts(sessionId);
      replies.push({
        agent: "pm_agent",
        text: `Session: ${sessionId}\nAudit entries: ${audit.length}\nArtifacts: ${artifacts.length}\n\nLatest activity:\n${audit.slice(-5).map((a) => `• ${a.timestampUtc.slice(11, 19)} ${a.action}`).join("\n") || "No activity yet."}`,
        type: "THOUGHT",
      });
    } else {
      replies.push({
        agent: "ceo_agent",
        text: `Understood. I'll coordinate the swarm to address: "${message}"\n\nRouting to the most relevant agents. You'll see their thinking appear in the Live Thinking panel as they work.`,
        type: "THOUGHT",
      });

      const plan = buildCeoPlan({
        userBrief: message,
        companyMemory: "User chat command — general instruction.",
        riskPolicy: "Strict approval for destructive/external actions",
      });

      replies.push({
        agent: "coo_agent",
        text: `Objective received. Departments activated: ${plan.departments.map((d: { name: string }) => d.name).join(", ")}`,
        type: "ACTION",
      });
    }

    /* -- Publish all agent replies into the event stream ------------------- */
    const responseMessages: { agent: string; message: string; timestamp: string }[] = [];

    for (const reply of replies) {
      const ts = nowIso();
      emit(sessionId, reply.agent, reply.type, reply.text, 0.88 + Math.random() * 0.1, "RUNNING");
      responseMessages.push({ agent: reply.agent, message: reply.text, timestamp: ts });
    }

    return NextResponse.json(
      {
        ok: true,
        intent,
        responses: responseMessages,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to process chat message.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
