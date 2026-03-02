"use client";

import { useEffect, useRef } from "react";
import styles from "./About.module.css";

export default function About() {
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add(styles.visible);
                    }
                });
            },
            { threshold: 0.2 }
        );

        const elements =
            sectionRef.current?.querySelectorAll(`.${styles.animateIn}`);
        elements?.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    const taglineWords = ["Propose", "•", "Execute", "•", "React", "•", "Repeat"];

    return (
        <section id="about" ref={sectionRef} className={`section ${styles.about}`}>
            <div className={`container ${styles.aboutInner}`}>
                <div className={styles.taglineContainer}>
                    <div className={styles.tagline}>
                        {taglineWords.map((word, i) => (
                            <span
                                key={i}
                                className={`${styles.taglineWord} ${styles.animateIn}`}
                                style={{ transitionDelay: `${i * 0.1}s` }}
                            >
                                {word === "•" ? (
                                    <span className={styles.taglineDot}>{word}</span>
                                ) : (
                                    word
                                )}
                            </span>
                        ))}
                    </div>
                </div>

                <div className={styles.content}>
                    <div className={`${styles.description} ${styles.animateIn}`}>
                        <p className={styles.descText}>
                            A fully autonomous closed-loop system where AI agents propose ideas,
                            auto-approve and create missions, execute steps via workers,
                            emit events, and trigger new reactions — running continuously
                            without human intervention. Built on Ollama (local AI models), Vercel
                            (control plane), and Supabase (shared state).
                        </p>
                    </div>

                    <div className={styles.features}>
                        {[
                            {
                                icon: "🧠",
                                title: "Ollama — Think & Execute",
                                desc: "The brain and hands. Runs roundtable discussions, executes all mission steps, and performs deep research using local AI models.",
                            },
                            {
                                icon: "⚡",
                                title: "Vercel — Approve & Monitor",
                                desc: "The control plane. Evaluates triggers, processes reactions, promotes insights, and recovers stale tasks every 5 minutes.",
                            },
                            {
                                icon: "🗄️",
                                title: "Supabase — All State",
                                desc: "The shared cortex. Proposals, missions, events, policies, and memories — every piece of state lives here as the single source of truth.",
                            },
                        ].map((feat, i) => (
                            <div
                                key={i}
                                className={`${styles.featureCard} glass ${styles.animateIn}`}
                                style={{ transitionDelay: `${0.3 + i * 0.15}s` }}
                            >
                                <span className={styles.featureIcon}>{feat.icon}</span>
                                <h4 className={styles.featureTitle}>{feat.title}</h4>
                                <p className={styles.featureDesc}>{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <a href="#work" className={`btn-outline ${styles.aboutCta} ${styles.animateIn}`} data-hover="true" style={{ transitionDelay: '0.8s' }}>
                    See the Closed Loop
                </a>
            </div>
        </section>
    );
}
