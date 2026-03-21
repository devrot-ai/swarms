/**
 * Multi-Provider Model System
 * 
 * Provides a robust, fault-tolerant model selection system that:
 * - Supports multiple AI providers (OpenAI, Anthropic, Google, Groq, local models)
 * - Automatically falls back when a provider fails
 * - Dynamically selects the best model for each task type
 * - Tracks model health and performance
 * - Handles rate limiting and errors gracefully
 */

export type TaskType = 
  | "classification"
  | "strategic"
  | "technical"
  | "creative"
  | "analysis"
  | "code_generation"
  | "code_review"
  | "general";

export type ProviderName = 
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "ollama"
  | "deepinfra";

export interface ModelConfig {
  id: string;                     // e.g., "openai/gpt-4o"
  provider: ProviderName;
  name: string;                   // Human-readable name
  capabilities: TaskType[];       // What this model is good at
  maxTokens: number;
  costPer1kTokens: number;        // For prioritization
  priority: number;               // Lower = higher priority
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  isLocal?: boolean;
  baseUrl?: string;
}

export interface ProviderHealth {
  provider: ProviderName;
  isHealthy: boolean;
  lastCheck: string;
  consecutiveFailures: number;
  averageLatencyMs: number;
  errorRate: number;
}

// ============================================================
// MODEL REGISTRY
// ============================================================

export const modelRegistry: ModelConfig[] = [
  // OpenAI Models (via AI Gateway)
  {
    id: "openai/gpt-4o",
    provider: "openai",
    name: "GPT-4o",
    capabilities: ["classification", "strategic", "technical", "creative", "analysis", "code_generation", "code_review", "general"],
    maxTokens: 4096,
    costPer1kTokens: 0.01,
    priority: 1,
    requiresApiKey: false, // Uses AI Gateway
  },
  {
    id: "openai/gpt-4o-mini",
    provider: "openai",
    name: "GPT-4o Mini",
    capabilities: ["classification", "analysis", "general"],
    maxTokens: 4096,
    costPer1kTokens: 0.0002,
    priority: 2,
    requiresApiKey: false,
  },
  // Anthropic Models (via AI Gateway)
  {
    id: "anthropic/claude-sonnet-4-20250514",
    provider: "anthropic",
    name: "Claude Sonnet 4",
    capabilities: ["classification", "strategic", "technical", "creative", "analysis", "code_generation", "code_review", "general"],
    maxTokens: 4096,
    costPer1kTokens: 0.003,
    priority: 2,
    requiresApiKey: false,
  },
  // Google Models (via AI Gateway)
  {
    id: "google/gemini-2.5-flash-preview-05-20",
    provider: "google",
    name: "Gemini 2.5 Flash",
    capabilities: ["classification", "strategic", "technical", "analysis", "code_generation", "general"],
    maxTokens: 4096,
    costPer1kTokens: 0.0002,
    priority: 3,
    requiresApiKey: false,
  },
  // Groq Models (requires API key)
  {
    id: "groq/llama-3.3-70b-versatile",
    provider: "groq",
    name: "Llama 3.3 70B",
    capabilities: ["classification", "technical", "analysis", "code_generation", "code_review", "general"],
    maxTokens: 4096,
    costPer1kTokens: 0,
    priority: 4,
    requiresApiKey: true,
    apiKeyEnvVar: "GROQ_API_KEY",
  },
  // DeepInfra Models (requires API key)
  {
    id: "deepinfra/meta-llama/Llama-3.3-70B-Instruct",
    provider: "deepinfra",
    name: "Llama 3.3 70B (DeepInfra)",
    capabilities: ["classification", "technical", "analysis", "code_generation", "general"],
    maxTokens: 4096,
    costPer1kTokens: 0.0005,
    priority: 5,
    requiresApiKey: true,
    apiKeyEnvVar: "DEEPINFRA_API_KEY",
  },
  // Local Ollama Models
  {
    id: "ollama/llama3.2",
    provider: "ollama",
    name: "Llama 3.2 (Local)",
    capabilities: ["classification", "general", "code_generation"],
    maxTokens: 2048,
    costPer1kTokens: 0,
    priority: 10,
    requiresApiKey: false,
    isLocal: true,
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  },
  {
    id: "ollama/mistral",
    provider: "ollama",
    name: "Mistral (Local)",
    capabilities: ["classification", "general", "code_generation"],
    maxTokens: 2048,
    costPer1kTokens: 0,
    priority: 10,
    requiresApiKey: false,
    isLocal: true,
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  },
];

// ============================================================
// PROVIDER HEALTH TRACKING
// ============================================================

const providerHealthMap = new Map<ProviderName, ProviderHealth>();

// Initialize health tracking
for (const provider of ["openai", "anthropic", "google", "groq", "ollama", "deepinfra"] as ProviderName[]) {
  providerHealthMap.set(provider, {
    provider,
    isHealthy: true,
    lastCheck: new Date().toISOString(),
    consecutiveFailures: 0,
    averageLatencyMs: 0,
    errorRate: 0,
  });
}

export function getProviderHealth(provider: ProviderName): ProviderHealth {
  return providerHealthMap.get(provider) ?? {
    provider,
    isHealthy: false,
    lastCheck: new Date().toISOString(),
    consecutiveFailures: 0,
    averageLatencyMs: 0,
    errorRate: 0,
  };
}

export function recordProviderSuccess(provider: ProviderName, latencyMs: number): void {
  const health = providerHealthMap.get(provider);
  if (health) {
    health.isHealthy = true;
    health.consecutiveFailures = 0;
    health.lastCheck = new Date().toISOString();
    // Rolling average latency
    health.averageLatencyMs = health.averageLatencyMs === 0 
      ? latencyMs 
      : (health.averageLatencyMs * 0.9 + latencyMs * 0.1);
    // Decrease error rate
    health.errorRate = Math.max(0, health.errorRate - 0.1);
    providerHealthMap.set(provider, health);
  }
}

export function recordProviderFailure(provider: ProviderName, error: string): void {
  const health = providerHealthMap.get(provider);
  if (health) {
    health.consecutiveFailures++;
    health.lastCheck = new Date().toISOString();
    health.errorRate = Math.min(1, health.errorRate + 0.2);
    
    // Mark as unhealthy after 3 consecutive failures
    if (health.consecutiveFailures >= 3) {
      health.isHealthy = false;
    }
    
    providerHealthMap.set(provider, health);
    
    console.log(`[v0] Provider ${provider} failure recorded: ${error}. Consecutive failures: ${health.consecutiveFailures}`);
  }
}

export function resetProviderHealth(provider: ProviderName): void {
  providerHealthMap.set(provider, {
    provider,
    isHealthy: true,
    lastCheck: new Date().toISOString(),
    consecutiveFailures: 0,
    averageLatencyMs: 0,
    errorRate: 0,
  });
}

export function getAllProviderHealth(): ProviderHealth[] {
  return Array.from(providerHealthMap.values());
}

// ============================================================
// MODEL SELECTION
// ============================================================

function isApiKeyAvailable(config: ModelConfig): boolean {
  if (!config.requiresApiKey) return true;
  if (!config.apiKeyEnvVar) return false;
  return !!process.env[config.apiKeyEnvVar];
}

/**
 * Select the best available model for a given task type
 */
export function selectModel(taskType: TaskType, preferredProvider?: ProviderName): ModelConfig | null {
  // Filter models that can handle this task
  const capable = modelRegistry.filter(m => m.capabilities.includes(taskType));
  
  // Filter by availability (API key check, health check)
  const available = capable.filter(m => {
    const health = getProviderHealth(m.provider);
    const hasKey = isApiKeyAvailable(m);
    
    // Prefer the specified provider if available
    if (preferredProvider && m.provider === preferredProvider && health.isHealthy && hasKey) {
      return true;
    }
    
    return health.isHealthy && hasKey;
  });
  
  if (available.length === 0) {
    // All providers are down or don't have keys - try any capable model
    console.log(`[v0] No healthy providers for ${taskType}, trying any capable model`);
    const anyCapable = capable.filter(m => isApiKeyAvailable(m));
    if (anyCapable.length > 0) {
      return anyCapable.sort((a, b) => a.priority - b.priority)[0];
    }
    return null;
  }
  
  // Sort by priority and health
  available.sort((a, b) => {
    const healthA = getProviderHealth(a.provider);
    const healthB = getProviderHealth(b.provider);
    
    // Prefer healthier providers
    if (healthA.errorRate !== healthB.errorRate) {
      return healthA.errorRate - healthB.errorRate;
    }
    
    // Then by priority
    return a.priority - b.priority;
  });
  
  return available[0];
}

/**
 * Get fallback models for a task type
 */
export function getFallbackModels(taskType: TaskType, excludeModel?: string): ModelConfig[] {
  const capable = modelRegistry
    .filter(m => m.capabilities.includes(taskType))
    .filter(m => m.id !== excludeModel)
    .filter(m => isApiKeyAvailable(m))
    .sort((a, b) => a.priority - b.priority);
  
  return capable;
}

/**
 * Get recommended model for specific agent roles
 */
export function getModelForRole(role: "ceo" | "cto" | "worker" | "classifier" | "default"): string {
  const primary = selectModel(
    role === "classifier" ? "classification" : 
    role === "cto" || role === "worker" ? "technical" : 
    role === "ceo" ? "strategic" : "general"
  );
  
  return primary?.id ?? "openai/gpt-4o-mini";
}

// ============================================================
// USER MODEL PREFERENCES
// ============================================================

export interface UserModelPreferences {
  preferredProvider?: ProviderName;
  enableLocalModels: boolean;
  maxCostPer1kTokens?: number;
  preferFasterModels: boolean;
}

const defaultPreferences: UserModelPreferences = {
  enableLocalModels: true,
  preferFasterModels: false,
};

let currentPreferences = { ...defaultPreferences };

export function setUserModelPreferences(prefs: Partial<UserModelPreferences>): void {
  currentPreferences = { ...currentPreferences, ...prefs };
}

export function getUserModelPreferences(): UserModelPreferences {
  return { ...currentPreferences };
}

// ============================================================
// MODEL AVAILABILITY CHECK
// ============================================================

export async function checkModelAvailability(modelId: string): Promise<{ available: boolean; reason?: string }> {
  const config = modelRegistry.find(m => m.id === modelId);
  
  if (!config) {
    return { available: false, reason: "Model not found in registry" };
  }
  
  if (config.requiresApiKey && !isApiKeyAvailable(config)) {
    return { 
      available: false, 
      reason: `API key not found. Set ${config.apiKeyEnvVar} environment variable.` 
    };
  }
  
  if (config.isLocal) {
    // Check if Ollama is running
    try {
      const response = await fetch(`${config.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      
      if (!response.ok) {
        return { available: false, reason: "Ollama server not responding" };
      }
      
      const data = await response.json() as { models?: Array<{ name: string }> };
      const modelName = modelId.replace("ollama/", "");
      const hasModel = data.models?.some(m => m.name.includes(modelName));
      
      if (!hasModel) {
        return { available: false, reason: `Model ${modelName} not installed in Ollama` };
      }
      
      return { available: true };
    } catch {
      return { available: false, reason: "Ollama server not reachable" };
    }
  }
  
  const health = getProviderHealth(config.provider);
  if (!health.isHealthy) {
    return { 
      available: false, 
      reason: `Provider ${config.provider} is currently unhealthy (${health.consecutiveFailures} consecutive failures)` 
    };
  }
  
  return { available: true };
}

// ============================================================
// EXPORTS
// ============================================================

export const ModelProvider = {
  selectModel,
  getFallbackModels,
  getModelForRole,
  recordSuccess: recordProviderSuccess,
  recordFailure: recordProviderFailure,
  getHealth: getProviderHealth,
  getAllHealth: getAllProviderHealth,
  resetHealth: resetProviderHealth,
  checkAvailability: checkModelAvailability,
  registry: modelRegistry,
  setPreferences: setUserModelPreferences,
  getPreferences: getUserModelPreferences,
};

export default ModelProvider;
