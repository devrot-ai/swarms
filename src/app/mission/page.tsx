"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./mission.module.css";

export default function MissionCreatePage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [prompt, setPrompt] = useState(
    "Create a company plan for a student-focused AI interview prep SaaS.",
  );
  const [autoRun, setAutoRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const createRes = await fetch("/api/mission/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId.trim() || undefined,
          prompt,
        }),
      });

      if (!createRes.ok) {
        const failed = (await createRes.json()) as { error?: string; details?: string };
        throw new Error(failed.details ?? failed.error ?? "Mission creation failed.");
      }

      const created = (await createRes.json()) as { missionId: string };

      if (autoRun) {
        await fetch(`/api/mission/${created.missionId}/run`, {
          method: "POST",
        });
      }

      setSuccess(`Mission created: ${created.missionId}`);
      router.push(`/mission/${created.missionId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown mission error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.title}>Mission Control</h1>
        <p className={styles.subtitle}>
          Create a mission and run the multi-agent company workflow.
        </p>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            User ID (optional UUID)
            <input
              className={styles.input}
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="user_uuid_optional"
            />
          </label>

          <label className={styles.label}>
            Business Goal
            <textarea
              className={styles.textarea}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>

          <div className={styles.row}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Mission"}
            </button>

            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={autoRun}
                onChange={(event) => setAutoRun(event.target.checked)}
              />
              Run immediately
            </label>
          </div>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}
        </form>
      </section>
    </main>
  );
}
