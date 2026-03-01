export type AgentRole = "ceo" | "coo" | "marketing" | "worker";

export interface TaskPayload {
  role: AgentRole;
  prompt: string;
  sessionId: string;
  metadata?: Record<string, unknown>;
}

export interface ArtifactRecord {
  id: string;
  sessionId: string;
  key: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  sessionId: string;
  action: string;
  actor: string;
  data: Record<string, unknown>;
  createdAt: string;
}
