"use client";

import { useEffect, useState } from "react";
import styles from "./LoadingScreen.module.css";

export default function LoadingScreen() {
    const [progress, setProgress] = useState(0);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => setHidden(true), 600);
                    return 100;
                }
                return prev + Math.random() * 15 + 5;
            });
        }, 120);

        return () => clearInterval(interval);
    }, []);

    if (hidden) return null;

    return (
        <div
            className={`${styles.loader} ${progress >= 100 ? styles.loaderDone : ""}`}
        >
            <div className={styles.loaderContent}>
                <div className={styles.loaderLogo}>
                    <span className={styles.loaderIcon}>⬡</span>
                    <span className={styles.loaderTitle}>SWARMS</span>
                </div>
                <div className={styles.loaderBar}>
                    <div
                        className={styles.loaderFill}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
                <span className={styles.loaderPercent}>
                    {Math.min(Math.round(progress), 100)}%
                </span>
            </div>
        </div>
    );
}
