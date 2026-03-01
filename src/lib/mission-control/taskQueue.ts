import { CooTask, TaskQueueCreatedEvent } from "@/lib/mission-control/types";
import crypto from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

class TaskQueueStore {
  private events = new Map<string, TaskQueueCreatedEvent[]>();

  emitTaskCreated(task: CooTask) {
    const event: TaskQueueCreatedEvent = {
      eventId: id("qevt"),
      sessionId: task.sessionId,
      type: "task.created",
      timestampUtc: nowIso(),
      taskId: task.id,
      payload: task,
    };

    const list = this.events.get(task.sessionId) ?? [];
    list.push(event);
    this.events.set(task.sessionId, list);
    return event;
  }

  listEvents(sessionId: string) {
    return this.events.get(sessionId) ?? [];
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __taskQueueStore: TaskQueueStore | undefined;
}

export const taskQueueStore = globalThis.__taskQueueStore ?? new TaskQueueStore();

if (!globalThis.__taskQueueStore) {
  globalThis.__taskQueueStore = taskQueueStore;
}
