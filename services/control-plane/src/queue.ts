import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { v4 as uuid } from "uuid";
import { config } from "./config.js";
import type { TaskPayload } from "./types.js";
import { agentRuntime } from "./agentRuntime.js";
import { publishRealtime } from "./ws.js";
import { writeAudit } from "./audit.js";
import { storeArtifact } from "./artifacts.js";
import { vectorStore } from "./vector.js";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const jobQueue = new Queue<TaskPayload>(config.queueName, { connection });

export async function enqueueTask(payload: TaskPayload): Promise<{ jobId: string }> {
  const job = await jobQueue.add("agent-task", payload, {
    removeOnComplete: 100,
    removeOnFail: 200,
  });

  return { jobId: String(job.id) };
}

async function processJob(job: Job<TaskPayload>): Promise<void> {
  const task = job.data;

  publishRealtime({
    type: "task.started",
    sessionId: task.sessionId,
    payload: { jobId: job.id, role: task.role },
  });

  await writeAudit({
    id: uuid(),
    sessionId: task.sessionId,
    action: "task.started",
    actor: task.role,
    data: { jobId: job.id, prompt: task.prompt },
    createdAt: new Date().toISOString(),
  });

  const result = await agentRuntime.runTask(task);

  const artifact = await storeArtifact({
    sessionId: task.sessionId,
    body: JSON.stringify(result),
  });

  await vectorStore.upsert(task.sessionId, artifact.id, JSON.stringify(result), {
    role: task.role,
    jobId: job.id,
    artifactUrl: artifact.url,
  });

  await writeAudit({
    id: uuid(),
    sessionId: task.sessionId,
    action: "task.completed",
    actor: task.role,
    data: { jobId: job.id, artifact },
    createdAt: new Date().toISOString(),
  });

  publishRealtime({
    type: "task.completed",
    sessionId: task.sessionId,
    payload: { jobId: job.id, role: task.role, artifactUrl: artifact.url },
  });
}

let worker: Worker<TaskPayload> | null = null;

export function startWorker(): void {
  if (worker) {
    return;
  }

  worker = new Worker<TaskPayload>(config.queueName, processJob, { connection });
}
