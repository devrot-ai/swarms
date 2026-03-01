"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealProps {
    children: React.ReactNode;
    className?: string;
    id?: string;
    /** Animation style — "fade" | "slide-up" | "slide-left" | "slide-right" | "scale" | "wipe" */
    animation?: "fade" | "slide-up" | "slide-left" | "slide-right" | "scale" | "wipe";
    /** Delay in seconds */
    delay?: number;
    /** Duration in seconds */
    duration?: number;
    /** How far it travels (px) */
    distance?: number;
    /** Stagger children? */
    staggerChildren?: boolean;
    staggerAmount?: number;
    /** Trigger threshold (0–1) */
    threshold?: number;
}

export default function ScrollReveal({
    children,
    className,
    id,
    animation = "slide-up",
    delay = 0,
    duration = 1,
    distance = 80,
    staggerChildren = false,
    staggerAmount = 0.12,
    threshold = 0.15,
}: ScrollRevealProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current) return;

        const el = ref.current;
        const targets = staggerChildren
            ? el.querySelectorAll(":scope > *")
            : [el];

        // Set initial state
        const fromVars: gsap.TweenVars = { opacity: 0 };
        const toVars: gsap.TweenVars = {
            opacity: 1,
            duration,
            delay,
            ease: "power3.out",
            stagger: staggerChildren ? staggerAmount : 0,
            scrollTrigger: {
                trigger: el,
                start: `top ${(1 - threshold) * 100}%`,
                end: "bottom 20%",
                toggleActions: "play none none reverse",
            },
        };

        switch (animation) {
            case "fade":
                fromVars.y = 0;
                toVars.y = 0;
                break;
            case "slide-up":
                fromVars.y = distance;
                toVars.y = 0;
                break;
            case "slide-left":
                fromVars.x = distance;
                toVars.x = 0;
                break;
            case "slide-right":
                fromVars.x = -distance;
                toVars.x = 0;
                break;
            case "scale":
                fromVars.scale = 0.85;
                fromVars.y = distance * 0.5;
                toVars.scale = 1;
                toVars.y = 0;
                break;
            case "wipe":
                fromVars.clipPath = "inset(0 100% 0 0)";
                fromVars.y = 0;
                toVars.clipPath = "inset(0 0% 0 0)";
                toVars.y = 0;
                toVars.duration = duration * 1.2;
                break;
        }

        gsap.set(targets, fromVars);
        gsap.to(targets, toVars);

        return () => {
            ScrollTrigger.getAll().forEach((st) => {
                if (st.trigger === el) st.kill();
            });
        };
    }, [animation, delay, distance, duration, staggerAmount, staggerChildren, threshold]);

    return (
        <div ref={ref} className={className} id={id}>
            {children}
        </div>
    );
}
