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
    // Also add a human-readable line to the timeline
    setTimeline((prev) => {
      const label = incoming.agentId.replace(/_/g, " ");
      const time = incoming.timestampUtc.slice(11, 19);
      const line = `${time} • ${label}: ${incoming.message.slice(0, 100)}${incoming.message.length > 100 ? "…" : ""}`;
      return [...prev, line].slice(-30);
    });
  }, []);

  /* ---- Model selector state ---- */
  const [availableModels, setAvailableModels] = useState<{provider: string; model: string; label: string}[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  /* ---- Progress tracking state ---- */
  const [currentProgress, setCurrentProgress] = useState<{
    agent: string;
    label: string;
    step: number;
    totalSteps: number;
  } | null>(null);

  /* ---- Live streaming text from current agent ---- */
  const [streamingText, setStreamingText] = useState<string>("");

  /* ---- Chat state ---- */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* auto-scroll chat */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, currentProgress, streamingText]);

  /* auto-focus input */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /* ---- Fetch available models from all providers on mount ---- */
  useEffect(() => {
    fetch("/api/mission-control/health")
      .then((r) => r.json())
      .then((data) => {
        const models: {provider: string; model: string; label: string}[] = data?.models ?? [];
        setAvailableModels(models);
        const current: string = data?.selectedModel ?? "";
        setSelectedModel(models.find(m => m.model === current)?.model ?? models[0]?.model ?? "");
      })
      .catch(() => {/* health endpoint unreachable */});
  }, []);

  /* ---- Send message to agents (streaming) ---- */
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
    setCurrentProgress(null);
    setStreamingText("");

    try {
      const resp = await fetch("/api/mission-control/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text, model: selectedModel || undefined }),
      });

      if (!resp.ok) {
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
        return;
      }

      /* Read streamed SSE events from the response */
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop()!;

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              agent?: string;
              label?: string;
              step?: number;
              totalSteps?: number;
              message?: string;
              timestamp?: string;
              error?: string;
              model?: string;
              provider?: string;
              tokensUsed?: number;
              token?: string;
            };

            if (data.type === "progress") {
              // New agent step starting — reset streaming text
              setStreamingText("");
              setCurrentProgress({
                agent: data.agent ?? "agent",
                label: data.label ?? "Thinking…",
                step: data.step ?? 1,
                totalSteps: data.totalSteps ?? 1,
              });
            } else if (data.type === "token") {
              // Live token from agent — append to streaming display
              setStreamingText((prev) => prev + (data.token ?? ""));
            } else if (data.type === "response") {
              // Agent finished — clear streaming, add final message
              setStreamingText("");
              setCurrentProgress(null);
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `msg_${Date.now()}_${data.step}`,
                  role: "agent" as const,
                  agent: data.agent,
                  text: data.message ?? "",
                  timestamp: data.timestamp ?? new Date().toISOString(),
                },
              ]);
            } else if (data.type === "error") {
              setCurrentProgress(null);
              setChatMessages((prev) => [
                ...prev,
                {
                  id: `msg_err_${Date.now()}`,
                  role: "agent",
                  agent: "system",
                  text: `Error: ${data.error ?? "Agent pipeline failed."}`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
            // "done" type — pipeline complete, nothing to render
          } catch {
            // skip malformed events
          }
        }
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
      setCurrentProgress(null);
      inputRef.current?.focus();
    }
  }, [chatInput, sending, sessionId, selectedModel]);

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
  /* Filter events to only show agent thoughts in the timeline sidebar, not chat center */
  void thoughtEvents; // events used via timeline (addEvent populates both)

  /* ---- Helper: pretty agent name ---- */
  function agentLabel(agent?: string) {
    if (!agent) return "Agent";
    return agent
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /* ---- Render message content with code blocks ---- */
  function renderMessageContent(text: string) {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const before = text.slice(lastIndex, match.index);
        if (before.trim()) {
          parts.push(
            <span key={`t-${lastIndex}`} className={styles.chatTextContent}>
              {before}
            </span>,
          );
        }
      }
      const lang = match[1];
      const code = match[2];
      parts.push(
        <div key={`c-${match.index}`} className={styles.codeBlock}>
          {lang && <div className={styles.codeLang}>{lang}</div>}
          <pre className={styles.codeContent}>
            <code>{code}</code>
          </pre>
        </div>,
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex);
      if (remaining.trim()) {
        parts.push(
          <span key={`t-${lastIndex}`} className={styles.chatTextContent}>
            {remaining}
          </span>,
        );
      }
    }

    return parts.length > 0 ? parts : <span className={styles.chatTextContent}>{text}</span>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h2>Workspace Session</h2>
        <span className={styles.sessionId}>{sessionId}</span>
        {availableModels.length > 0 ? (
          <select
            className={styles.modelSelect}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {availableModels.map((m) => (
              <option key={m.model} value={m.model}>{m.label}</option>
            ))}
          </select>
        ) : (
          <span className={styles.noProvider}>No LLM provider — start Ollama locally or set GEMINI_API_KEY</span>
        )}
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
            {chatMessages.length === 0 && (
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
                <div className={styles.chatText}>{renderMessageContent(msg.text)}</div>
              </div>
            ))}

            {currentProgress && (
              <div className={`${styles.chatMsg} ${styles.chatAgent} ${styles.progressMsg}`}>
                <div className={styles.progressIndicator}>
                  <div className={styles.progressDot} />
                  <div className={styles.progressInfo}>
                    <strong>{agentLabel(currentProgress.agent)}</strong>
                    <span>{currentProgress.label}</span>
                    <small>
                      Step {currentProgress.step} of {currentProgress.totalSteps}
                    </small>
                  </div>
                </div>
                {streamingText && (
                  <div className={styles.streamingText}>
                    {renderMessageContent(streamingText)}
                    <span className={styles.streamCursor}>|</span>
                  </div>
                )}
              </div>
            )}

            {sending && !currentProgress && (
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
