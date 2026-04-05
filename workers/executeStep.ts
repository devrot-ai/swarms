import { runMissionWorker } from "@/workers/runner";

export interface ExecuteStepInput {
  missionId: string;
}

export async function executeStep(input: ExecuteStepInput) {
  // Worker currently executes the scheduler loop for the mission.
  return runMissionWorker({ missionId: input.missionId });
}
