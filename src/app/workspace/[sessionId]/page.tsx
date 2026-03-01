"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./workspace.module.css";

type EventItem = {
  eventId: string;
  type: "THOUGHT" | "ACTION" | "ARTIFACT" | "APPROVAL_REQUIRED" | "STATUS";
  message: string;
  timestampUtc: string;
  confidence: number;
  agentId: string;
  artifactId?: string | null;
};

type Artifact = {
  artifactId: string;
  title: string;
  category: string;
  createdAtUtc: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  agent?: string;
  text: string;
  timestamp: string;
};

export default function WorkspacePage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [events, setEvents] = useState<EventItem[]>([]);
  const [timeline, setTimeline] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [connectionLabel, setConnectionLabel] = useState("Connecting...");

  /* dedupe helper – only add events we haven't seen */
  const addEvent = useCallback((incoming: EventItem) => {
    setEvents((prev) => {
      if (prev.some((e) => e.eventId === incoming.eventId)) return prev;
      return [...prev, incoming];
    });
  }, []);

  /* ---- Chat state ---- */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* auto-scroll chat */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  /* auto-focus input */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ---- Send message to agents ---- */
  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || sending || !sessionId) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setSending(true);

    try {
      const resp = await fetch("/api/mission-control/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const agentMsgs: ChatMessage[] = (
          data.responses as { agent: string; message: string; timestamp: string }[]
        ).map((r, i) => ({
          id: `msg_${Date.now()}_${i}`,
          role: "agent" as const,
          agent: r.agent,
          text: r.message,
          timestamp: r.timestamp,
        }));
        setChatMessages((prev) => [...prev, ...agentMsgs]);
      } else {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg_err_${Date.now()}`,
            role: "agent",
            agent: "system",
            text: `Error: ${err.error ?? "Failed to reach agents."}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: "agent",
          agent: "system",
          text: "Network error — could not reach agents.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [chatInput, sending, sessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  /* ---- Real-time event stream (SSE / WS) ---- */
  useEffect(() => {
    if (!sessionId) return;

    let source: EventSource | null = null;
    let ws: WebSocket | null = null;

    const connectSse = () => {
      setConnectionLabel("Connected (SSE)");
      source = new EventSource(`/api/mission-control/events/${sessionId}`);

      source.addEventListener("mission-event", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as EventItem;
        addEvent(payload);
      });

      source.addEventListener("connected", () => {
        setTimeline((prev) => [...prev, "Mission stream connected"]);
      });

      source.onerror = () => {
        setConnectionLabel("Disconnected");
      };
    };

    try {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/ws/session/${sessionId}`);

      ws.onopen = () => {
        setConnectionLabel("Connected (WebSocket)");
      };

      ws.onmessage = (messageEvent) => {
        try {
          const payload = JSON.parse(messageEvent.data) as EventItem;
          addEvent(payload);
        } catch {
          setTimeline((prev) => [...prev, `WS: ${String(messageEvent.data).slice(0, 120)}`]);
        }
      };

      ws.onerror = () => {
        setConnectionLabel("WebSocket unavailable, falling back to SSE");
        connectSse();
      };

      ws.onclose = () => {
        if (!source) {
          setConnectionLabel("WebSocket closed, using SSE");
          connectSse();
        }
      };
    } catch {
      setConnectionLabel("WebSocket unavailable, using SSE");
      connectSse();
    }

    return () => {
      ws?.close();
      source?.close();
    };
  }, [sessionId, addEvent]);

  /* ---- Fetch audit & artifacts on interval ---- */
  useEffect(() => {
    if (!sessionId) return;

    const fetchPanels = async () => {
      try {
        const [auditResp, artifactResp] = await Promise.all([
          fetch(`/api/mission-control/audit/${sessionId}`),
          fetch(`/api/mission-control/artifacts/${sessionId}`),
        ]);

        if (auditResp.ok) {
          const auditPayload = await auditResp.json();
          const actions = (auditPayload.audit ?? []).map(
            (item: { action: string; timestampUtc: string }) =>
              `${item.timestampUtc.slice(11, 19)} • ${item.action}`,
          );
          setTimeline(actions.slice(-20));
        }

        if (artifactResp.ok) {
          const artifactPayload = await artifactResp.json();
          setArtifacts(artifactPayload.artifacts ?? []);
        }
      } catch {
        // keep UI resilient
      }
    };

    void fetchPanels();
    const timer = setInterval(fetchPanels, 4000);
    return () => clearInterval(timer);
  }, [sessionId]);

  const thoughtEvents = useMemo(() => events, [events]);

  /* ---- Helper: pretty agent name ---- */
  function agentLabel(agent?: string) {
    if (!agent) return "Agent";
    return agent
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h2>Workspace Session</h2>
        <span className={styles.sessionId}>{sessionId}</span>
        <small className={styles.connBadge}>{connectionLabel}</small>
      </header>

      <section className={styles.panes}>
        {/* LEFT – Timeline */}
        <aside className={`${styles.pane} ${styles.left}`}>
          <h3>Mission timeline</h3>
          <div className={styles.scroll}>
            {timeline.map((line, index) => (
              <p key={`${line}-${index}`} className={styles.timelineLine}>
                {line}
              </p>
            ))}
          </div>
        </aside>

        {/* MIDDLE – Chat + Live thinking */}
        <section className={`${styles.pane} ${styles.middle}`}>
          <h3>Command Center</h3>

          {/* Messages area */}
          <div className={styles.chatScroll}>
            {/* Welcome prompt when empty */}
            {chatMessages.length === 0 && thoughtEvents.length === 0 && (
              <div className={styles.welcome}>
                <h4>What would you like the swarm to do?</h4>
                <p>Type a command below — plan a strategy, research a topic, assign tasks, or ask for a status update.</p>
                <div className={styles.suggestions}>
                  {[
                    "Plan a go-to-market strategy for our AI product",
                    "Research the latest trends in autonomous agents",
                    "Build a landing page with dark theme",
                    "What is the current mission status?",
                  ].map((s) => (
                    <button
                      key={s}
                      className={styles.suggestionBtn}
                      onClick={() => {
                        setChatInput(s);
                        inputRef.current?.focus();
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live thinking events */}
            {thoughtEvents.map((event, idx) => {
              const bubbleClass =
                event.type === "ACTION" || event.type === "APPROVAL_REQUIRED"
                  ? styles.actionBubble
                  : event.type === "ARTIFACT"
                    ? styles.artifactBubble
                    : styles.planBubble;

              return (
                <div key={`${event.eventId}-${idx}`} className={`${styles.bubble} ${bubbleClass}`}>
                  <div className={styles.bubbleMeta}>
                    <strong>{event.agentId.replace(/_/g, " ")}</strong>
                    <span>{event.type.toLowerCase()}</span>
                    <span>{event.timestampUtc.slice(11, 19)}</span>
                    <span className={styles.badge}>{Math.round(event.confidence * 100)}%</span>
                  </div>
                  <p>{event.message}</p>
                  {event.artifactId ? (
                    <small>
                      artifact produced •{" "}
                      <a href={`/api/mission-control/artifacts/${sessionId}`}>view</a>
                    </small>
                  ) : null}
                </div>
              );
            })}

            {/* Chat messages */}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.chatMsg} ${msg.role === "user" ? styles.chatUser : styles.chatAgent}`}
              >
                <div className={styles.chatMsgHeader}>
                  <strong>{msg.role === "user" ? "You" : agentLabel(msg.agent)}</strong>
                  <span>{msg.timestamp.slice(11, 19)}</span>
                </div>
                <p className={styles.chatText}>{msg.text}</p>
              </div>
            ))}

            {sending && (
              <div className={`${styles.chatMsg} ${styles.chatAgent}`}>
                <div className={styles.typing}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className={styles.chatInputBar}>
            <textarea
              ref={inputRef}
              className={styles.chatTextarea}
              rows={1}
              placeholder="Tell the agents what to do…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button
              className={styles.sendBtn}
              onClick={() => void sendMessage()}
              disabled={sending || !chatInput.trim()}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </section>

        {/* RIGHT – Artifacts */}
        <aside className={`${styles.pane} ${styles.right}`}>
          <h3>Artifacts / Files</h3>
          <div className={styles.scroll}>
            {artifacts.map((artifact) => (
              <article key={artifact.artifactId} className={styles.card}>
                <h4>{artifact.title}</h4>
                <p>{artifact.category}</p>
                <small>{artifact.createdAtUtc.slice(0, 19).replace("T", " ")}</small>
                <a href={`/api/mission-control/artifacts/${sessionId}`}>View / Download</a>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
