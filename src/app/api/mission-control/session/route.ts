import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { missionStore } from "@/lib/mission-control/stores";
import { agentMetadata } from "@/lib/mission-control/agents";
import type { MissionSession, AgentDefinition, TaskQueueItem } from "@/lib/mission-control/types";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// Create a new session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const objective = body?.objective ?? "General AI Agentic Company Session";
    
    const sessionId = id("sess");
    
    // Create agents from metadata
    const agents: AgentDefinition[] = Object.entries(agentMetadata).map(([agentId, meta]) => ({
      agentId,
      type: agentId.includes("worker") ? "worker" : "department",
      name: meta.name,
      department: meta.department as MissionSession["mission"]["requiredDepartments"][number],
      responsibility: meta.description,
      tools: [],
      safetyRules: ["Audit all actions", "Request approval for destructive operations"],
    }));

    // Create initial task queue
    const taskQueue: TaskQueueItem[] = [
      { queueId: id("q"), name: "Session Initialized", status: "COMPLETED" },
      { queueId: id("q"), name: "Agents Ready", status: "COMPLETED" },
      { queueId: id("q"), name: "Awaiting User Input", status: "RUNNING" },
    ];

    const session: MissionSession = {
      sessionId,
      mission: {
        projectName: "AI Company Session",
        objective,
        timeline: {
          startDate: nowIso().slice(0, 10),
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          milestones: ["Initialize", "Plan", "Execute", "Review"],
        },
        requiredDepartments: [
          "Program Management",
          "Security & Compliance", 
          "Agent Runtime",
          "Data & Audit",
          "Frontend Realtime UX",
          "QA & Verification",
        ],
        kpis: [
          { name: "Task Completion", target: ">= 90%" },
          { name: "Response Time", target: "< 5s p95" },
          { name: "Quality Score", target: ">= 4.5/5" },
        ],
        computeBudget: {
          tokenLimitTotal: 1000000,
          maxTokensPerTask: 10000,
          costGuardrailUsd: 50,
        },
        uncertainty: 0.1,
      },
      modelPolicy: {
        defaultSafeModel: { provider: "openai", model: "openai/gpt-4o" },
        activeModel: { provider: "openai", model: "openai/gpt-4o" },
      },
      createdAgents: agents,
      taskQueue,
      status: "RUNNING",
    };

    missionStore.saveSession(session);

    return NextResponse.json({
      sessionId,
      status: "created",
      agents: agents.length,
      streamingEndpoint: `/api/mission-control/events/${sessionId}`,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create session.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// Get session info
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  
  if (!sessionId) {
    // Return list of recent sessions (simplified)
    return NextResponse.json({
      message: "Provide ?sessionId=xxx to get session details",
      createNew: "POST /api/mission-control/session with { objective: string }",
    });
  }

  const session = missionStore.getSession(sessionId);
  
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const audit = missionStore.getAudits(sessionId);
  const artifacts = missionStore.getArtifacts(sessionId);

  return NextResponse.json({
    session,
    auditCount: audit.length,
    artifactCount: artifacts.length,
    recentActivity: audit.slice(-10).map(a => ({
      time: a.timestampUtc,
      actor: a.actorId,
      action: a.action,
    })),
  });
}
