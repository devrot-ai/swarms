/**
 * Chat API Route - AI Agentic Company
 * 
 * This route handles user messages and orchestrates the AI agents
 * to process requests as a full company would.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  classifyIntent,
  getPipelineForIntent,
  buildSessionContext,
  emitMissionEvent,
  executeAgentWithStreaming,
} from "@/lib/mission-control/orchestrator";
import { agentMetadata, type AgentId } from "@/lib/mission-control/agents";

interface ChatInput {
  sessionId: string;
  message: string;
  model?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export const maxDuration = 60;

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

    // Emit user message
    emitMissionEvent(sessionId, "user", "THOUGHT", `User: ${message}`, 1.0, "RUNNING");

    // Classify the intent to determine which agents should handle this
    const classification = await classifyIntent(message);
    
    // Get the agent pipeline for this intent
    const pipeline = getPipelineForIntent(classification.intent);
    
    // Build context from session history
    const context = buildSessionContext(sessionId);

    // Log the routing decision
    emitMissionEvent(
      sessionId, 
      "orchestrator", 
      "STATUS", 
      `Routing to ${pipeline.map(p => p.agentName).join(" → ")} (intent: ${classification.intent}, confidence: ${(classification.confidence * 100).toFixed(0)}%)`,
      classification.confidence,
      "RUNNING"
    );

    // Stream responses from each agent in the pipeline
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const previousResults: string[] = [];

          // Send classification info
          send({
            type: "classification",
            intent: classification.intent,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
            pipeline: pipeline.map(p => ({
              agentId: p.agentId,
              name: p.agentName,
              department: p.department,
            })),
          });

          for (let i = 0; i < pipeline.length; i++) {
            const step = pipeline[i];
            const meta = agentMetadata[step.agentId as AgentId];

            // Notify frontend that this agent is now thinking
            send({
              type: "progress",
              agent: step.agentId,
              agentName: meta.name,
              department: meta.department,
              step: i + 1,
              totalSteps: pipeline.length,
              label: step.thinkingLabel,
            });

            // Build the prompt for this agent
            let agentPrompt = message;
            
            // Add context from previous agents
            if (previousResults.length > 0) {
              agentPrompt = `Based on the previous analysis:\n\n${previousResults.map((r, idx) => {
                const prevAgent = pipeline[idx];
                return `--- ${prevAgent.agentName} (${prevAgent.department}) ---\n${r}`;
              }).join("\n\n")}\n\nNow, the user's request: ${message}\n\nProvide your analysis and recommendations from your perspective as ${meta.name}.`;
            }

            // Execute the agent with streaming
            const result = await executeAgentWithStreaming(
              step.agentId as AgentId,
              agentPrompt,
              context,
              (token) => {
                send({
                  type: "token",
                  agent: step.agentId,
                  token,
                  step: i + 1,
                });
              },
              previousResults,
            );

            previousResults.push(result.content);

            // Emit event for tracking
            emitMissionEvent(
              sessionId,
              step.agentId,
              "THOUGHT",
              result.content.slice(0, 500),
              0.85 + Math.random() * 0.1,
              "RUNNING",
            );

            // Send the complete agent response
            send({
              type: "response",
              agent: step.agentId,
              agentName: meta.name,
              department: meta.department,
              message: result.content,
              timestamp: result.timestamp,
              step: i + 1,
              totalSteps: pipeline.length,
              tokensUsed: result.tokensUsed,
              toolCalls: result.toolCalls,
            });
          }

          // Mark completion
          send({
            type: "done",
            intent: classification.intent,
            agentsUsed: pipeline.length,
            timestamp: nowIso(),
          });

        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error("Agent pipeline error:", msg);
          send({ type: "error", error: msg });
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
      },
      { status: 500 },
    );
  }
}
