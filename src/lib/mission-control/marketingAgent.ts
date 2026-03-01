import crypto from "node:crypto";
import { missionStore } from "@/lib/mission-control/stores";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import {
  ArtifactRecord,
  AuditRecord,
  MarketingAgentRequest,
  MarketingAgentResponse,
  MarketingCitation,
  MarketingReasoningTraceItem,
  MissionEvent,
} from "@/lib/mission-control/types";

const MARKETING_AGENT_ID = "dept_marketing_01";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function appendAudit(sessionId: string, action: string, details: Record<string, unknown>) {
  const audit: AuditRecord = {
    auditId: id("aud"),
    sessionId,
    timestampUtc: nowIso(),
    actorId: MARKETING_AGENT_ID,
    action,
    details,
  };
  missionStore.appendAudit(audit);
  return audit;
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

function emitThought(
  sessionId: string,
  thought: string,
  confidence: number,
  uncertainty: number,
  trace: MarketingReasoningTraceItem[],
) {
  const item: MarketingReasoningTraceItem = {
    timestampUtc: nowIso(),
    thought,
    confidence,
  };
  trace.push(item);

  const audit = appendAudit(sessionId, "marketing.thought", {
    thought,
    confidence,
    uncertainty,
  });

  const event: MissionEvent = {
    eventId: id("evt"),
    sessionId,
    agentId: MARKETING_AGENT_ID,
    type: "THOUGHT",
    timestampUtc: item.timestampUtc,
    confidence,
    uncertainty,
    status: "RUNNING",
    message: thought,
    artifactId: null,
    auditId: audit.auditId,
  };
  missionEventBus.publish(event);
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || "Untitled source";
}

async function captureCitation(sessionId: string, url: string): Promise<MarketingCitation> {
  const retrievedAtUtc = nowIso();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "MissionControl-MarketingAgent/1.0",
      },
    });

    const raw = await response.text();
    const title = extractTitle(raw);
    const snapshot = raw.slice(0, 12000);

    const snapshotArtifact = appendArtifact(sessionId, "other", `Research Snapshot: ${title}`, {
      url,
      status: response.status,
      retrievedAtUtc,
      snapshot,
    });

    appendAudit(sessionId, "marketing.citation.captured", {
      url,
      title,
      snapshotArtifactId: snapshotArtifact.artifactId,
    });

    return {
      url,
      title,
      retrievedAtUtc,
      snapshotArtifactId: snapshotArtifact.artifactId,
      status: "captured",
    };
  } catch (error) {
    const fallbackArtifact = appendArtifact(sessionId, "other", "Research Snapshot Failed", {
      url,
      retrievedAtUtc,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    });

    appendAudit(sessionId, "marketing.citation.failed", {
      url,
      snapshotArtifactId: fallbackArtifact.artifactId,
    });

    return {
      url,
      title: "Source capture failed",
      retrievedAtUtc,
      snapshotArtifactId: fallbackArtifact.artifactId,
      status: "failed",
    };
  }
}

export async function buildMarketingCampaign(
  input: MarketingAgentRequest,
): Promise<MarketingAgentResponse> {
  const sessionId = input.sessionId ?? id("sess_marketing");
  const reasoningTrace: MarketingReasoningTraceItem[] = [];

  emitThought(
    sessionId,
    "Analyzing brief, company memory, and research scope to produce a 3-step campaign plan.",
    0.92,
    0.08,
    reasoningTrace,
  );

  const campaignPlan: [string, string, string] = [
    "Step 1 — Research and Positioning: synthesize company memory and external sources into audience pain points and positioning angles.",
    "Step 2 — Content Production: generate one high-clarity hero message and channel-ready copy variant for initial launch.",
    "Step 3 — Validation and Handoff: run a measurable test, package artifacts, and hand off implementation to Engineering and Publishing.",
  ];

  const citations: MarketingCitation[] = [];
  const researchUrls = input.researchUrls ?? [];

  if (researchUrls.length > 0) {
    emitThought(
      sessionId,
      "Executing read-only web research and capturing raw snapshots as verifiable artifacts.",
      0.89,
      0.11,
      reasoningTrace,
    );

    for (const url of researchUrls) {
      // Sequential fetch to keep compute/network predictable.
      // eslint-disable-next-line no-await-in-loop
      const citation = await captureCitation(sessionId, url);
      citations.push(citation);
    }
  }

  const memorySummary = (input.companyMemory ?? []).slice(0, 3).join(" | ");

  const sampleDeliverable = {
    title: "Mission Control Launch Narrative",
    channel: "blog" as const,
    content:
      `Mission Control turns multi-agent operations into a measurable business engine: ` +
      `clear objectives, audited execution, and approval-safe automation. ${memorySummary ? `Memory signal: ${memorySummary}.` : ""}`.trim(),
  };

  const deliverableArtifact = appendArtifact(sessionId, "deliverable", sampleDeliverable.title, {
    brief: input.brief,
    channel: sampleDeliverable.channel,
    content: sampleDeliverable.content,
  });

  const validationTest = {
    name: "Message Clarity A/B Test",
    method:
      "Publish Variant A (problem-first headline) vs Variant B (outcome-first headline) to equal audience cohorts for 48 hours.",
    passCriteria: "Variant with >= 15% higher CTR and >= 10% higher artifact engagement is accepted.",
  };

  const testArtifact = appendArtifact(sessionId, "tests", validationTest.name, {
    method: validationTest.method,
    passCriteria: validationTest.passCriteria,
  });

  const engineeringArtifactIds = [deliverableArtifact.artifactId, testArtifact.artifactId];
  const publishingArtifactIds = [deliverableArtifact.artifactId, ...citations.map((c) => c.snapshotArtifactId)];

  appendAudit(sessionId, "marketing.handoff.created", {
    engineeringArtifactIds,
    publishingArtifactIds,
  });

  emitThought(
    sessionId,
    "Campaign artifacts are packaged and handed off to Engineering and Publishing with validation criteria.",
    0.94,
    0.06,
    reasoningTrace,
  );

  return {
    sessionId,
    campaignPlan,
    sampleDeliverable,
    validationTest,
    citations,
    reasoningTrace,
    handoff: {
      engineeringArtifactIds,
      publishingArtifactIds,
    },
  };
}
