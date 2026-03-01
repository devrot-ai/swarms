import { Pool } from "pg";
import { config } from "./config.js";
import type { AuditRecord } from "./types.js";

const pool = new Pool({ connectionString: config.postgresUrl });

export async function ensureAuditSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      bucket TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
}

export async function writeAudit(record: AuditRecord): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (id, session_id, action, actor, data, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [record.id, record.sessionId, record.action, record.actor, record.data, record.createdAt],
  );
}

export async function listAudit(sessionId: string): Promise<AuditRecord[]> {
  const result = await pool.query(
    `SELECT id, session_id, action, actor, data, created_at FROM audit_log WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [sessionId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    action: row.action,
    actor: row.actor,
    data: row.data,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function writeArtifactMetadata(record: {
  id: string;
  sessionId: string;
  storageKey: string;
  bucket: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO artifacts (id, session_id, storage_key, bucket, content_type, size_bytes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      record.id,
      record.sessionId,
      record.storageKey,
      record.bucket,
      record.contentType,
      record.sizeBytes,
      record.createdAt,
    ],
  );
}

export async function listArtifacts(sessionId: string): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(
    `SELECT id, session_id, storage_key, bucket, content_type, size_bytes, created_at FROM artifacts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [sessionId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    storageKey: row.storage_key,
    bucket: row.bucket,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at.toISOString(),
  }));
}
