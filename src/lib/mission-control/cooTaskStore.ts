import { CooTask } from "@/lib/mission-control/types";

class CooTaskStore {
  private tasksBySession = new Map<string, CooTask[]>();

  getTasks(sessionId: string) {
    return this.tasksBySession.get(sessionId) ?? [];
  }

  saveTasks(sessionId: string, tasks: CooTask[]) {
    this.tasksBySession.set(sessionId, tasks);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __cooTaskStore: CooTaskStore | undefined;
}

export const cooTaskStore = globalThis.__cooTaskStore ?? new CooTaskStore();

if (!globalThis.__cooTaskStore) {
  globalThis.__cooTaskStore = cooTaskStore;
}
