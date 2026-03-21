/**
 * Agent Executor with Fallback Logic
 * 
 * Provides robust execution of AI agents with:
 * - Automatic model fallback when primary fails
 * - Error recovery and retry logic
 * - Streaming with progress tracking
 * - Health monitoring and circuit breaking
 * - Graceful degradation
 */

import { streamText, convertToModelMessages, Output } from "ai";
import { z } from "zod";
import { 
  ModelProvider, 
  type TaskType, 
  type ModelConfig,
  type ProviderName 
} from "../models/provider";
import { taskQueue, type Task } from "../queue/taskQueue";
import { agentMetadata, type AgentId } from "./index";

// ============================================================
// TYPES
// ============================================================

export interface ExecutionOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  preferredProvider?: ProviderName;
  taskType?: TaskType;
  streamTokens?: boolean;
  onToken?: (token: string) => void;
  onProgress?: (progress: number, message: string) => void;
  onModelSwitch?: (fromModel: string, toModel: string, reason: string) => void;
}

export interface ExecutionResult {
  success: boolean;
  content: string;
  model: string;
  provider: ProviderName;
  tokensUsed?: number;
  latencyMs: number;
  retries: number;
  fallbacksUsed: string[];
  error?: string;
}

// ============================================================
// AGENT EXECUTOR
// ============================================================

export class AgentExecutor {
  private defaultOptions: ExecutionOptions = {
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 60000,
    streamTokens: true,
  };

  /**
   * Execute an agent with automatic fallback
   */
  async execute(
    agentId: AgentId,
    prompt: string,
    systemPrompt: string,
    tools: Record<string, unknown> = {},
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const fallbacksUsed: string[] = [];
    let lastError: Error | null = null;

    // Determine task type from agent
    const taskType = this.getTaskTypeForAgent(agentId);

    // Get initial model
    let currentModel = ModelProvider.selectModel(
      opts.taskType ?? taskType,
      opts.preferredProvider
    );

    if (!currentModel) {
      return {
        success: false,
        content: "",
        model: "none",
        provider: "openai",
        latencyMs: Date.now() - startTime,
        retries: 0,
        fallbacksUsed: [],
        error: "No available models found. Please configure at least one AI provider.",
      };
    }

    let attempt = 0;
    const maxAttempts = opts.maxRetries! + 1;

    while (attempt < maxAttempts) {
      attempt++;
      const attemptStart = Date.now();

      try {
        opts.onProgress?.(
          Math.round((attempt / maxAttempts) * 20),
          `Attempting with ${currentModel.name}...`
        );

        const result = await this.executeWithModel(
          currentModel,
          prompt,
          systemPrompt,
          tools,
          opts
        );

        // Success - record it
        ModelProvider.recordSuccess(currentModel.provider, Date.now() - attemptStart);

        return {
          success: true,
          content: result.content,
          model: currentModel.id,
          provider: currentModel.provider,
          tokensUsed: result.tokensUsed,
          latencyMs: Date.now() - startTime,
          retries: attempt - 1,
          fallbacksUsed,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        console.log(`[v0] Model ${currentModel.id} failed: ${errorMessage}`);

        // Record failure
        ModelProvider.recordFailure(currentModel.provider, errorMessage);

        // Check if we should try a fallback
        if (this.isRetryableError(errorMessage) && attempt < maxAttempts) {
          // Get fallback models
          const fallbacks = ModelProvider.getFallbackModels(
            opts.taskType ?? taskType,
            currentModel.id
          );

          if (fallbacks.length > 0) {
            const nextModel = fallbacks[0];
            fallbacksUsed.push(currentModel.id);
            
            opts.onModelSwitch?.(
              currentModel.id,
              nextModel.id,
              errorMessage
            );

            currentModel = nextModel;
            
            // Wait before retry with exponential backoff
            const delay = opts.retryDelayMs! * Math.pow(2, attempt - 1);
            await this.sleep(delay);
            
            continue;
          }
        }

        // No more retries or non-retryable error
        break;
      }
    }

    // All attempts failed
    return {
      success: false,
      content: this.getGracefulFallbackResponse(agentId, prompt),
      model: currentModel.id,
      provider: currentModel.provider,
      latencyMs: Date.now() - startTime,
      retries: attempt - 1,
      fallbacksUsed,
      error: lastError?.message ?? "Unknown error",
    };
  }

  /**
   * Execute with a specific model
   */
  private async executeWithModel(
    model: ModelConfig,
    prompt: string,
    systemPrompt: string,
    tools: Record<string, unknown>,
    options: ExecutionOptions
  ): Promise<{ content: string; tokensUsed?: number }> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const result = await streamText({
        model: model.id,
        system: systemPrompt,
        prompt: prompt,
        tools: tools as Record<string, unknown>,
        abortSignal: controller.signal,
        maxOutputTokens: model.maxTokens,
      });

      let content = "";

      // Stream tokens if enabled
      if (options.streamTokens) {
        for await (const chunk of result.textStream) {
          content += chunk;
          options.onToken?.(chunk);
        }
      } else {
        content = await result.text;
      }

      // Get usage info
      const usage = await result.usage;

      return {
        content,
        tokensUsed: usage?.totalTokens,
      };

    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Stream execution with real-time updates
   */
  async *stream(
    agentId: AgentId,
    prompt: string,
    systemPrompt: string,
    tools: Record<string, unknown> = {},
    options: ExecutionOptions = {}
  ): AsyncGenerator<{ type: string; data: unknown }> {
    const opts = { ...this.defaultOptions, ...options };
    const taskType = this.getTaskTypeForAgent(agentId);
    
    let currentModel = ModelProvider.selectModel(
      opts.taskType ?? taskType,
      opts.preferredProvider
    );

    if (!currentModel) {
      yield { type: "error", data: { message: "No available models" } };
      return;
    }

    yield { 
      type: "start", 
      data: { 
        model: currentModel.id, 
        provider: currentModel.provider,
        agent: agentId,
      } 
    };

    let attempt = 0;
    const maxAttempts = opts.maxRetries! + 1;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        const result = await streamText({
          model: currentModel.id,
          system: systemPrompt,
          prompt: prompt,
          tools: tools as Record<string, unknown>,
          maxOutputTokens: currentModel.maxTokens,
        });

        for await (const chunk of result.textStream) {
          yield { type: "token", data: { token: chunk } };
        }

        const usage = await result.usage;
        
        yield { 
          type: "complete", 
          data: { 
            tokensUsed: usage?.totalTokens,
            model: currentModel.id,
          } 
        };

        return;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        ModelProvider.recordFailure(currentModel.provider, errorMessage);

        if (this.isRetryableError(errorMessage) && attempt < maxAttempts) {
          const fallbacks = ModelProvider.getFallbackModels(taskType, currentModel.id);
          
          if (fallbacks.length > 0) {
            yield { 
              type: "fallback", 
              data: { 
                from: currentModel.id, 
                to: fallbacks[0].id,
                reason: errorMessage,
              } 
            };
            
            currentModel = fallbacks[0];
            await this.sleep(opts.retryDelayMs! * attempt);
            continue;
          }
        }

        yield { type: "error", data: { message: errorMessage } };
        return;
      }
    }
  }

  /**
   * Execute intent classification with fallback
   */
  async classifyIntent(message: string): Promise<{
    intent: string;
    confidence: number;
    reasoning: string;
    model: string;
  }> {
    const model = ModelProvider.selectModel("classification");
    
    if (!model) {
      // Return default classification if no model available
      return {
        intent: "general",
        confidence: 0.3,
        reasoning: "No AI model available for classification",
        model: "fallback",
      };
    }

    try {
      const result = await streamText({
        model: model.id,
        output: Output.object({
          schema: z.object({
            intent: z.enum([
              "strategic_planning",
              "operational_planning",
              "technical_build",
              "technical_review",
              "research",
              "marketing",
              "financial",
              "hr_planning",
              "legal_compliance",
              "qa_testing",
              "infrastructure",
              "design",
              "status_report",
              "general",
            ]),
            confidence: z.number().min(0).max(1),
            reasoning: z.string(),
          }),
        }),
        prompt: this.getClassificationPrompt(message),
      });

      const output = await result.output;
      
      ModelProvider.recordSuccess(model.provider, 500);

      return {
        intent: output?.intent ?? "general",
        confidence: output?.confidence ?? 0.5,
        reasoning: output?.reasoning ?? "Classification completed",
        model: model.id,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ModelProvider.recordFailure(model.provider, errorMessage);

      // Try fallback for classification
      return this.fallbackClassification(message);
    }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private getTaskTypeForAgent(agentId: AgentId): TaskType {
    const taskTypeMap: Record<AgentId, TaskType> = {
      ceo_agent: "strategic",
      coo_agent: "analysis",
      cto_agent: "technical",
      cfo_agent: "analysis",
      marketing_agent: "creative",
      hr_agent: "analysis",
      legal_agent: "analysis",
      qa_agent: "technical",
      devops_agent: "technical",
      design_agent: "creative",
      research_agent: "analysis",
      worker_agent: "code_generation",
    };
    return taskTypeMap[agentId] ?? "general";
  }

  private isRetryableError(error: string): boolean {
    const retryablePatterns = [
      "rate limit",
      "timeout",
      "503",
      "502",
      "500",
      "overloaded",
      "capacity",
      "temporarily unavailable",
      "credit card", // Specific to AI Gateway
      "customer_verification_required",
      "connection refused",
      "ECONNREFUSED",
      "network error",
    ];

    const lowerError = error.toLowerCase();
    return retryablePatterns.some(pattern => lowerError.includes(pattern.toLowerCase()));
  }

  private getGracefulFallbackResponse(agentId: AgentId, prompt: string): string {
    const meta = agentMetadata[agentId];
    
    return `**${meta.name} (${meta.department})** is currently unable to process your request due to temporary service issues.

**Your request:** "${prompt.slice(0, 200)}${prompt.length > 200 ? '...' : ''}"

**What you can do:**
1. Try again in a few moments
2. Check that your AI provider is properly configured
3. Contact support if the issue persists

**Troubleshooting:**
- Ensure API keys are set in environment variables
- Check that at least one AI provider is available
- Review the provider health status in the system dashboard`;
  }

  private getClassificationPrompt(message: string): string {
    return `Classify the user's intent based on their message.

USER MESSAGE: "${message}"

CLASSIFICATION GUIDE:
- strategic_planning: High-level strategy, company vision, major decisions, planning a new product/initiative
- operational_planning: Breaking down plans into tasks, project management, timelines, execution planning
- technical_build: Building features, writing code, implementing solutions, creating technical components
- technical_review: Code review, architecture review, technical assessment, security review
- research: Market research, competitor analysis, data gathering, trend analysis
- marketing: Marketing campaigns, content creation, branding, growth strategies, go-to-market
- financial: Budgets, ROI calculations, financial planning, cost analysis
- hr_planning: Team capacity, hiring, resource allocation, skills assessment
- legal_compliance: Contracts, legal review, compliance checks, regulatory matters
- qa_testing: Testing, quality assurance, bug tracking, test planning
- infrastructure: DevOps, deployment, CI/CD, infrastructure, monitoring
- design: UX design, visual design, user interface, accessibility
- status_report: Progress updates, status checks, what's been done
- general: Unclear or doesn't fit other categories

Classify the intent with high accuracy.`;
  }

  private fallbackClassification(message: string): {
    intent: string;
    confidence: number;
    reasoning: string;
    model: string;
  } {
    // Simple keyword-based fallback classification
    const lower = message.toLowerCase();
    
    const patterns: Array<{ keywords: string[]; intent: string }> = [
      { keywords: ["strategy", "vision", "plan", "goal", "objective"], intent: "strategic_planning" },
      { keywords: ["task", "execute", "timeline", "schedule", "project"], intent: "operational_planning" },
      { keywords: ["build", "code", "implement", "create", "develop", "api"], intent: "technical_build" },
      { keywords: ["review", "audit", "check", "security", "vulnerability"], intent: "technical_review" },
      { keywords: ["research", "competitor", "market", "trend", "analyze"], intent: "research" },
      { keywords: ["marketing", "campaign", "content", "brand", "launch"], intent: "marketing" },
      { keywords: ["budget", "cost", "roi", "financial", "revenue"], intent: "financial" },
      { keywords: ["team", "hire", "capacity", "resource", "skills"], intent: "hr_planning" },
      { keywords: ["legal", "contract", "compliance", "policy"], intent: "legal_compliance" },
      { keywords: ["test", "qa", "bug", "quality"], intent: "qa_testing" },
      { keywords: ["deploy", "infrastructure", "devops", "ci/cd"], intent: "infrastructure" },
      { keywords: ["design", "ux", "ui", "interface"], intent: "design" },
      { keywords: ["status", "progress", "update", "report"], intent: "status_report" },
    ];

    for (const { keywords, intent } of patterns) {
      if (keywords.some(k => lower.includes(k))) {
        return {
          intent,
          confidence: 0.6,
          reasoning: `Keyword match: ${keywords.find(k => lower.includes(k))}`,
          model: "fallback-keywords",
        };
      }
    }

    return {
      intent: "general",
      confidence: 0.4,
      reasoning: "No specific keywords matched",
      model: "fallback-keywords",
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const agentExecutor = new AgentExecutor();
export default agentExecutor;
