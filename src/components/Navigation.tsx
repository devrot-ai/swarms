"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./Navigation.module.css";

const navLinks = [
    { label: "Home", href: "#hero" },
    { label: "About", href: "#about" },
    { label: "Closed Loop", href: "#work" },
    { label: "Architecture", href: "#architecture" },
    { label: "Contact", href: "#footer" },
];

export default function Navigation() {
    const [menuOpen, setMenuOpen] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (menuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    }, [menuOpen]);

    const handleLinkClick = () => {
        setMenuOpen(false);
    };

    return (
        <>
            <nav className={styles.nav}>
                <a href="#hero" className={styles.logo} data-hover="true">
                    <span className={styles.logoIcon}>⬡</span>
                    <span className={styles.logoText}>SWARMS</span>
                </a>

                <button
                    className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnActive : ""}`}
                    onClick={() => setMenuOpen(!menuOpen)}
                    data-hover="true"
                    aria-label="Toggle menu"
                >
                    <span className={styles.menuLine} />
                    <span className={styles.menuLine} />
                </button>
            </nav>

            <div
                ref={overlayRef}
                className={`${styles.overlay} ${menuOpen ? styles.overlayOpen : ""}`}
            >
                <div className={styles.overlayContent}>
                    <div className={styles.overlayLinks}>
                        {navLinks.map((link, i) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className={styles.overlayLink}
                                onClick={handleLinkClick}
                                data-hover="true"
                                style={{ transitionDelay: `${0.05 + i * 0.05}s` }}
                            >
                                <span className={styles.linkIndex}>
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className={styles.linkLabel}>{link.label}</span>
                            </a>
                        ))}
                    </div>
                    <div className={styles.overlayFooter}>
                        <p>hello@swarms.ai</p>
                        <div className={styles.overlaySocials}>
                            <a href="https://x.com/home" target="_blank" rel="noopener noreferrer" data-hover="true">Twitter/X</a>
                            <a href="https://github.com/devrot-ai" target="_blank" rel="noopener noreferrer" data-hover="true">GitHub</a>
                            <a href="https://discord.com/channels/1476833548551065672/1476833549276418110" target="_blank" rel="noopener noreferrer" data-hover="true">Discord</a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
