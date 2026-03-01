"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FeaturedWork.module.css";

const projects = [
    {
        title: "Closed-Loop Pipeline",
        description:
            "Propose → Auto-Approve → Mission + Steps → Worker → Event → Trigger → React → Repeat. A fully unattended cycle that runs 24/7.",
        tags: ["core-loop", "automation", "pipeline"],
        color: "#00f0ff",
    },
    {
        title: "Proposal & Cap Gates",
        description:
            "A single createProposalAndMaybeAutoApprove function gates every proposal. Tweet quota full? Rejected at the gate — no queue buildup.",
        tags: ["rate-limiting", "proposal-service", "cap-gates"],
        color: "#8b5cf6",
    },
    {
        title: "Trigger System",
        description:
            "4 trigger rules with cooldowns: viral tweet analysis, mission failure diagnosis, content quality review, and insight promotion.",
        tags: ["triggers", "cooldown", "event-driven"],
        color: "#ec4899",
    },
    {
        title: "Reaction Matrix",
        description:
            "Probabilistic inter-agent reactions. 30% chance Xalt's tweet triggers Growth analysis. 100% chance Sage diagnoses any failure.",
        tags: ["reactions", "probability", "inter-agent"],
        color: "#f59e0b",
    },
    {
        title: "Self-Healing Workers",
        description:
            "VPS-only execution with stale task recovery. Steps stuck for 30+ minutes auto-fail, missions finalize correctly via maybeFinalizeMissionIfDone.",
        tags: ["self-healing", "recovery", "fault-tolerance"],
        color: "#10b981",
    },
    {
        title: "Policy-Driven Config",
        description:
            "Every behavior toggle in ops_policy: auto_approve, x_daily_quota, worker_policy, reaction_matrix. Adjust live — zero redeployments.",
        tags: ["policies", "config", "ops_policy"],
        color: "#6366f1",
    },
];

function ProjectCard({
    project,
    index,
}: {
    project: (typeof projects)[0];
    index: number;
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const spotlightRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current || !spotlightRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;

        cardRef.current.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        spotlightRef.current.style.background = `radial-gradient(300px circle at ${x}px ${y}px, ${project.color}15, transparent 60%)`;
    };

    const handleMouseLeave = () => {
        if (!cardRef.current || !spotlightRef.current) return;
        cardRef.current.style.transform = "perspective(800px) rotateX(0) rotateY(0) translateZ(0)";
        spotlightRef.current.style.background = "transparent";
    };

    return (
        <div
            ref={cardRef}
            className={styles.card}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            data-hover="true"
            style={{ transitionDelay: `${index * 0.1}s` }}
        >
            <div ref={spotlightRef} className={styles.spotlight} />
            <div
                className={styles.cardAccent}
                style={{ background: project.color }}
            />
            <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{project.title}</h3>
                <p className={styles.cardDesc}>{project.description}</p>
                <div className={styles.cardTags}>
                    {project.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
            <div className={styles.cardArrow}>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                >
                    <path
                        d="M5 15L15 5M15 5H8M15 5V12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
        </div>
    );
}

export default function FeaturedWork() {
    const sectionRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setVisible(true);
            },
            { threshold: 0.1 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section
            id="work"
            ref={sectionRef}
            className={`section ${styles.featured} ${visible ? styles.visible : ""}`}
        >
            <div className="container">
                <div className={styles.header}>
                    <span className={styles.sectionTag}>THE CLOSED LOOP</span>
                    <h2 className={styles.sectionTitle}>
                        How the <span className="gradient-text">Swarm Works</span>
                    </h2>
                    <p className={styles.sectionDesc}>
                        Six core systems that turn agent outputs into real actions —
                        end-to-end, self-healing, and fully unattended.
                    </p>
                </div>

                <div className={styles.grid}>
                    {projects.map((project, i) => (
                        <ProjectCard key={project.title} project={project} index={i} />
                    ))}
                </div>
            </div>
        </section>
    );
}
