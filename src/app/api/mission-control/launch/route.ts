/**
 * Launch API - Creates a new mission workspace with AI agents
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { missionStore } from "@/lib/mission-control/stores";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import { agents, agentMetadata } from "@/lib/mission-control/agents";
import type { MissionSession, AgentDefinition, TaskQueueItem, MissionEvent } from "@/lib/mission-control/types";

interface LaunchInput {
  uid?: string;
  objective?: string;
  template?: "CEO" | "Marketing" | "Engineering" | "Design" | "Research" | "Quick Task";
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function templateBrief(template: LaunchInput["template"]): string {
  switch (template) {
    case "CEO":
      return "Create a comprehensive strategic plan with mission objectives, KPIs, and department assignments.";
    case "Marketing":
      return "Develop a marketing campaign with target audience analysis, messaging, and channel strategy.";
    case "Engineering":
      return "Plan and implement a technical solution with architecture, code, and testing.";
    case "Design":
      return "Design a user experience with wireframes, components, and accessibility considerations.";
    case "Research":
      return "Conduct thorough research on the topic with findings, analysis, and recommendations.";
    default:
      return "Complete a task efficiently with clear deliverables and quality checks.";
  }
}

function emitEvent(
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
    action: `launch.${type.toLowerCase()}`,
    details: { message: message.slice(0, 500) },
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

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LaunchInput;

    const sessionId = id("sess");
    const objective = body.objective || templateBrief(body.template);

    // Create agent definitions
    const agentDefs: AgentDefinition[] = Object.entries(agentMetadata).map(([agentId, meta]) => ({
      agentId,
      type: agentId.includes("worker") ? "worker" : "department",
      name: meta.name,
      department: meta.department as MissionSession["mission"]["requiredDepartments"][number],
      responsibility: meta.description,
      tools: [],
      safetyRules: ["Audit all actions", "Request approval for destructive operations"],
    }));

    // Create task queue
    const taskQueue: TaskQueueItem[] = [
      { queueId: id("q"), name: "Session Created", status: "COMPLETED" },
      { queueId: id("q"), name: "Agents Initialized", status: "COMPLETED" },
      { queueId: id("q"), name: "Strategic Planning", status: "RUNNING" },
      { queueId: id("q"), name: "Task Breakdown", status: "PENDING" },
      { queueId: id("q"), name: "Execution", status: "PENDING" },
    ];

    // Create session
    const session: MissionSession = {
      sessionId,
      mission: {
        projectName: `${body.template ?? "Mission"} Workspace`,
        objective,
        timeline: {
          startDate: nowIso().slice(0, 10),
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          milestones: ["Plan", "Build", "Test", "Deploy"],
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
          { name: "Task Completion Rate", target: ">= 95%" },
          { name: "Quality Score", target: ">= 4.5/5" },
          { name: "Time to Delivery", target: "Within timeline" },
        ],
        computeBudget: {
          tokenLimitTotal: 1000000,
          maxTokensPerTask: 15000,
          costGuardrailUsd: 50,
        },
        uncertainty: 0.15,
      },
      modelPolicy: {
        defaultSafeModel: { provider: "openai", model: "openai/gpt-4o" },
        activeModel: { provider: "openai", model: "openai/gpt-4o" },
      },
      createdAgents: agentDefs,
      taskQueue,
      status: "RUNNING",
    };

    missionStore.saveSession(session);

    // Emit session start
    emitEvent(sessionId, "system", "STATUS", "Mission workspace created - AI agents are ready.", 0.95, "RUNNING");

    // Start the agent pipeline in the background
    (async () => {
      try {
        emitEvent(sessionId, "system", "STATUS", "Starting AI agent pipeline...", 0.95, "RUNNING");

        // CEO creates strategic plan
        emitEvent(sessionId, "ceo_agent", "THOUGHT", "CEO is analyzing the objective and creating a strategic plan...", 0.9, "RUNNING");
        
        const ceoPlan = await agents.ceo_agent.generate({
          prompt: `Create a strategic plan for: "${objective}"
          
          Include:
          1. Mission Objective - What exactly we're trying to achieve
          2. Departments to Activate - Which teams and why
          3. KPIs - Measurable success criteria
          4. Priority Assignments - P0/P1/P2 with reasoning
          5. Risk Assessment - Potential issues and mitigations
          
          Be specific and detailed. Show your reasoning.`,
        });
        
        emitEvent(sessionId, "ceo_agent", "THOUGHT", ceoPlan.text.slice(0, 1000), 0.92, "RUNNING");
        
        // Store as artifact
        missionStore.appendArtifact({
          artifactId: id("art"),
          sessionId,
          createdAtUtc: nowIso(),
          category: "plan",
          title: "Strategic Plan",
          payload: { content: ceoPlan.text },
        });

        // COO breaks down into tasks
        emitEvent(sessionId, "coo_agent", "ACTION", "COO is breaking down the plan into actionable tasks...", 0.9, "RUNNING");
        
        const cooTasks = await agents.coo_agent.generate({
          prompt: `Based on the CEO's plan:
          
          ${ceoPlan.text}
          
          Break this into specific, concrete tasks. For each task include:
          - Task title
          - What to do (detailed steps)
          - Assigned department
          - Priority (P0/P1/P2)
          - Time estimate
          
          Be specific, no placeholders.`,
        });
        
        emitEvent(sessionId, "coo_agent", "ACTION", cooTasks.text.slice(0, 1000), 0.9, "RUNNING");

        // Update task queue
        missionStore.updateQueueStatus(sessionId, taskQueue[2].queueId, "COMPLETED");
        missionStore.updateQueueStatus(sessionId, taskQueue[3].queueId, "COMPLETED");
        missionStore.updateQueueStatus(sessionId, taskQueue[4].queueId, "RUNNING");

        // Worker starts first task
        emitEvent(sessionId, "worker_agent", "ACTION", "Worker is starting the first priority task...", 0.85, "RUNNING");
        
        const workerResult = await agents.worker_agent.generate({
          prompt: `Based on the COO's task breakdown:
          
          ${cooTasks.text}
          
          Pick the highest-priority task and start working on it.
          
          If code is needed, write actual code in markdown blocks.
          If it's analysis/planning, produce the actual deliverable.
          
          Show:
          1. Which task you're working on
          2. Your approach
          3. The actual output
          4. Status and next steps`,
        });
        
        emitEvent(sessionId, "worker_agent", "ACTION", workerResult.text.slice(0, 1000), 0.88, "RUNNING");
        
        // Store worker output as artifact
        missionStore.appendArtifact({
          artifactId: id("art"),
          sessionId,
          createdAtUtc: nowIso(),
          category: "deliverable",
          title: "Initial Deliverable",
          payload: { content: workerResult.text },
        });

        emitEvent(sessionId, "system", "STATUS", "Initial agent pipeline complete. Use the chat for further instructions.", 0.95, "COMPLETED");

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        emitEvent(sessionId, "system", "STATUS", `Agent pipeline error: ${msg}`, 0.5, "BLOCKED");
      }
    })();

    return NextResponse.json({
      sessionId,
      objective,
      status: "launching",
      agents: agentDefs.length,
      streaming: {
        websocket: `/ws/session/${sessionId}`,
        sseFallback: `/api/mission-control/events/${sessionId}`,
      },
      workspace: `/workspace/${sessionId}`,
    });
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
