import { MissionEvent } from "@/lib/mission-control/types";

type EventListener = (event: MissionEvent) => void;

class MissionEventBus {
  private listeners = new Map<string, Set<EventListener>>();

  subscribe(sessionId: string, listener: EventListener) {
    const current = this.listeners.get(sessionId) ?? new Set<EventListener>();
    current.add(listener);
    this.listeners.set(sessionId, current);

    return () => {
      const existing = this.listeners.get(sessionId);
      if (!existing) return;
      existing.delete(listener);
      if (existing.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  publish(event: MissionEvent) {
    const listeners = this.listeners.get(event.sessionId);
    if (!listeners || listeners.size === 0) return;
    listeners.forEach((listener) => listener(event));
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __missionEventBus: MissionEventBus | undefined;
}

export const missionEventBus = globalThis.__missionEventBus ?? new MissionEventBus();

if (!globalThis.__missionEventBus) {
  globalThis.__missionEventBus = missionEventBus;
}
