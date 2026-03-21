/**
 * Agent Orchestrator
 * 
 * This module routes user requests to the appropriate agents and manages
 * multi-agent collaboration for complex tasks.
 */

import { streamText, convertToModelMessages, stepCountIs, Output } from "ai";
import { z } from "zod";
import crypto from "node:crypto";
import { agents, agentMetadata, type AgentId } from "./agents";
import { missionStore } from "./stores";
import { missionEventBus } from "./eventBus";
import type { MissionEvent } from "./types";

// Default model for classification
const CLASSIFIER_MODEL = "openai/gpt-4o-mini";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ============================================================
// INTENT CLASSIFICATION
// ============================================================

export type Intent = 
  | "strategic_planning"     // High-level strategy, vision, goals
  | "operational_planning"   // Task breakdown, execution planning
  | "technical_build"        // Code, implementation, technical work
  | "technical_review"       // Code review, architecture review
  | "research"               // Market research, competitive analysis
  | "marketing"              // Campaigns, content, growth
  | "financial"              // Budget, ROI, financial planning
  | "hr_planning"            // Team capacity, hiring, resources
  | "legal_compliance"       // Contracts, compliance, legal
  | "qa_testing"             // Testing, quality assurance
  | "infrastructure"         // DevOps, deployment, infrastructure
  | "design"                 // UX, visual design
  | "status_report"          // Progress updates, status checks
  | "general";               // General questions or unclear intent

const intentToAgentPipeline: Record<Intent, AgentId[]> = {
  strategic_planning: ["ceo_agent", "coo_agent"],
  operational_planning: ["coo_agent", "worker_agent"],
  technical_build: ["cto_agent", "worker_agent"],
  technical_review: ["cto_agent", "qa_agent"],
  research: ["research_agent"],
  marketing: ["marketing_agent"],
  financial: ["cfo_agent"],
  hr_planning: ["hr_agent"],
  legal_compliance: ["legal_agent"],
  qa_testing: ["qa_agent"],
  infrastructure: ["devops_agent"],
  design: ["design_agent"],
  status_report: ["coo_agent"],
  general: ["ceo_agent"],
};

/**
 * Classify the user's intent to determine which agents should handle the request
 */
export async function classifyIntent(message: string): Promise<{ intent: Intent; confidence: number; reasoning: string }> {
  const result = await streamText({
    model: CLASSIFIER_MODEL,
    output: Output.object({
      schema: z.object({
        intent: z.enum([
          "strategic_planning",
          "operational_planning", 
          "technical_build",
          "technical_review",
          "research",
          "marketing",
          "financial",
          "hr_planning",
          "legal_compliance",
          "qa_testing",
          "infrastructure",
          "design",
          "status_report",
          "general",
        ]),
        confidence: z.number().min(0).max(1),
        reasoning: z.string(),
      }),
    }),
    prompt: `Classify the user's intent based on their message.

USER MESSAGE: "${message}"

CLASSIFICATION GUIDE:
- strategic_planning: High-level strategy, company vision, major decisions, planning a new product/initiative
- operational_planning: Breaking down plans into tasks, project management, timelines, execution planning
- technical_build: Building features, writing code, implementing solutions, creating technical components
- technical_review: Code review, architecture review, technical assessment, security review
- research: Market research, competitor analysis, data gathering, trend analysis
- marketing: Marketing campaigns, content creation, branding, growth strategies, go-to-market
- financial: Budgets, ROI calculations, financial planning, cost analysis
- hr_planning: Team capacity, hiring, resource allocation, skills assessment
- legal_compliance: Contracts, legal review, compliance checks, regulatory matters
- qa_testing: Testing, quality assurance, bug tracking, test planning
- infrastructure: DevOps, deployment, CI/CD, infrastructure, monitoring
- design: UX design, visual design, user interface, accessibility
- status_report: Progress updates, status checks, what's been done
- general: Unclear or doesn't fit other categories

Classify the intent with high accuracy.`,
  });

  const output = await result.output;
  
  if (!output) {
    return {
      intent: "general",
      confidence: 0.5,
      reasoning: "Could not classify intent, defaulting to general",
    };
  }

  return output;
}

// ============================================================
// AGENT PIPELINE EXECUTION
// ============================================================

export interface PipelineStep {
  agentId: AgentId;
  agentName: string;
  department: string;
  thinkingLabel: string;
}

export interface PipelineResult {
  agentId: AgentId;
  content: string;
  timestamp: string;
  tokensUsed?: number;
  toolCalls?: Array<{ tool: string; result: unknown }>;
}

/**
 * Get the agent pipeline for a given intent
 */
export function getPipelineForIntent(intent: Intent): PipelineStep[] {
  const agentIds = intentToAgentPipeline[intent];
  
  return agentIds.map((agentId) => {
    const meta = agentMetadata[agentId];
    return {
      agentId,
      agentName: meta.name,
      department: meta.department,
      thinkingLabel: `${meta.name} is ${meta.description.toLowerCase()}...`,
    };
  });
}

/**
 * Build context from session history
 */
export function buildSessionContext(sessionId: string): string {
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
    parts.push(`\nRecent activity (${audit.length} total):`);
    for (const a of audit.slice(-5)) {
      parts.push(`  - ${a.timestampUtc.slice(11, 19)} ${a.action}`);
    }
  }
  
  if (artifacts.length > 0) {
    parts.push(`\nArtifacts produced: ${artifacts.map((a) => a.title).join(", ")}`);
  }
  
  return parts.join("\n");
}

/**
 * Emit a mission event for tracking
 */
export function emitMissionEvent(
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
    action: `agent.${type.toLowerCase()}`,
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
    message: message.slice(0, 200),
    auditId,
    artifactId: null,
  });
}

/**
 * Execute a single agent in the pipeline with streaming
 */
export async function executeAgentWithStreaming(
  agentId: AgentId,
  prompt: string,
  context: string,
  onToken: (token: string) => void,
  previousResults: string[] = [],
): Promise<PipelineResult> {
  const agent = agents[agentId];
  const meta = agentMetadata[agentId];
  
  // Build the full prompt with context and previous results
  let fullPrompt = prompt;
  
  if (previousResults.length > 0) {
    fullPrompt = `PREVIOUS AGENT OUTPUTS:\n${previousResults.map((r, i) => `--- Agent ${i + 1} ---\n${r}`).join("\n\n")}\n\nCURRENT TASK:\n${prompt}`;
  }
  
  if (context) {
    fullPrompt = `CONTEXT:\n${context}\n\n${fullPrompt}`;
  }

  // Stream from the agent
  const stream = agent.stream({ prompt: fullPrompt });
  
  let content = "";
  const toolCalls: Array<{ tool: string; result: unknown }> = [];
  
  // Collect the streamed text
  for await (const chunk of stream.textStream) {
    content += chunk;
    onToken(chunk);
  }
  
  // Get final result with tool call info
  const result = await stream;
  
  if (result.toolCalls && result.toolCalls.length > 0) {
    for (const tc of result.toolCalls) {
      toolCalls.push({
        tool: tc.toolName,
        result: tc.result ?? null,
      });
    }
  }

  return {
    agentId,
    content,
    timestamp: nowIso(),
    tokensUsed: result.usage?.totalTokens,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

// ============================================================
// COMPANY-WIDE ORCHESTRATION
// ============================================================

export interface CompanyTask {
  id: string;
  description: string;
  assignedTo: AgentId;
  status: "pending" | "in_progress" | "completed" | "blocked";
  result?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Execute a full company workflow for a complex task
 * This orchestrates multiple agents working together
 */
export async function executeCompanyWorkflow(
  sessionId: string,
  task: string,
  onProgress: (update: { agent: string; status: string; message: string }) => void,
): Promise<{ tasks: CompanyTask[]; summary: string }> {
  const tasks: CompanyTask[] = [];
  
  // Step 1: CEO creates strategic plan
  onProgress({ agent: "CEO", status: "planning", message: "Creating strategic plan..." });
  
  const ceoPlan = await agents.ceo_agent.generate({
    prompt: `Create a strategic plan for: ${task}
    
    Include:
    1. Mission objective
    2. Key success metrics
    3. Departments to involve
    4. High-level timeline
    5. Risk considerations`,
  });
  
  tasks.push({
    id: id("task"),
    description: "Strategic planning",
    assignedTo: "ceo_agent",
    status: "completed",
    result: ceoPlan.text,
    createdAt: nowIso(),
    completedAt: nowIso(),
  });
  
  // Step 2: COO breaks down into tasks
  onProgress({ agent: "COO", status: "planning", message: "Breaking down into actionable tasks..." });
  
  const cooTasks = await agents.coo_agent.generate({
    prompt: `Based on this CEO plan, create detailed execution tasks:
    
    ${ceoPlan.text}
    
    For each task include:
    - Title
    - Description
    - Assigned department
    - Priority (P0/P1/P2)
    - Time estimate`,
  });
  
  tasks.push({
    id: id("task"),
    description: "Task breakdown",
    assignedTo: "coo_agent",
    status: "completed",
    result: cooTasks.text,
    createdAt: nowIso(),
    completedAt: nowIso(),
  });
  
  // Step 3: Technical assessment if needed
  if (task.toLowerCase().includes("build") || task.toLowerCase().includes("code") || task.toLowerCase().includes("implement")) {
    onProgress({ agent: "CTO", status: "reviewing", message: "Technical assessment..." });
    
    const ctoReview = await agents.cto_agent.generate({
      prompt: `Review the technical aspects of this plan:
      
      ${cooTasks.text}
      
      Provide:
      - Technical recommendations
      - Architecture considerations
      - Technology choices
      - Risk assessment`,
    });
    
    tasks.push({
      id: id("task"),
      description: "Technical review",
      assignedTo: "cto_agent",
      status: "completed",
      result: ctoReview.text,
      createdAt: nowIso(),
      completedAt: nowIso(),
    });
  }
  
  // Step 4: Financial assessment if needed
  if (task.toLowerCase().includes("budget") || task.toLowerCase().includes("cost") || task.toLowerCase().includes("roi")) {
    onProgress({ agent: "CFO", status: "analyzing", message: "Financial assessment..." });
    
    const cfoReview = await agents.cfo_agent.generate({
      prompt: `Provide financial analysis for this initiative:
      
      ${ceoPlan.text}
      
      Include:
      - Budget estimate
      - ROI projection
      - Risk-adjusted returns
      - Financial recommendations`,
    });
    
    tasks.push({
      id: id("task"),
      description: "Financial analysis",
      assignedTo: "cfo_agent",
      status: "completed",
      result: cfoReview.text,
      createdAt: nowIso(),
      completedAt: nowIso(),
    });
  }
  
  // Generate summary
  const summary = `Completed ${tasks.length} tasks across ${new Set(tasks.map(t => t.assignedTo)).size} departments. Key deliverables include strategic planning, task breakdown, and specialized assessments.`;
  
  return { tasks, summary };
}

// ============================================================
// SPECIALIZED PIPELINES
// ============================================================

/**
 * Pipeline for building/implementing something
 */
export function getBuildPipeline(): PipelineStep[] {
  return [
    {
      agentId: "cto_agent",
      agentName: "CTO",
      department: "Technology",
      thinkingLabel: "CTO is designing the technical approach...",
    },
    {
      agentId: "worker_agent",
      agentName: "Worker",
      department: "Engineering",
      thinkingLabel: "Worker is implementing the solution...",
    },
    {
      agentId: "qa_agent",
      agentName: "QA Lead",
      department: "Quality",
      thinkingLabel: "QA is validating the implementation...",
    },
  ];
}

/**
 * Pipeline for strategic planning
 */
export function getStrategyPipeline(): PipelineStep[] {
  return [
    {
      agentId: "ceo_agent",
      agentName: "CEO",
      department: "Executive",
      thinkingLabel: "CEO is crafting the strategy...",
    },
    {
      agentId: "coo_agent",
      agentName: "COO",
      department: "Operations", 
      thinkingLabel: "COO is creating execution plan...",
    },
  ];
}

/**
 * Pipeline for research tasks
 */
export function getResearchPipeline(): PipelineStep[] {
  return [
    {
      agentId: "research_agent",
      agentName: "Research Analyst",
      department: "Research",
      thinkingLabel: "Research is gathering information...",
    },
  ];
}

/**
 * Pipeline for marketing tasks
 */
export function getMarketingPipeline(): PipelineStep[] {
  return [
    {
      agentId: "marketing_agent",
      agentName: "Marketing Lead",
      department: "Marketing",
      thinkingLabel: "Marketing is developing the campaign...",
    },
  ];
}
