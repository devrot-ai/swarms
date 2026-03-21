"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./OnboardingFlow.module.css";

type Provider = "google" | "openai" | "anthropic" | "ollama" | "custom" | "demo";
type Template = "CEO" | "Marketing" | "Engineering" | "Design" | "Quick Task";

interface AvailableModel {
  provider: string;
  model: string;
  label: string;
  description?: string;
  isFree?: boolean;
}

const templates: Array<{
  name: Template;
  description: string;
  compute: string;
}> = [
  { name: "CEO", description: "Set mission objectives, KPI budget and escalation decisions.", compute: "Low" },
  { name: "Marketing", description: "Research, content production and campaign validation.", compute: "Medium" },
  { name: "Engineering", description: "Implementation, testing and reliable delivery orchestration.", compute: "High" },
  { name: "Design", description: "UX planning, interface flow and asset handoff.", compute: "Medium" },
  { name: "Quick Task", description: "Single constrained task with safety-first defaults.", compute: "Very Low" },
];

function isValidByProvider(provider: Provider, apiKey: string) {
  const key = apiKey.trim();
  if (key.length < 20) return false;

  switch (provider) {
    case "openai":
      return /^sk-[A-Za-z0-9_-]+$/.test(key);
    case "anthropic":
      return /^sk-ant-[A-Za-z0-9_-]+$/.test(key);
    case "google":
      return /^[A-Za-z0-9_-]{20,}$/.test(key);
    case "ollama":
      // Ollama runs locally and does not require an API key.
      return true;
    default:
      return key.length >= 20;
  }
}

function getLocalUid() {
  const key = "mc_uid";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const uid = `u_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  localStorage.setItem(key, uid);
  return uid;
}

export default function OnboardingFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<"welcome" | "apikey" | "agents">("welcome");
  const [modelMode, setModelMode] = useState<"default" | "apikey">("default");
  const [provider, setProvider] = useState<Provider>("demo");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [template, setTemplate] = useState<Template>("Quick Task");
  const [customize, setCustomize] = useState<Record<Template, boolean>>({
    CEO: false,
    Marketing: false,
    Engineering: false,
    Design: false,
    "Quick Task": false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  const apiKeyValid = useMemo(() => isValidByProvider(provider, apiKey), [provider, apiKey]);

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/mission-control/health")
      .then((r) => r.json())
      .then((data) => {
        const models: AvailableModel[] = data?.models ?? [];
        setAvailableModels(models);
        // Default to first free model
        const defaultModel = models.find(m => m.isFree)?.model ?? models[0]?.model ?? "";
        setSelectedModel(defaultModel);
      })
      .catch(() => {/* health endpoint unreachable */});
  }, []);

  const freeModels = availableModels.filter(m => m.isFree);
  const ollamaModels = availableModels.filter(m => m.provider === "ollama");

  const handleDefault = () => {
    setModelMode("default");
    setMessage(
      "Default model is rate-limited and used for demo or light workloads. Add your key for production.",
    );
    setMode("agents");
  };

  const handleApiKey = async () => {
    if (!apiKeyValid) {
      setMessage("Invalid key format for selected provider.");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("Validating and encrypting key...");
      const uid = getLocalUid();

      const response = await fetch(`/api/users/${uid}/apikey/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          model: provider === "google" ? "gemini" : "user-selected",
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.valid) {
        setMessage(payload.error ?? "Key validation failed.");
        return;
      }

      setModelMode("apikey");
      setMessage("Key accepted. Choose an agent template");
      setMode("agents");
    } catch {
      setMessage("Unable to validate key right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startMission = async () => {
    try {
      setIsSubmitting(true);
      const uid = getLocalUid();

      const response = await fetch("/api/mission-control/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, template, modelMode }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Failed to start mission.");
        return;
      }

      router.push(`/workspace/${payload.sessionId}`);
    } catch {
      setMessage("Could not start workspace session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} glass`}>
        {mode === "welcome" && (
          <>
            <h3 className={styles.title}>Welcome — pick an agent, or use Default</h3>
            <p className={styles.body}>
              Pick a ready agent or create your own. You can plug in your own provider key or use
              our default model for free (safe limits).
            </p>
            <div className={styles.row}>
              <button className="btn-primary" onClick={handleDefault} disabled={isSubmitting}>
                Use default model
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  setMode("apikey");
                  setMessage("");
                }}
                disabled={isSubmitting}
              >
                Use my API key
              </button>
            </div>
          </>
        )}

        {mode === "apikey" && (
          <>
            <h3 className={styles.title}>Use my API key</h3>
            <p className={styles.body}>
              Enter API key (will be encrypted). Select provider: Ollama (local),
              Google Antigravity (Gemini), OpenAI, Anthropic or Custom.
            </p>

            <label className={styles.label}>Provider</label>
            <select
              className={styles.input}
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
            >
              <option value="ollama">Ollama (local)</option>
              <option value="google">Google Antigravity (Gemini)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="custom">Custom</option>
            </select>

            <label className={styles.label}>API key</label>
            <input
              type="password"
              className={styles.input}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Enter API key"
            />

            <div className={styles.row}>
              <button className="btn-primary" onClick={handleApiKey} disabled={isSubmitting || !apiKeyValid}>
                Validate key
              </button>
              <button className="btn-outline" onClick={() => setMode("welcome")} disabled={isSubmitting}>
                Back
              </button>
            </div>
          </>
        )}

        {mode === "agents" && (
          <>
            <h3 className={styles.title}>Choose an agent template</h3>
            <p className={styles.body}>Pick a template, adjust customize toggles, then start mission.</p>
            <div className={styles.grid}>
              {templates.map((item) => (
                <label key={item.name} className={`${styles.tile} ${template === item.name ? styles.tileActive : ""}`}>
                  <input
                    type="radio"
                    name="template"
                    checked={template === item.name}
                    onChange={() => setTemplate(item.name)}
                  />
                  <div>
                    <h4>{item.name}</h4>
                    <p>{item.description}</p>
                    <small>Estimated compute: {item.compute}</small>
                  </div>
                  <div className={styles.customizeRow}>
                    <span>Customize</span>
                    <input
                      type="checkbox"
                      checked={customize[item.name]}
                      onChange={(event) =>
                        setCustomize((prev) => ({ ...prev, [item.name]: event.target.checked }))
                      }
                    />
                  </div>
                </label>
              ))}
            </div>
            <div className={styles.row}>
              <button className="btn-primary" onClick={startMission} disabled={isSubmitting}>
                Start mission
              </button>
              <button className="btn-outline" onClick={() => setMode("welcome")} disabled={isSubmitting}>
                Back
              </button>
            </div>
          </>
        )}

        {message ? <p className={styles.note}>{message}</p> : null}
      </div>
    </div>
  );
}
