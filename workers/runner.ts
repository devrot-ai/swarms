import { startMissionRun } from "@/lib/orchestrator/runner";

export interface WorkerRunPayload {
  missionId: string;
}

export function runMissionWorker(payload: WorkerRunPayload) {
  return startMissionRun(payload.missionId);
}
