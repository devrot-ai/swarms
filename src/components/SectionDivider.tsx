"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./SectionDivider.module.css";

gsap.registerPlugin(ScrollTrigger);

interface SectionDividerProps {
    /** "gradient" | "glow" | "dots" */
    variant?: "gradient" | "glow" | "dots";
}

export default function SectionDivider({ variant = "gradient" }: SectionDividerProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current) return;
        const el = ref.current;

        gsap.fromTo(
            el.querySelector(`.${styles.line}`),
            { scaleX: 0 },
            {
                scaleX: 1,
                duration: 1.4,
                ease: "power3.inOut",
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%",
                    toggleActions: "play none none reverse",
                },
            }
        );

        if (variant === "glow") {
            gsap.fromTo(
                el.querySelector(`.${styles.glowOrb}`),
                { scale: 0, opacity: 0 },
                {
                    scale: 1,
                    opacity: 1,
                    duration: 0.8,
                    delay: 0.5,
                    ease: "back.out(1.7)",
                    scrollTrigger: {
                        trigger: el,
                        start: "top 85%",
                        toggleActions: "play none none reverse",
                    },
                }
            );
        }

        return () => {
            ScrollTrigger.getAll().forEach((st) => {
                if (st.trigger === el) st.kill();
            });
        };
    }, [variant]);

    return (
        <div ref={ref} className={styles.divider}>
            <div className={`${styles.line} ${styles[variant]}`} />
            {variant === "glow" && <div className={styles.glowOrb} />}
            {variant === "dots" && (
                <div className={styles.dotsRow}>
                    {[0, 1, 2].map((i) => (
                        <span key={i} className={styles.dot} style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                </div>
            )}
        </div>
    );
}
