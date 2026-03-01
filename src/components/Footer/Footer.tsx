"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Footer.module.css";

const footerLinks = [
    {
        title: "Product",
        links: [
            { label: "Documentation", href: "https://github.com/devrot-ai" },
            { label: "API Reference", href: "https://github.com/devrot-ai" },
            { label: "Pricing", href: "#work" },
            { label: "Changelog", href: "https://github.com/devrot-ai" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About", href: "#about" },
            { label: "Blog", href: "https://github.com/devrot-ai" },
            { label: "Careers", href: "https://discord.com/channels/1476833548551065672/1476833549276418110" },
            { label: "Contact", href: "https://discord.com/channels/1476833548551065672/1476833549276418110" },
        ],
    },
    {
        title: "Resources",
        links: [
            { label: "GitHub", href: "https://github.com/devrot-ai" },
            { label: "Discord", href: "https://discord.com/channels/1476833548551065672/1476833549276418110" },
            { label: "Tutorials", href: "https://github.com/devrot-ai" },
            { label: "Examples", href: "https://github.com/devrot-ai" },
        ],
    },
];

const socials = [
    { label: "Twitter", icon: "𝕏", href: "https://x.com/home" },
    { label: "GitHub", icon: "⌘", href: "https://github.com/devrot-ai" },
    { label: "Discord", icon: "◈", href: "https://discord.com/channels/1476833548551065672/1476833549276418110" },
];

export default function Footer() {
    const [email, setEmail] = useState("");
    const footerRef = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setVisible(true);
            },
            { threshold: 0.1 }
        );
        if (footerRef.current) observer.observe(footerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <footer
            id="footer"
            ref={footerRef}
            className={`${styles.footer} ${visible ? styles.visible : ""}`}
        >
            <div className={styles.divider}>
                <div className={styles.dividerLine} />
            </div>

            <div className={`container ${styles.footerInner}`}>
                <div className={styles.top}>
                    <div className={styles.newsletter}>
                        <h3 className={styles.newsletterTitle}>
                            Stay in the <span className="gradient-text">loop</span>
                        </h3>
                        <p className={styles.newsletterDesc}>
                            Get the latest updates on the closed-loop agent pipeline, new
                            triggers, and swarm capabilities.
                        </p>
                        <div className={styles.inputWrapper}>
                            <input
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.emailInput}
                            />
                            <button className={styles.submitBtn} data-hover="true">
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 18 18"
                                    fill="none"
                                >
                                    <path
                                        d="M3 9H15M15 9L10 4M15 9L10 14"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className={styles.linksGrid}>
                        {footerLinks.map((group) => (
                            <div key={group.title} className={styles.linkGroup}>
                                <h4 className={styles.linkGroupTitle}>{group.title}</h4>
                                <ul className={styles.linkList}>
                                    {group.links.map((link) => (
                                        <li key={link.label}>
                                            <a
                                                href={link.href}
                                                className={styles.link}
                                                data-hover="true"
                                                target={link.href.startsWith("#") && !link.href.startsWith("#about") ? "_blank" : undefined}
                                                rel={link.href.startsWith("#") && !link.href.startsWith("#about") ? "noopener noreferrer" : undefined}
                                            >
                                                {link.label}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.bottom}>
                    <div className={styles.brand}>
                        <span className={styles.brandIcon}>⬡</span>
                        <span className={styles.brandName}>SWARMS</span>
                    </div>
                    <p className={styles.copy}>
                        © {new Date().getFullYear()} Swarms AI. All rights reserved.
                    </p>
                    <div className={styles.socials}>
                        {socials.map((s) => (
                            <a
                                key={s.label}
                                href={s.href}
                                data-hover="true"
                                aria-label={s.label}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {s.icon}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}

