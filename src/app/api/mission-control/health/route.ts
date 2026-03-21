/**
 * Health & Status API
 * 
 * Provides system health information including:
 * - Provider health and availability
 * - Task queue statistics
 * - Model registry status
 */

import { NextResponse } from "next/server";
import { ModelProvider } from "@/lib/mission-control/models/provider";
import { taskQueue } from "@/lib/mission-control/queue/taskQueue";
import { agentMetadata } from "@/lib/mission-control/agents";

export async function GET() {
  try {
    // Get provider health
    const providerHealth = ModelProvider.getAllHealth();
    
    // Check model availability
    const modelChecks = await Promise.all(
      ModelProvider.registry.slice(0, 6).map(async (model) => ({
        model: model.id,
        name: model.name,
        provider: model.provider,
        ...(await ModelProvider.checkAvailability(model.id)),
      }))
    );

    // Get queue stats
    const queueStats = taskQueue.getStats();

    // Get recent tasks
    const recentTasks = taskQueue.getAllTasks()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        progress: t.progress,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));

    // System status
    const healthyProviders = providerHealth.filter(p => p.isHealthy).length;
    const totalProviders = providerHealth.length;
    const availableModels = modelChecks.filter(m => m.available).length;
    
    let systemStatus: "healthy" | "degraded" | "unhealthy";
    if (healthyProviders === 0 || availableModels === 0) {
      systemStatus = "unhealthy";
    } else if (healthyProviders < totalProviders / 2) {
      systemStatus = "degraded";
    } else {
      systemStatus = "healthy";
    }

    // Get agent info
    const agents = Object.entries(agentMetadata).map(([id, meta]) => ({
      id,
      name: meta.name,
      department: meta.department,
      description: meta.description,
    }));

    return NextResponse.json({
      status: systemStatus,
      timestamp: new Date().toISOString(),
      
      providers: {
        total: totalProviders,
        healthy: healthyProviders,
        details: providerHealth.map(p => ({
          provider: p.provider,
          isHealthy: p.isHealthy,
          consecutiveFailures: p.consecutiveFailures,
          errorRate: Math.round(p.errorRate * 100) / 100,
          averageLatencyMs: Math.round(p.averageLatencyMs),
          lastCheck: p.lastCheck,
        })),
      },
      
      models: {
        total: ModelProvider.registry.length,
        available: availableModels,
        checks: modelChecks,
      },
      
      queue: {
        ...queueStats,
        recentTasks,
      },

      agents,
      agentCount: agents.length,
      
      capabilities: [
        "Strategic planning and vision",
        "Operational task management",
        "Technical implementation",
        "Code generation and review",
        "Marketing campaigns",
        "Financial analysis",
        "HR and capacity planning",
        "Legal compliance",
        "Quality assurance",
        "DevOps and deployment",
        "UX/UI design",
        "Research and analysis",
      ],
      
      recommendations: getRecommendations(systemStatus, providerHealth, modelChecks),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        error: msg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

function getRecommendations(
  status: string,
  providers: ReturnType<typeof ModelProvider.getAllHealth>,
  models: Array<{ model: string; available: boolean; reason?: string }>
): string[] {
  const recommendations: string[] = [];

  if (status === "unhealthy") {
    recommendations.push("System needs configuration. Please set up at least one AI provider.");
  }

  // Check for AI Gateway issues
  const gatewayIssue = models.find(m => 
    m.reason?.includes("credit card") || m.reason?.includes("customer_verification")
  );
  if (gatewayIssue) {
    recommendations.push(
      "Vercel AI Gateway requires a credit card. Add one in Settings, or configure Groq (free) as an alternative."
    );
  }

  // Check for unhealthy providers
  const unhealthyProviders = providers.filter(p => !p.isHealthy);
  if (unhealthyProviders.length > 0 && unhealthyProviders.length < providers.length) {
    recommendations.push(
      `Some providers are temporarily unavailable: ${unhealthyProviders.map(p => p.provider).join(", ")}`
    );
  }

  // Check for missing API keys
  const missingKeys = models.filter(m => m.reason?.includes("API key"));
  if (missingKeys.length > 0) {
    const providers = [...new Set(missingKeys.map(m => m.model.split("/")[0]))];
    recommendations.push(
      `Set API keys for additional providers: ${providers.join(", ")}`
    );
  }

  // Suggest free alternatives
  const groqAvailable = models.find(m => m.model.includes("groq") && m.available);
  
  if (!groqAvailable && status !== "healthy") {
    recommendations.push(
      "Tip: Set GROQ_API_KEY for free, fast inference with Llama 3.3 70B."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("All systems operational. Ready to process requests.");
  }

  return recommendations;
}

// POST to reset provider health (for manual recovery)
export async function POST(req: Request) {
  try {
    const body = await req.json() as { action: string; provider?: string };
    
    if (body.action === "reset_health" && body.provider) {
      ModelProvider.resetHealth(body.provider as "openai" | "anthropic" | "google" | "groq" | "ollama" | "deepinfra");
      return NextResponse.json({ success: true, message: `Reset health for ${body.provider}` });
    }
    
    if (body.action === "reset_all") {
      for (const provider of ["openai", "anthropic", "google", "groq", "ollama", "deepinfra"] as const) {
        ModelProvider.resetHealth(provider);
      }
      return NextResponse.json({ success: true, message: "Reset all provider health" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
