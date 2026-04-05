"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./mission.module.css";

type MissionStatus = "draft" | "planning" | "running" | "completed" | "failed";

type Mission = {
  id: string;
  title: string;
  original_prompt: string;
  status: MissionStatus;
};

type Step = {
  id: string;
  step_order: number;
  title: string;
  description: string;
  agent_key: string;
  status: string;
};

type Output = {
  id: string;
  kind: string;
  content_md: string | null;
};

type EventItem = {
  id: string;
  created_at: string;
  event_type: string;
  payload: Record<string, unknown>;
};

const TAB_ORDER = [
  "research",
  "prd",
  "architecture",
  "budget",
  "marketing",
  "review",
] as const;

type TabKey = (typeof TAB_ORDER)[number];

export default function MissionWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("research");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    const fetchMissionState = async () => {
      try {
        const [missionRes, eventRes] = await Promise.all([
          fetch(`/api/mission/${id}`),
          fetch(`/api/mission/${id}/events`),
        ]);

        if (!missionRes.ok) {
          throw new Error("Mission lookup failed.");
        }

        if (!eventRes.ok) {
          throw new Error("Event lookup failed.");
        }

        const missionBody = (await missionRes.json()) as {
          mission: Mission;
          steps: Step[];
          outputs: Output[];
        };

        const eventBody = (await eventRes.json()) as { events: EventItem[] };

        setMission(missionBody.mission);
        setSteps(missionBody.steps ?? []);
        setOutputs(missionBody.outputs ?? []);
        setEvents(eventBody.events ?? []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown mission workspace error");
      }
    };

    void fetchMissionState();
    const timer = setInterval(fetchMissionState, 2500);

    return () => clearInterval(timer);
  }, [id]);

  const outputsByKind = useMemo(() => {
    const map = new Map<string, Output>();
    for (const output of outputs) {
      map.set(output.kind, output);
    }
    return map;
  }, [outputs]);

  const activeOutput = outputsByKind.get(activeTab);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{mission?.title ?? "Mission Workspace"}</h1>
          <p className={styles.status}>Status: {mission?.status ?? "loading"}</p>
        </div>
        {mission && mission.status === "planning" && (
          <button
            className={styles.tabBtn}
            onClick={async () => {
              await fetch(`/api/mission/${mission.id}/run`, {
                method: "POST",
              });
            }}
          >
            Start Mission
          </button>
        )}
      </header>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.layout}>
        <aside className={styles.panel}>
          <h3>Mission Steps</h3>
          <div className={styles.steps}>
            {steps.map((step) => (
              <article className={styles.stepCard} key={step.id}>
                <strong>
                  {step.step_order}. {step.title}
                </strong>
                <div className={styles.stepMeta}>
                  {step.agent_key} · {step.status}
                </div>
                <div className={styles.stepMeta}>{step.description}</div>
              </article>
            ))}
          </div>
        </aside>

        <section className={styles.panel}>
          <h3>Deliverables</h3>
          <div className={styles.tabRow}>
            {TAB_ORDER.map((tab) => (
              <button
                key={tab}
                className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <article className={styles.output}>
            {activeOutput?.content_md ?? "No output generated for this section yet."}
          </article>
        </section>

        <aside className={styles.panel}>
          <h3>Event Log</h3>
          <div className={styles.eventLog}>
            {events.map((event) => (
              <article key={event.id} className={styles.eventItem}>
                <strong>{event.event_type}</strong>
                <p>{JSON.stringify(event.payload)}</p>
                <span className={styles.eventTime}>
                  {event.created_at.slice(0, 19).replace("T", " ")}
                </span>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
