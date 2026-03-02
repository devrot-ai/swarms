"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./AgentGraph.module.css";

interface AgentNode {
    id: string;
    label: string;
    role: string;
    description: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    connections: string[];
}

const agents: AgentNode[] = [
    {
        id: "roundtable",
        label: "⬡",
        role: "Roundtable — Consensus Engine",
        description:
            "The central discussion hub. Agents propose, discuss, vote, and reach consensus here via the AI roundtable powered by Ollama.",
        x: 0.5,
        y: 0.4,
        radius: 34,
        color: "#00f0ff",
        connections: ["minion", "sage", "scout", "quill", "xalt", "observer"],
    },
    {
        id: "minion",
        label: "MIN",
        role: "Minion — Decision Maker",
        description:
            "Makes decisions and manages proposals. Evaluates auto-approve rules and creates missions from accepted proposals.",
        x: 0.5,
        y: 0.12,
        radius: 24,
        color: "#8b5cf6",
        connections: [],
    },
    {
        id: "sage",
        label: "SAG",
        role: "Sage — Strategy Analyst",
        description:
            "Analyzes strategy and diagnoses failures. 100% chance of reacting to any mission failure to identify root causes.",
        x: 0.18,
        y: 0.25,
        radius: 24,
        color: "#f59e0b",
        connections: [],
    },
    {
        id: "scout",
        label: "SCT",
        role: "Scout — Intelligence Gatherer",
        description:
            "Gathers intelligence via crawling and deep research. Feeds insights to the roundtable for collective decision-making.",
        x: 0.82,
        y: 0.25,
        radius: 24,
        color: "#10b981",
        connections: [],
    },
    {
        id: "quill",
        label: "QUI",
        role: "Quill — Content Writer",
        description:
            "Writes content — blog posts, reports, documentation. Outputs are reviewed by Observer before publishing.",
        x: 0.18,
        y: 0.6,
        radius: 24,
        color: "#ec4899",
        connections: ["observer"],
    },
    {
        id: "xalt",
        label: "XAL",
        role: "Xalt — Social Media Manager",
        description:
            "Manages social media. Drafts tweets, posts content. Subject to x_daily_quota cap gate and x_autopost policy.",
        x: 0.82,
        y: 0.6,
        radius: 24,
        color: "#6366f1",
        connections: [],
    },
    {
        id: "observer",
        label: "OBS",
        role: "Observer — Quality Checker",
        description:
            "Performs quality checks on published content. Auto-triggered when new content is published (2-hour cooldown).",
        x: 0.5,
        y: 0.72,
        radius: 24,
        color: "#ef4444",
        connections: [],
    },
];

const activityMessages = [
    "Minion evaluating proposal #1042...",
    "Sage analyzing mission failure root cause...",
    "Scout crawling intelligence feed...",
    "Quill drafting content report...",
    "Xalt posting tweet — quota 3/8...",
    "Observer reviewing published content...",
    "Roundtable: consensus reached — approved",
    "Cap gate check: post_tweet OK ✓",
    "Trigger fired: viral tweet detected",
    "Reaction: Sage → diagnose failure (100%)",
    "Heartbeat: stale steps recovered: 0",
    "Mission #87 finalized: succeeded ✓",
    "Worker claimed step: write_content",
    "Auto-approve: draft_tweet → approved",
    "Policy check: x_daily_quota = 8",
    "Insight promoted to permanent memory",
];

export default function AgentGraph() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
    const [visible, setVisible] = useState(false);
    const [activated, setActivated] = useState(false);
    const [activatingAgent, setActivatingAgent] = useState<string | null>(null);
    const [activityLog, setActivityLog] = useState<string[]>([]);
    const animRef = useRef<number>(0);
    const hoveredRef = useRef<string | null>(null);
    const activatedRef = useRef(false);
    const activationTimeRef = useRef(0);

    // Listen for the swarm-activate event from the Get Started button
    useEffect(() => {
        const handleActivate = () => {
            if (activatedRef.current) return;
            activatedRef.current = true;
            activationTimeRef.current = Date.now() * 0.001;
            setActivated(true);

            // Sequential agent activation animation
            const agentOrder = ["roundtable", "minion", "sage", "scout", "quill", "xalt", "observer"];
            agentOrder.forEach((id, i) => {
                setTimeout(() => setActivatingAgent(id), i * 400);
            });
            setTimeout(() => setActivatingAgent(null), agentOrder.length * 400 + 500);

            // Start activity log feed
            let logIndex = 0;
            const logInterval = setInterval(() => {
                setActivityLog(prev => {
                    const next = [activityMessages[logIndex % activityMessages.length], ...prev];
                    logIndex++;
                    return next.slice(0, 6);
                });
            }, 2200);

            return () => clearInterval(logInterval);
        };

        window.addEventListener("swarm-activate", handleActivate);
        return () => window.removeEventListener("swarm-activate", handleActivate);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setVisible(true);
            },
            { threshold: 0.2 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const w = rect.width;
        const h = rect.height;
        const time = Date.now() * 0.001;
        const isActive = activatedRef.current;
        const activeSince = time - activationTimeRef.current;

        // Speed multiplier when activated
        const speed = isActive ? 3 : 1;
        const glowIntensity = isActive ? (Math.sin(time * 4) * 0.3 + 0.7) : 1;

        // Draw connections
        agents.forEach((agent) => {
            const ax = agent.x * w;
            const ay = agent.y * h;

            agent.connections.forEach((targetId) => {
                const target = agents.find((a) => a.id === targetId);
                if (!target) return;
                const tx = target.x * w;
                const ty = target.y * h;

                const pulse = (Math.sin(time * 2 * speed + agents.indexOf(agent)) + 1) * 0.5;

                // Connection line — brighter when activated
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(tx, ty);
                if (isActive) {
                    ctx.strokeStyle = `rgba(0, 240, 255, ${0.15 + pulse * 0.25})`;
                    ctx.lineWidth = 1.5 + pulse;
                    ctx.shadowColor = "#00f0ff";
                    ctx.shadowBlur = 8;
                } else {
                    ctx.strokeStyle = `rgba(0, 240, 255, ${0.08 + pulse * 0.08})`;
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 0;
                }
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Multiple data packets when activated
                const packetCount = isActive ? 3 : 1;
                for (let p = 0; p < packetCount; p++) {
                    const packetT = (time * 0.3 * speed + agents.indexOf(agent) * 0.5 + p * 0.33) % 1;
                    const px = ax + (tx - ax) * packetT;
                    const py = ay + (ty - ay) * packetT;
                    const packetRadius = isActive ? 3 + Math.sin(time * 8 + p) * 1 : 2;

                    ctx.beginPath();
                    ctx.arc(px, py, packetRadius, 0, Math.PI * 2);
                    if (isActive) {
                        ctx.fillStyle = `rgba(0, 240, 255, ${0.7 + pulse * 0.3})`;
                        ctx.shadowColor = "#00f0ff";
                        ctx.shadowBlur = 12;
                    } else {
                        ctx.fillStyle = `rgba(0, 240, 255, ${0.4 + pulse * 0.4})`;
                    }
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });
        });

        // Draw nodes
        agents.forEach((agent, idx) => {
            const x = agent.x * w;
            const y = agent.y * h;
            const isHovered = hoveredRef.current === agent.id;
            const r = agent.radius + (isHovered ? 4 : 0);

            // Activation pulse effect
            const agentActivePulse = isActive
                ? Math.max(0, 1 - (activeSince - idx * 0.4)) * 40
                : 0;

            // Glow — much larger when activated
            const glowRadius = isActive ? r * 4 * glowIntensity : r * 2.5;
            const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
            if (isActive) {
                glow.addColorStop(0, `${agent.color}40`);
                glow.addColorStop(0.5, `${agent.color}15`);
                glow.addColorStop(1, "transparent");
            } else {
                glow.addColorStop(0, `${agent.color}15`);
                glow.addColorStop(1, "transparent");
            }
            ctx.beginPath();
            ctx.arc(x, y, glowRadius + agentActivePulse, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();

            // Node background
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            if (isActive) {
                ctx.fillStyle = "rgba(17, 17, 24, 0.95)";
                ctx.shadowColor = agent.color;
                ctx.shadowBlur = 15 + Math.sin(time * 3 + idx) * 5;
            } else {
                ctx.fillStyle = "rgba(17, 17, 24, 0.8)";
            }
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = isHovered || isActive ? agent.color : `${agent.color}40`;
            ctx.lineWidth = isHovered ? 2 : isActive ? 1.5 : 1;
            ctx.stroke();

            // Orbiting ring(s) — more when activated
            const ringCount = isActive ? 2 : 1;
            for (let ring = 0; ring < ringCount; ring++) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(time * (1 + ring * 0.5) * speed + idx + ring * Math.PI);
                ctx.translate(-x, -y);
                ctx.beginPath();
                ctx.arc(x, y, r + 6 + ring * 5, 0, Math.PI * (isActive ? 0.7 : 0.4));
                ctx.strokeStyle = `${agent.color}${isActive ? "80" : "40"}`;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }

            // Label
            ctx.font = `600 ${isHovered ? 13 : isActive ? 12 : 11}px 'Space Grotesk', sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = isHovered || isActive ? agent.color : "#e8e6e3";
            ctx.fillText(agent.label, x, y);

            // Active status dot
            if (isActive) {
                const dotPulse = (Math.sin(time * 4 + idx * 0.7) + 1) * 0.5;
                ctx.beginPath();
                ctx.arc(x + r - 4, y - r + 4, 3 + dotPulse, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(16, 185, 129, ${0.6 + dotPulse * 0.4})`;
                ctx.shadowColor = "#10b981";
                ctx.shadowBlur = 6;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });

        animRef.current = requestAnimationFrame(draw);
    }, []);

    useEffect(() => {
        if (visible) {
            animRef.current = requestAnimationFrame(draw);
        }
        return () => cancelAnimationFrame(animRef.current);
    }, [visible, draw]);

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        let found = false;
        for (const agent of agents) {
            const ax = agent.x * w;
            const ay = agent.y * h;
            const dist = Math.sqrt((mx - ax) ** 2 + (my - ay) ** 2);
            if (dist < agent.radius + 10) {
                hoveredRef.current = agent.id;
                canvas.style.cursor = "pointer";
                found = true;
                break;
            }
        }
        if (!found) {
            hoveredRef.current = null;
            canvas.style.cursor = "default";
        }
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        for (const agent of agents) {
            const ax = agent.x * w;
            const ay = agent.y * h;
            const dist = Math.sqrt((mx - ax) ** 2 + (my - ay) ** 2);
            if (dist < agent.radius + 10) {
                setSelectedAgent(selectedAgent?.id === agent.id ? null : agent);
                return;
            }
        }
        setSelectedAgent(null);
    };

    return (
        <section
            id="architecture"
            ref={sectionRef}
            className={`section ${styles.architecture} ${visible ? styles.visible : ""} ${activated ? styles.activated : ""}`}
        >
            <div className="container">
                <div className={styles.header}>
                    <span className={styles.sectionTag}>ARCHITECTURE</span>
                    <h2 className={styles.sectionTitle}>
                        Agents Working as <span className="gradient-text">One</span>
                    </h2>
                    <p className={styles.sectionDesc}>
                        {activated
                            ? "Swarm activated — agents are proposing, executing, and reacting in a closed loop."
                            : "Click \"Get Started\" above to activate the swarm and watch the agents collaborate in real-time."}
                    </p>
                </div>

                {/* Activation status banner */}
                {activated && (
                    <div className={styles.statusBanner}>
                        <span className={styles.statusDot} />
                        <span className={styles.statusText}>SWARM ACTIVE</span>
                        <span className={styles.statusMeta}>
                            {agents.length - 1} agents online • closed-loop running
                        </span>
                    </div>
                )}

                <div className={styles.graphWrapper}>
                    <div ref={containerRef} className={styles.graphContainer}>
                        <canvas
                            ref={canvasRef}
                            onMouseMove={handleCanvasMouseMove}
                            onClick={handleCanvasClick}
                            className={styles.canvas}
                        />

                        {/* Per-agent activation flash */}
                        {activatingAgent && (
                            <div className={styles.activationFlash} />
                        )}
                    </div>

                    <div className={styles.sidePanel}>
                        {selectedAgent && (
                            <div className={`${styles.agentDetail} glass`}>
                                <div
                                    className={styles.detailAccent}
                                    style={{ background: selectedAgent.color }}
                                />
                                <h4 className={styles.detailRole}>{selectedAgent.role}</h4>
                                <p className={styles.detailDesc}>{selectedAgent.description}</p>
                                <div className={styles.detailMeta}>
                                    <span className={styles.detailId}>ID: {selectedAgent.id}</span>
                                    <span
                                        className={styles.detailStatus}
                                        style={{ color: activated ? "#10b981" : selectedAgent.color }}
                                    >
                                        ● {activated ? "Working" : "Standby"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Activity log */}
                        {activated && activityLog.length > 0 && (
                            <div className={`${styles.activityLog} glass`}>
                                <h5 className={styles.logTitle}>
                                    <span className={styles.logDot} />
                                    Live Activity
                                </h5>
                                <ul className={styles.logList}>
                                    {activityLog.map((msg, i) => (
                                        <li
                                            key={`${msg}-${i}`}
                                            className={styles.logItem}
                                            style={{ opacity: 1 - i * 0.12 }}
                                        >
                                            {msg}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <p className={styles.hint}>
                    {activated
                        ? "Click any agent node to inspect its current status"
                        : "Click on any agent node to see details"}
                </p>
            </div>
        </section>
    );
}
