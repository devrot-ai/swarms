/**
 * Chat API Route - AI Agentic Company
 * 
 * This route handles user messages and orchestrates the AI agents
 * with robust fallback logic and error recovery.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { agentExecutor } from "@/lib/mission-control/agents/executor";
import { ModelProvider } from "@/lib/mission-control/models/provider";
import { taskQueue, createAgentTask } from "@/lib/mission-control/queue/taskQueue";
import { agentMetadata, type AgentId } from "@/lib/mission-control/agents";
import { missionStore } from "@/lib/mission-control/stores";
import { missionEventBus } from "@/lib/mission-control/eventBus";
import type { MissionEvent } from "@/lib/mission-control/types";
import { 
  type ResponseMode, 
  getResponseModePrompt, 
  responseModes,
  getDemoResponseSuffix,
  getContextMultiplier,
} from "@/lib/mission-control/responseMode";
import { contextManager } from "@/lib/mission-control/contextManager";

interface ChatInput {
  sessionId: string;
  message: string;
  preferredModel?: string;
  preferredProvider?: string;
  responseMode?: ResponseMode;
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export const maxDuration = 60;

// Intent to agent pipeline mapping
const intentToAgentPipeline: Record<string, AgentId[]> = {
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

// Get system prompt for each agent
function getAgentSystemPrompt(agentId: AgentId): string {
  const prompts: Record<AgentId, string> = {
    ceo_agent: `You are the CEO Agent of an AI-powered company. You are the strategic leader responsible for:
- Setting company vision and strategic direction
- Making high-level decisions on projects and initiatives
- Approving major plans and budgets
- Coordinating between departments
Be decisive, strategic, and focus on business impact.`,
    
    coo_agent: `You are the COO Agent responsible for operations and execution. Your role is to:
- Transform strategic plans into actionable tasks
- Coordinate cross-functional execution
- Manage project timelines and dependencies
- Ensure operational efficiency
Be practical, organized, and action-oriented.`,
    
    cto_agent: `You are the CTO Agent, the technical leader of the company. Your responsibilities:
- Technical architecture decisions
- Technology strategy and roadmap
- Code quality and best practices
- Security and performance standards
Be thorough, technically precise, and security-conscious.`,
    
    cfo_agent: `You are the CFO Agent, responsible for financial management and planning.
- Budget planning and allocation
- Financial analysis and forecasting
- ROI evaluation for initiatives
- Cost optimization
Be analytical, numbers-focused, and risk-aware.`,
    
    marketing_agent: `You are the Marketing Agent, responsible for growth and brand communications.
- Marketing strategy and campaigns
- Brand messaging and positioning
- Content creation and distribution
- Market research and competitive analysis
Be creative, customer-focused, and data-driven.`,
    
    hr_agent: `You are the HR Agent, responsible for people operations and culture.
- Team capacity planning
- Resource allocation
- Skills assessment
- Team structure recommendations
Be people-focused, analytical, and supportive.`,
    
    legal_agent: `You are the Legal Agent, responsible for compliance and legal matters.
- Contract review and negotiation
- Regulatory compliance
- Risk assessment
- Policy development
Be thorough, cautious, and compliance-focused.`,
    
    qa_agent: `You are the QA Agent, responsible for quality assurance and testing.
- Test planning and execution
- Quality standards enforcement
- Bug identification and tracking
- Test automation strategy
Be detail-oriented, systematic, and quality-focused.`,
    
    devops_agent: `You are the DevOps Agent, responsible for infrastructure and deployments.
- Infrastructure management
- CI/CD pipeline maintenance
- Deployment automation
- Monitoring and alerting
Be reliability-focused, automation-first, and proactive.`,
    
    design_agent: `You are the Design Agent, responsible for user experience and visual design.
- User experience design
- Visual design and branding
- Design system maintenance
- User research insights
Be user-centered, creative, and accessibility-conscious.`,
    
    research_agent: `You are the Research Agent, responsible for information gathering and analysis.
- Market research and analysis
- Competitive intelligence
- Technical research
- Trend analysis
Be thorough, evidence-based, and insightful.`,
    
    worker_agent: `You are a Worker Agent, responsible for executing specific tasks assigned to you.
- Execute assigned tasks efficiently
- Follow instructions precisely
- Report progress and blockers
- Produce quality deliverables
Be efficient, precise, and communicative.`,
  };

  return prompts[agentId];
}

// Emit mission event for tracking
function emitMissionEvent(
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

// Build context from session history with extended context management
function buildSessionContext(sessionId: string, responseMode: ResponseMode = "balanced"): string {
  const audit = missionStore.getAudits(sessionId);
  const artifacts = missionStore.getArtifacts(sessionId);
  const session = missionStore.getSession(sessionId);
  
  // Get context multiplier based on response mode
  const contextMultiplier = getContextMultiplier(responseMode);
  const maxTurns = Math.floor(10 * contextMultiplier);

  const parts: string[] = [];
  
  if (session) {
    parts.push(`Mission: ${session.mission.objective}`);
    parts.push(`Status: ${session.status}`);
  }
  
  // Add conversation context from context manager
  const conversationContext = contextManager.getFormattedContext(sessionId, maxTurns);
  if (conversationContext) {
    parts.push(`\n${conversationContext}`);
  }
  
  // Get context stats for transparency
  const stats = contextManager.getStats(sessionId);
  if (stats.turnCount > 0) {
    parts.push(`\n[Context: ${stats.turnCount} turns, ${stats.keyTopicsCount} topics tracked]`);
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatInput;

    if (!body?.sessionId || !body?.message?.trim()) {
      return NextResponse.json(
        { error: "sessionId and message are required." },
        { status: 400 },
      );
    }

    const { sessionId, message, preferredProvider } = body;
    const responseMode: ResponseMode = body.responseMode ?? "balanced";
    const modeConfig = responseModes[responseMode];

    // Emit user message
    emitMissionEvent(sessionId, "user", "THOUGHT", `User: ${message}`, 1.0, "RUNNING");

    // Track conversation in context manager
    contextManager.addTurn(sessionId, {
      role: "user",
      content: message,
      responseMode: responseMode,
    });

    // Create a task for this request
    const mainTask = createAgentTask(
      "orchestrator",
      "process_message",
      message,
      { sessionId, message },
      { priority: "high" }
    );

    taskQueue.updateTaskStatus(mainTask.id, "running");

    // Stream responses
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Step 1: Classify intent with fallback
          send({ type: "progress", agent: "orchestrator", agentName: "Orchestrator", label: "Analyzing your request...", step: 1, totalSteps: 3 });
          
          const classification = await agentExecutor.classifyIntent(message);
          
          send({
            type: "classification",
            intent: classification.intent,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
            model: classification.model,
          });

          // Get the agent pipeline
          const agentIds = intentToAgentPipeline[classification.intent] ?? ["ceo_agent"];
          
          send({
            type: "pipeline",
            agents: agentIds.map(aid => ({
              id: aid,
              name: agentMetadata[aid].name,
              department: agentMetadata[aid].department,
            })),
          });

          // Build context with extended context management
          const context = buildSessionContext(sessionId, responseMode);
          const previousResults: string[] = [];

          // Step 2: Execute each agent in the pipeline
          for (let i = 0; i < agentIds.length; i++) {
            const agentId = agentIds[i];
            const meta = agentMetadata[agentId];

            send({
              type: "progress",
              agent: agentId,
              agentName: meta.name,
              department: meta.department,
              step: i + 1,
              totalSteps: agentIds.length,
              label: `${meta.name} is ${meta.description.toLowerCase()}...`,
            });

            // Build prompt with context from previous agents
            let agentPrompt = message;
            if (previousResults.length > 0) {
              agentPrompt = `Based on the previous analysis:\n\n${previousResults.map((r, idx) => {
                const prevAgent = agentMetadata[agentIds[idx]];
                return `--- ${prevAgent.name} (${prevAgent.department}) ---\n${r}`;
              }).join("\n\n")}\n\nNow, the user's request: ${message}\n\nProvide your analysis and recommendations from your perspective as ${meta.name}.`;
            }

            if (context) {
              agentPrompt = `CONTEXT:\n${context}\n\n${agentPrompt}`;
            }

            // Add response mode instruction
            const responseModeInstruction = getResponseModePrompt(responseMode);
            const systemPrompt = getAgentSystemPrompt(agentId) + "\n\n" + responseModeInstruction;

            // Execute agent with fallback
            const result = await agentExecutor.execute(
              agentId,
              agentPrompt,
              systemPrompt,
              {},
              {
                preferredProvider: preferredProvider as "openai" | "anthropic" | "google" | "groq" | undefined,
                streamTokens: true,
                responseMode: responseMode,
                onToken: (token) => {
                  send({
                    type: "token",
                    agent: agentId,
                    token,
                    step: i + 1,
                  });
                },
                onModelSwitch: (from, to, reason) => {
                  send({
                    type: "model_switch",
                    agent: agentId,
                    from,
                    to,
                    reason,
                  });
                },
              }
            );

            // Record result
            previousResults.push(result.content);

            // Emit event
            emitMissionEvent(
              sessionId,
              agentId,
              "THOUGHT",
              result.content.slice(0, 500),
              result.success ? 0.9 : 0.5,
              result.success ? "RUNNING" : "WARNING",
            );

            // Track agent response in context manager
            contextManager.addTurn(sessionId, {
              role: "agent",
              content: result.content,
              agentId: agentId,
              responseMode: responseMode,
              metadata: {
                intent: classification.intent,
                tokensUsed: result.tokensUsed,
              },
            });

            // Send response
            send({
              type: "response",
              agent: agentId,
              agentName: meta.name,
              department: meta.department,
              message: result.content,
              timestamp: nowIso(),
              step: i + 1,
              totalSteps: agentIds.length,
              model: result.model,
              tokensUsed: result.tokensUsed,
              fallbacksUsed: result.fallbacksUsed,
              success: result.success,
              error: result.error,
              responseMode: responseMode,
              responseModeLabel: modeConfig.label,
            });

            // If this agent failed completely, we still continue to next agent
          }

          // Mark task complete
          taskQueue.updateTaskStatus(mainTask.id, "completed", { 
            agentsUsed: agentIds.length,
            intent: classification.intent,
          });

          // Send completion
          send({
            type: "done",
            intent: classification.intent,
            agentsUsed: agentIds.length,
            timestamp: nowIso(),
            taskId: mainTask.id,
          });

        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error("Agent pipeline error:", msg);
          
          taskQueue.updateTaskStatus(mainTask.id, "failed", undefined, msg);
          
          send({ 
            type: "error", 
            error: msg,
            recoverable: true,
            suggestion: "Try again or check your AI provider configuration.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat route error:", msg);
    return NextResponse.json(
      {
        error: "Failed to process chat message.",
        details: msg,
        suggestion: "Check server logs for more details.",
      },
      { status: 500 },
    );
  }
}
