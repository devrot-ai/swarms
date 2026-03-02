"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./Hero.module.css";
import { useTheme } from "../ThemeProvider";

const Ballpit = dynamic(() => import("../Ballpit"), { ssr: false });

function getLocalUid() {
    const key = "mc_uid";
    if (typeof window === "undefined") return "anon";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const uid = `u_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    localStorage.setItem(key, uid);
    return uid;
}

export default function Hero() {
    const router = useRouter();
    const [launching, setLaunching] = useState(false);
    const [error, setError] = useState("");

    const handleGetStarted = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        if (launching) return;
        setLaunching(true);
        setError("");

        try {
            const uid = getLocalUid();
            const res = await fetch("/api/mission-control/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid, modelMode: "default" }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? "Launch failed");
                return;
            }
            // Notify other components (e.g., AgentGraph) that the swarm has been activated
            try {
                window.dispatchEvent(new Event('swarm-activate'));
            } catch (e) {
                // In case window is undefined (unlikely in client), ignore
                console.error('Failed to dispatch swarm-activate event', e);
            }
            router.push(`/workspace/${data.sessionId}`);
        } catch {
            setError("Could not reach the server. Try again.");
        } finally {
            setLaunching(false);
        }
    }, [launching, router]);

    const { theme } = useTheme();
    const isDark = theme === "dark";

    // Ballpit colors: cyan → violet gradient matching the site accent palette
    const ballColors = isDark
        ? [0x00f0ff, 0x8b5cf6, 0xec4899]
        : [0x0090aa, 0x7c3aed, 0xdb2777];

    return (
        <section id="hero" className={styles.hero} style={{ background: isDark ? '#0a0a0f' : '#f5f5f7' }}>
            <div className={styles.canvasWrapper}>
                <Ballpit
                    key={theme}
                    count={100}
                    gravity={0.01}
                    friction={0.9975}
                    wallBounce={0.95}
                    followCursor={false}
                    colors={ballColors}
                />
            </div>

            <div className={styles.overlay}>
                <div className={styles.tagline}>
                    <span className={styles.taglineDot} />
                    <span>AUTONOMOUS AI AGENT SWARM</span>
                </div>

                <h1 className={styles.headline}>
                    <span className={styles.headlineRow}>
                        <span className={styles.headlineWord}>Agents</span>
                        <span className={styles.headlineWord}>That</span>
                        <span className={styles.headlineWord}>Run</span>
                    </span>
                    <span className={styles.headlineRow}>
                        <span className={`${styles.headlineWord} gradient-text`}>
                            Your Company
                        </span>
                    </span>
                </h1>

                <p className={styles.subtitle}>
                    Six AI agents — Minion, Sage, Scout, Quill, Xalt &amp; Observer —
                    propose, execute, and self-heal in a fully closed loop.
                    Powered by Ollama, Vercel &amp; Supabase.
                </p>

                {error && <p className={styles.errorBanner}>{error}</p>}

                <div className={styles.ctas}>
                    <button
                        className="btn-primary"
                        data-hover="true"
                        disabled={launching}
                        onClick={handleGetStarted}
                    >
                        {launching ? "Launching…" : "Get Started"}
                        {!launching && (
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M3 8H13M13 8L9 4M13 8L9 12"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </button>
                    <a href="https://github.com/devrot-ai" className="btn-outline" data-hover="true" target="_blank" rel="noopener noreferrer">
                        Explore Docs
                    </a>
                </div>

                <div className={styles.stats}>
                    <div className={styles.stat}>
                        <span className={styles.statNumber}>6</span>
                        <span className={styles.statLabel}>Specialized Agents</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.stat}>
                        <span className={styles.statNumber}>24/7</span>
                        <span className={styles.statLabel}>Closed-Loop</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.stat}>
                        <span className={styles.statNumber}>∞</span>
                        <span className={styles.statLabel}>Self-Healing</span>
                    </div>
                </div>
            </div>

            <div className={styles.scrollIndicator}>
                <div className={styles.scrollLine} />
                <span className={styles.scrollText}>SCROLL</span>
            </div>
        </section>
    );
}
