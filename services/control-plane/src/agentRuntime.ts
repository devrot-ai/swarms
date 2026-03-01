import { v4 as uuid } from "uuid";
import type { TaskPayload } from "./types.js";

export interface AgentRuntime {
  runTask(input: TaskPayload): Promise<Record<string, unknown>>;
}

class LocalWorkerPoolRuntime implements AgentRuntime {
  async runTask(input: TaskPayload): Promise<Record<string, unknown>> {
    const traceId = uuid();
    const now = new Date().toISOString();

    return {
      traceId,
      role: input.role,
      sessionId: input.sessionId,
      output: {
        summary: `Executed ${input.role} workflow for session ${input.sessionId}.`,
        nextAction: "Review trace and approve downstream actions.",
      },
      metadata: input.metadata ?? {},
      completedAt: now,
    };
  }
}

export const agentRuntime: AgentRuntime = new LocalWorkerPoolRuntime();
