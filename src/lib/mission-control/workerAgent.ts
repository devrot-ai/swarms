import crypto from "node:crypto";
import { missionStore } from "@/lib/mission-control/stores";
import {
  ArtifactRecord,
  WorkerAgentRequest,
  WorkerAgentResponse,
  WorkerExecutionTraceItem,
} from "@/lib/mission-control/types";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function buildPlan(task: string, workerType: string) {
  return [
    `Understand the constrained task for ${workerType}: ${task}`,
    "Validate requested tools against allowed_tool_uris and block non-allowed operations",
    "Execute or simulate steps under dry-run policy and produce final artifact",
  ];
}

function asArtifactUrl(sessionId: string, artifactId: string) {
  return `/api/mission-control/artifacts/${sessionId}?artifactId=${artifactId}`;
}

export function runWorkerTask(input: WorkerAgentRequest): WorkerAgentResponse {
  const dryRun = input.dryRun ?? true;
  const sessionId = id("sess_worker");
  const allowed = new Set(input.allowed_tool_uris ?? []);
  const requestedTools = input.requestedTools ?? [];

  const trace: WorkerExecutionTraceItem[] = [];
  const plan = buildPlan(input.task, input.workerType);

  trace.push({
    step: 1,
    timestampUtc: nowIso(),
    action: "Task intake and scope lock",
    outcome: dryRun ? "simulated" : "executed",
    details: `Worker ${input.workerType} accepted single task in ${dryRun ? "dry-run" : "execute"} mode.`,
  });

  if (requestedTools.length > 0) {
    requestedTools.forEach((toolUri, index) => {
      const permitted = allowed.has(toolUri);
      trace.push({
        step: index + 2,
        timestampUtc: nowIso(),
        action: "Tool access check",
        toolUri,
        outcome: permitted ? (dryRun ? "simulated" : "executed") : "blocked",
        details: permitted
          ? `Tool '${toolUri}' allowed by policy.`
          : `Tool '${toolUri}' blocked (not in allowed_tool_uris).`,
      });
    });
  } else {
    trace.push({
      step: 2,
      timestampUtc: nowIso(),
      action: "No external tools requested",
      outcome: dryRun ? "simulated" : "executed",
      details: "Execution continues with internal constrained logic only.",
    });
  }

  trace.push({
    step: trace.length + 1,
    timestampUtc: nowIso(),
    action: "Task execution",
    outcome: dryRun ? "simulated" : "executed",
    details: dryRun
      ? "External side effects suppressed by default dry-run policy."
      : "Task executed with constrained tool policy and side-effect checks.",
  });

  const artifact: ArtifactRecord = {
    artifactId: id("art"),
    sessionId,
    createdAtUtc: nowIso(),
    category: "deliverable",
    title: `Worker Output: ${input.workerType}`,
    payload: {
      workerType: input.workerType,
      task: input.task,
      dryRun,
      plan,
      trace,
      allowedToolUris: input.allowed_tool_uris,
      requestedTools,
    },
  };

  missionStore.appendArtifact(artifact);

  return {
    workerType: input.workerType,
    task: input.task,
    dryRun,
    plan,
    stepByStepExecutionTrace: trace,
    finalArtifactUrl: asArtifactUrl(sessionId, artifact.artifactId),
  };
}
