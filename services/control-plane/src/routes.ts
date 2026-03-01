import type { Express } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { enqueueTask } from "./queue.js";
import { listAudit, listArtifacts, writeAudit } from "./audit.js";
import { secretStore } from "./secrets.js";
import { vectorStore } from "./vector.js";

const createTaskSchema = z.object({
  role: z.enum(["ceo", "coo", "marketing", "worker"]),
  prompt: z.string().min(1),
  sessionId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const secretSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

const vectorQuerySchema = z.object({
  sessionId: z.string().min(1),
  query: z.string().min(1),
  topK: z.number().int().min(1).max(20).default(5),
});

export function registerRoutes(app: Express): void {
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/tasks", async (req, res) => {
    const parse = createTaskSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid payload", details: parse.error.flatten() });
      return;
    }

    const data = parse.data;
    const queued = await enqueueTask(data);

    await writeAudit({
      id: uuid(),
      sessionId: data.sessionId,
      action: "task.queued",
      actor: "api",
      data: { role: data.role, prompt: data.prompt, jobId: queued.jobId },
      createdAt: new Date().toISOString(),
    });

    res.status(202).json({ ok: true, ...queued });
  });

  app.get("/api/audit/:sessionId", async (req, res) => {
    const data = await listAudit(req.params.sessionId);
    res.json({ audit: data });
  });

  app.get("/api/artifacts/:sessionId", async (req, res) => {
    const data = await listArtifacts(req.params.sessionId);
    res.json({ artifacts: data });
  });

  app.post("/api/secrets", async (req, res) => {
    const parse = secretSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid payload", details: parse.error.flatten() });
      return;
    }

    await secretStore.setSecret(parse.data.key, parse.data.value);
    res.status(204).send();
  });

  app.get("/api/secrets/:key", async (req, res) => {
    const value = await secretStore.getSecret(req.params.key);
    if (!value) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ exists: true, valueLength: value.length });
  });

  app.post("/api/vector/query", async (req, res) => {
    const parse = vectorQuerySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid payload", details: parse.error.flatten() });
      return;
    }

    const rows = await vectorStore.query(parse.data.sessionId, parse.data.query, parse.data.topK);
    res.json({ matches: rows });
  });
}
