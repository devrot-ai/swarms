import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { startMissionSession } from "@/lib/mission-control/missionControl";
import { buildCeoPlan } from "@/lib/mission-control/ceoAgent";
import { buildCooTasks } from "@/lib/mission-control/cooAgent";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import { missionStore } from "@/lib/mission-control/stores";
import { userKeyStore } from "@/lib/mission-control/userKeyStore";
import { MissionEvent } from "@/lib/mission-control/types";

interface LaunchInput {
  uid: string;
  template?: "CEO" | "Marketing" | "Engineering" | "Design" | "Quick Task";
  modelMode: "default" | "apikey";
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
      "dept_pm_01",
      "THOUGHT",
      "trace.started — mission orchestration initialized",
      0.91,
      "RUNNING",
      { trace: "trace.started", agent_id: "dept_pm_01", short_text: "Mission initialized" },
    );

    emitTrace(
      missionSession.sessionId,
      "dept_pm_01",
      "THOUGHT",
      "trace.step — CEO produced mission objectives, KPIs and token budget",
      0.9,
      "RUNNING",
      { trace: "trace.step", step_no: 1, reasoning: "Plan synthesis", evidence: "Company memory + risk policy" },
    );

    emitTrace(
      missionSession.sessionId,
      "dept_runtime_01",
      "ACTION",
      "trace.action — COO created ordered tasks and assigned workers",
      0.89,
      "RUNNING",
      { trace: "trace.action", tool_calls: ["task_queue.emit"], sandbox_result: `${coo.tasks.length} tasks` },
    );

    emitTrace(
      missionSession.sessionId,
      "dept_data_01",
      "ARTIFACT",
      "trace.finish — artifact produced for mission plan",
      0.94,
      "COMPLETED",
      { trace: "trace.finish", artifact_id: "mission_plan", confidence: 0.94 },
    );

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
