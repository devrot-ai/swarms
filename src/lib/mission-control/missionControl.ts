import {
  ActionRisk,
  AgentDefinition,
  ApprovalRecord,
  ArtifactRecord,
  AuditRecord,
  MissionEvent,
  MissionSession,
  ModelConfig,
  StartSessionRequest,
  StartSessionResponse,
  TaskQueueItem,
} from "@/lib/mission-control/types";
import { missionStore } from "@/lib/mission-control/stores";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import { validateAndEncryptKey } from "@/lib/mission-control/security";
import crypto from "node:crypto";

// Default safe model now points to a local Ollama model for open‑source usage.
const DEFAULT_SAFE_MODEL: ModelConfig = {
  provider: "ollama",
  model: "llama3",
};

const DESTRUCTIVE_ACTIONS = new Set([
  "deployment",
  "system_file_write_outside_workspace",
  "infrastructure_change",
  "external_state_mutation",
]);

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function createDefaultAgents(): AgentDefinition[] {
  return [
    {
      agentId: "dept_pm_01",
      type: "department",
      name: "Program Management",
      responsibility:
        "Translate project input into measurable mission plans with KPIs, budget, timeline, and dependencies.",
      tools: ["mission_planner", "queue_manager", "kpi_tracker"],
      safetyRules: [
        "No destructive actions",
        "Must emit plan artifact",
        "Set REVIEW if uncertainty > 0.40",
      ],
    },
    {
      agentId: "dept_sec_01",
      type: "department",
      name: "Security & Compliance",
      responsibility:
        "Enforce policy, key protection, approvals, and external-effect gating.",
      tools: ["policy_engine", "approval_gate", "kms_client", "secrets_validator"],
      safetyRules: [
        "Never store plaintext API keys",
        "Require explicit approval for destructive/external actions",
        "Audit every policy decision",
      ],
    },
    {
      agentId: "dept_runtime_01",
      type: "department",
      name: "Agent Runtime",
      responsibility:
        "Create and supervise worker agents with least-privilege tool access and token budgets.",
      tools: ["agent_factory", "sandbox_runner", "budget_enforcer"],
      safetyRules: [
        "Enforce per-task token limits",
        "Escalate uncertain outputs",
        "Terminate over-budget runs",
      ],
    },
    {
      agentId: "dept_data_01",
      type: "department",
      name: "Data & Audit",
      responsibility: "Persist immutable audit trail and artifact source-of-truth records.",
      tools: ["audit_store", "artifact_store", "integrity_hasher"],
      safetyRules: [
        "Append-only audit records",
        "Artifact required for each major step",
        "Timestamp everything in UTC",
      ],
    },
    {
      agentId: "wrk_intake_01",
      type: "worker",
      name: "Intake Worker",
      department: "Program Management",
      responsibility: "Turn user project input into mission, KPI and queue definitions.",
      tools: ["mission_planner"],
      safetyRules: ["No side effects", "Artifact plan required"],
    },
    {
      agentId: "wrk_policy_01",
      type: "worker",
      name: "Policy Worker",
      department: "Security & Compliance",
      responsibility: "Classify action risk and enforce approval gate policy.",
      tools: ["policy_engine", "approval_gate"],
      safetyRules: ["Never execute destructive actions without approval"],
    },
    {
      agentId: "wrk_audit_01",
      type: "worker",
      name: "Audit Worker",
      department: "Data & Audit",
      responsibility: "Write audit/action records and attach artifact ids.",
      tools: ["audit_store", "artifact_store"],
      safetyRules: ["No commit without audit id"],
    },
  ];
}

function createDefaultQueue(): TaskQueueItem[] {
  return [
    { queueId: id("q_mission_intake"), name: "Mission Intake", status: "PENDING" },
    { queueId: id("q_agent_provision"), name: "Agent Provision", status: "PENDING" },
    { queueId: id("q_policy_gate"), name: "Policy Gate", status: "PENDING" },
    { queueId: id("q_audit_artifact"), name: "Audit & Artifacts", status: "PENDING" },
    { queueId: id("q_stream_events"), name: "Realtime Event Stream", status: "PENDING" },
  ];
}

function appendAudit(
  sessionId: string,
  actorId: string,
  action: string,
  details: Record<string, unknown>,
) {
  const record: AuditRecord = {
    auditId: id("aud"),
    sessionId,
    timestampUtc: nowIso(),
    actorId,
    action,
    details,
  };
  missionStore.appendAudit(record);
  return record;
}

function appendArtifact(
  sessionId: string,
  category: ArtifactRecord["category"],
  title: string,
  payload: Record<string, unknown>,
) {
  const artifact: ArtifactRecord = {
    artifactId: id("art"),
    sessionId,
    createdAtUtc: nowIso(),
    category,
    title,
    payload,
  };
  missionStore.appendArtifact(artifact);
  return artifact;
}

function emitEvent(
  sessionId: string,
  agentId: string,
  type: MissionEvent["type"],
  message: string,
  confidence: number,
  uncertainty: number,
  status: MissionEvent["status"],
  artifactId?: string,
) {
  const audit = appendAudit(sessionId, agentId, `event:${type.toLowerCase()}`, {
    message,
    confidence,
    uncertainty,
    status,
  });

  const event: MissionEvent = {
    eventId: id("evt"),
    sessionId,
    agentId,
    type,
    timestampUtc: nowIso(),
    confidence,
    uncertainty,
    status,
    message,
    artifactId: artifactId ?? null,
    auditId: audit.auditId,
  };
  missionEventBus.publish(event);
  return event;
}

function applyQueueProgress(sessionId: string, queueId: string, status: TaskQueueItem["status"]) {
  missionStore.updateQueueStatus(sessionId, queueId, status);
}

export function startMissionSession(input: StartSessionRequest): StartSessionResponse {
  const sessionId = id("sess");
  const agents = createDefaultAgents();
  const queue = createDefaultQueue();

  let activeModel: ModelConfig = { ...DEFAULT_SAFE_MODEL };

  if (input.userModelOverride) {
    if (input.userModelOverride.apiKey) {
      const secured = validateAndEncryptKey(
        input.userModelOverride.apiKey,
        input.userModelOverride.provider,
      );

      appendAudit(sessionId, "dept_sec_01", "byok.validated_and_encrypted", {
        provider: input.userModelOverride.provider,
        model: input.userModelOverride.model,
        keyRef: secured.keyRef,
        fingerprint: secured.fingerprint,
        encryptedStored: Boolean(secured.encryptedKey),
      });

      activeModel = {
        provider: input.userModelOverride.provider,
        model: input.userModelOverride.model,
        keyRef: secured.keyRef,
        fingerprint: secured.fingerprint,
      };
    } else {
      // Ollama or keyless provider
      activeModel = {
        provider: input.userModelOverride.provider,
        model: input.userModelOverride.model,
      };
    }
  }

  const session: MissionSession = {
    sessionId,
    mission: input.mission,
    modelPolicy: {
      defaultSafeModel: DEFAULT_SAFE_MODEL,
      activeModel,
    },
    createdAgents: agents,
    taskQueue: queue,
    status: "RUNNING",
  };
  missionStore.saveSession(session);

  const planArtifact = appendArtifact(sessionId, "plan", "Mission Plan", {
    mission: input.mission,
    departments: input.mission.requiredDepartments,
    kpiCount: input.mission.kpis.length,
  });

  applyQueueProgress(sessionId, queue[0].queueId, "COMPLETED");
  applyQueueProgress(sessionId, queue[1].queueId, "RUNNING");

  emitEvent(
    sessionId,
    "wrk_intake_01",
    "THOUGHT",
    "Planned mission with measurable KPIs and assigned departments.",
    0.9,
    input.mission.uncertainty ?? 0.1,
    "RUNNING",
    planArtifact.artifactId,
  );

  emitEvent(
    sessionId,
    "dept_data_01",
    "ARTIFACT",
    "Plan artifact stored as source-of-truth for verification.",
    0.95,
    input.mission.uncertainty ?? 0.1,
    "RUNNING",
    planArtifact.artifactId,
  );

  const uncertainty = input.mission.uncertainty ?? 0.1;
  if (uncertainty > 0.4) {
    const reviewQueue: TaskQueueItem = {
      queueId: id("q_review_subtask"),
      name: "Review Subtask",
      status: "REVIEW",
    };
    const updated = missionStore.getSession(sessionId);
    if (updated) {
      updated.taskQueue.push(reviewQueue);
      updated.status = "REVIEW";
      missionStore.saveSession(updated);
    }

    appendArtifact(sessionId, "tests", "Review Trigger", {
      reason: "Uncertainty above 40% threshold",
      uncertainty,
    });

    emitEvent(
      sessionId,
      "wrk_audit_01",
      "STATUS",
      "Uncertainty threshold exceeded; spawned review subtask and set status to REVIEW.",
      0.88,
      uncertainty,
      "REVIEW",
    );
  }

  const finalSession = missionStore.getSession(sessionId);

  return {
    sessionId,
    createdAgents: agents,
    taskQueueIds: (finalSession?.taskQueue ?? queue).map((item) => item.queueId),
    streamingEndpoint: `/api/mission-control/events/${sessionId}`,
    status: finalSession?.status ?? "RUNNING",
  };
}

export function listSessionArtifacts(sessionId: string) {
  return missionStore.getArtifacts(sessionId);
}

export function listSessionAudit(sessionId: string) {
  return missionStore.getAudits(sessionId);
}

export function recordApproval(
  sessionId: string,
  requestedByAgentId: string,
  actionType: string,
  approvedBy: string,
  approved: boolean,
) {
  const approval: ApprovalRecord = {
    approvalId: id("apr"),
    sessionId,
    approvedAtUtc: nowIso(),
    requestedByAgentId,
    actionType,
    approvedBy,
    approved,
  };

  missionStore.appendApproval(approval);
  appendAudit(sessionId, requestedByAgentId, "approval.recorded", {
    actionType,
    approvedBy,
    approved,
  });

  emitEvent(
    sessionId,
    requestedByAgentId,
    approved ? "ACTION" : "STATUS",
    approved
      ? `Human approval recorded for action '${actionType}'.`
      : `Human denied action '${actionType}'.`,
    0.98,
    0.02,
    approved ? "RUNNING" : "BLOCKED",
  );

  return approval;
}

export function executeActionWithGate(
  sessionId: string,
  actorId: string,
  actionType: string,
  actionRisk: ActionRisk,
  payload: Record<string, unknown>,
) {
  const isSensitive = actionRisk !== "safe" || DESTRUCTIVE_ACTIONS.has(actionType);

  if (isSensitive && !missionStore.hasApproval(sessionId, actionType)) {
    appendAudit(sessionId, actorId, "action.blocked.awaiting_approval", {
      actionType,
      actionRisk,
      payload,
    });

    emitEvent(
      sessionId,
      actorId,
      "APPROVAL_REQUIRED",
      `Action '${actionType}' blocked pending explicit human approval.`,
      0.97,
      0.03,
      "BLOCKED",
    );

    return {
      ok: false,
      status: "BLOCKED" as const,
      message: "Approval required before destructive or external action execution.",
    };
  }

  const audit = appendAudit(sessionId, actorId, "action.executed", {
    actionType,
    actionRisk,
    payload,
  });

  const artifact = appendArtifact(sessionId, "deliverable", `Executed ${actionType}`, {
    actionType,
    payload,
    auditId: audit.auditId,
  });

  emitEvent(
    sessionId,
    actorId,
    "ACTION",
    `Executed action '${actionType}' with required approvals in place.`,
    0.93,
    0.07,
    "COMPLETED",
    artifact.artifactId,
  );

  return {
    ok: true,
    status: "COMPLETED" as const,
    artifactId: artifact.artifactId,
    auditId: audit.auditId,
  };
}
