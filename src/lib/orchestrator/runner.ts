import type { AgentKey } from "@/lib/ai/schemas";
import { runAgentByKey } from "@/lib/agents";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AgentOutputRow, MissionRow, MissionStepRow, StepStatus } from "@/types/mission";
import { getMissionStepSummary, getNextRunnableStep, setMissionStepStatus } from "@/lib/orchestrator/dispatcher";
import { logMissionEvent } from "@/lib/orchestrator/events";

type OutputKind = "research" | "prd" | "architecture" | "budget" | "marketing" | "review";

const OUTPUT_KIND_BY_AGENT: Record<AgentKey, OutputKind> = {
  coordinator: "prd",
  analyst: "research",
  product: "prd",
  engineer: "architecture",
  finance: "budget",
  marketing: "marketing",
  observer: "review",
};

function nowIso() {
  return new Date().toISOString();
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown mission execution error";
}

function buildStepPrompt(mission: MissionRow, step: MissionStepRow): string {
  return [
    `Mission title: ${mission.title}`,
    `Mission prompt: ${mission.original_prompt}`,
    `Step: ${step.title}`,
    `Description: ${step.description}`,
  ].join("\n");
}

async function getMission(missionId: string): Promise<MissionRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to load mission: ${error?.message ?? "Mission not found"}`);
  }

  return data as MissionRow;
}

async function updateMissionStatus(missionId: string, status: MissionRow["status"]) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("missions")
    .update({ status, updated_at: nowIso() })
    .eq("id", missionId);

  if (error) {
    throw new Error(`Failed to update mission status: ${error.message}`);
  }
}

async function getAgentOutputs(missionId: string): Promise<AgentOutputRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("agent_outputs")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load agent outputs: ${error.message}`);
  }

  return (data ?? []) as AgentOutputRow[];
}

async function buildAgentContext(missionId: string): Promise<Record<string, unknown>> {
  const outputs = await getAgentOutputs(missionId);
  const latestByKind = outputs.reduce<Record<string, { agent: string; markdown: string | null }>>(
    (acc, item) => {
      acc[item.kind] = {
        agent: item.agent_key,
        markdown: item.content_md,
      };
      return acc;
    },
    {},
  );

  return {
    outputCount: outputs.length,
    latestByKind,
  };
}

async function saveAgentOutput(input: {
  missionId: string;
  stepId: string;
  agentKey: AgentKey;
  markdown: string;
  structured: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdmin();

  const { data: existingRows, error: versionError } = await supabase
    .from("agent_outputs")
    .select("id")
    .eq("mission_id", input.missionId)
    .eq("step_id", input.stepId);

  if (versionError) {
    throw new Error(`Failed to read output versions: ${versionError.message}`);
  }

  const version = (existingRows?.length ?? 0) + 1;

  const { error } = await supabase.from("agent_outputs").insert({
    mission_id: input.missionId,
    step_id: input.stepId,
    agent_key: input.agentKey,
    kind: OUTPUT_KIND_BY_AGENT[input.agentKey],
    content_md: input.markdown,
    content_json: input.structured,
    version,
  });

  if (error) {
    throw new Error(`Failed to persist agent output: ${error.message}`);
  }
}

async function setStepOutputJson(
  missionId: string,
  stepId: string,
  status: StepStatus,
  outputJson: Record<string, unknown>,
) {
  await setMissionStepStatus(missionId, stepId, status, { output_json: outputJson });
}

async function executeStep(mission: MissionRow, step: MissionStepRow): Promise<void> {
  await setMissionStepStatus(mission.id, step.id, "running", {
    input_json: {
      missionPrompt: mission.original_prompt,
      startedBy: "orchestrator.runner",
    },
  });

  await logMissionEvent({
    missionId: mission.id,
    stepId: step.id,
    eventType: "step_started",
    payload: {
      agent: step.agent_key,
      title: step.title,
    },
  });

  const context = await buildAgentContext(mission.id);

  const result = await runAgentByKey(step.agent_key, {
    missionId: mission.id,
    stepId: step.id,
    prompt: buildStepPrompt(mission, step),
    context,
  });

  await saveAgentOutput({
    missionId: mission.id,
    stepId: step.id,
    agentKey: step.agent_key,
    markdown: result.markdown,
    structured: {
      ...result.structured,
      summary: result.summary,
      confidence: result.confidence,
      needsRevision: result.needsRevision,
    },
  });

  if (result.needsRevision) {
    await setStepOutputJson(mission.id, step.id, "needs_review", {
      summary: result.summary,
      confidence: result.confidence,
      needsRevision: true,
    });

    await logMissionEvent({
      missionId: mission.id,
      stepId: step.id,
      eventType: "review_failed",
      payload: {
        agent: step.agent_key,
        summary: result.summary,
      },
    });
    return;
  }

  await setStepOutputJson(mission.id, step.id, "completed", {
    summary: result.summary,
    confidence: result.confidence,
    needsRevision: false,
  });

  await logMissionEvent({
    missionId: mission.id,
    stepId: step.id,
    eventType: "step_completed",
    payload: {
      agent: step.agent_key,
      summary: result.summary,
      confidence: result.confidence,
    },
  });
}

async function finalizeMissionStatus(missionId: string) {
  const summary = await getMissionStepSummary(missionId);

  if (summary.failed > 0) {
    await updateMissionStatus(missionId, "failed");
    await logMissionEvent({
      missionId,
      eventType: "mission_failed",
      payload: summary,
    });
    return;
  }

  if (summary.needs_review > 0) {
    await updateMissionStatus(missionId, "failed");
    await logMissionEvent({
      missionId,
      eventType: "mission_needs_review",
      payload: summary,
    });
    return;
  }

  if (summary.pending === 0 && summary.running === 0) {
    await updateMissionStatus(missionId, "completed");
    await logMissionEvent({
      missionId,
      eventType: "mission_completed",
      payload: summary,
    });
    return;
  }

  await updateMissionStatus(missionId, "running");
}

async function runMissionInternal(missionId: string): Promise<void> {
  const mission = await getMission(missionId);

  await updateMissionStatus(mission.id, "running");
  await logMissionEvent({
    missionId: mission.id,
    eventType: "mission_started",
    payload: {
      startedAt: nowIso(),
    },
  });

  while (true) {
    const next = await getNextRunnableStep(mission.id);
    if (!next) {
      break;
    }

    try {
      await executeStep(mission, next);
    } catch (error) {
      const message = toErrorMessage(error);
      await setMissionStepStatus(mission.id, next.id, "failed", {
        output_json: {
          error: message,
        },
      });

      await logMissionEvent({
        missionId: mission.id,
        stepId: next.id,
        eventType: "step_failed",
        payload: {
          agent: next.agent_key,
          error: message,
        },
      });

      await updateMissionStatus(mission.id, "failed");
      await logMissionEvent({
        missionId: mission.id,
        eventType: "mission_failed",
        payload: {
          reason: message,
          failedStepId: next.id,
        },
      });
      return;
    }
  }

  await finalizeMissionStatus(mission.id);
}

declare global {
  var __runningMissionIds: Set<string> | undefined;
}

const runningMissionIds = globalThis.__runningMissionIds ?? new Set<string>();

if (!globalThis.__runningMissionIds) {
  globalThis.__runningMissionIds = runningMissionIds;
}

export function startMissionRun(missionId: string): { accepted: boolean; reason?: string } {
  if (runningMissionIds.has(missionId)) {
    return { accepted: false, reason: "Mission is already running." };
  }

  runningMissionIds.add(missionId);

  void runMissionInternal(missionId)
    .catch(async (error) => {
      await updateMissionStatus(missionId, "failed");
      await logMissionEvent({
        missionId,
        eventType: "mission_failed",
        payload: {
          reason: toErrorMessage(error),
        },
      });
    })
    .finally(() => {
      runningMissionIds.delete(missionId);
    });

  return { accepted: true };
}
