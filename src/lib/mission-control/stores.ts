import {
  ApprovalRecord,
  ArtifactRecord,
  AuditRecord,
  MissionSession,
  TaskQueueItem,
} from "@/lib/mission-control/types";

class MissionStore {
  private sessions = new Map<string, MissionSession>();
  private audits = new Map<string, AuditRecord[]>();
  private artifacts = new Map<string, ArtifactRecord[]>();
  private approvals = new Map<string, ApprovalRecord[]>();

  saveSession(session: MissionSession) {
    this.sessions.set(session.sessionId, session);
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  updateQueueStatus(sessionId: string, queueId: string, status: TaskQueueItem["status"]) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.taskQueue = session.taskQueue.map((item) =>
      item.queueId === queueId ? { ...item, status } : item,
    );
    this.sessions.set(sessionId, session);
  }

  setSessionStatus(sessionId: string, status: MissionSession["status"]) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = status;
    this.sessions.set(sessionId, session);
  }

  appendAudit(record: AuditRecord) {
    const list = this.audits.get(record.sessionId) ?? [];
    list.push(record);
    this.audits.set(record.sessionId, list);
  }

  appendArtifact(record: ArtifactRecord) {
    const list = this.artifacts.get(record.sessionId) ?? [];
    list.push(record);
    this.artifacts.set(record.sessionId, list);
  }

  appendApproval(record: ApprovalRecord) {
    const list = this.approvals.get(record.sessionId) ?? [];
    list.push(record);
    this.approvals.set(record.sessionId, list);
  }

  getAudits(sessionId: string) {
    return this.audits.get(sessionId) ?? [];
  }

  getArtifacts(sessionId: string) {
    return this.artifacts.get(sessionId) ?? [];
  }

  getApprovals(sessionId: string) {
    return this.approvals.get(sessionId) ?? [];
  }

  hasApproval(sessionId: string, actionType: string) {
    return this.getApprovals(sessionId).some(
      (approval) => approval.actionType === actionType && approval.approved,
    );
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __missionStore: MissionStore | undefined;
}

export const missionStore = globalThis.__missionStore ?? new MissionStore();

if (!globalThis.__missionStore) {
  globalThis.__missionStore = missionStore;
}
