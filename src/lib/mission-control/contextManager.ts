/**
 * Context Manager
 * 
 * Handles extended context for larger, more detailed exchanges.
 * Manages conversation history, summarization, and context window optimization.
 */

export interface ConversationTurn {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  agentId?: string;
  responseMode?: "detailed" | "balanced" | "concise";
  metadata?: {
    intent?: string;
    tokensUsed?: number;
    processingTime?: number;
  };
}

export interface ConversationContext {
  sessionId: string;
  turns: ConversationTurn[];
  summary?: string;
  keyTopics: string[];
  totalTokens: number;
  createdAt: string;
  lastUpdatedAt: string;
}

// In-memory context store (would be persisted in production)
const contextStore = new Map<string, ConversationContext>();

// Context limits
const MAX_TURNS_IN_CONTEXT = 20;
const MAX_TOKENS_BEFORE_SUMMARY = 8000;
const SUMMARY_TARGET_TOKENS = 500;

/**
 * Context Manager Class
 */
class ContextManagerService {
  /**
   * Get or create context for a session
   */
  getContext(sessionId: string): ConversationContext {
    if (!contextStore.has(sessionId)) {
      contextStore.set(sessionId, {
        sessionId,
        turns: [],
        keyTopics: [],
        totalTokens: 0,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      });
    }
    return contextStore.get(sessionId)!;
  }

  /**
   * Add a turn to the conversation
   */
  addTurn(
    sessionId: string,
    turn: Omit<ConversationTurn, "id" | "timestamp">
  ): ConversationTurn {
    const context = this.getContext(sessionId);
    
    const newTurn: ConversationTurn = {
      ...turn,
      id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    
    context.turns.push(newTurn);
    context.totalTokens += this.estimateTokens(turn.content);
    context.lastUpdatedAt = new Date().toISOString();
    
    // Extract key topics from user messages
    if (turn.role === "user") {
      const topics = this.extractKeyTopics(turn.content);
      context.keyTopics = [...new Set([...context.keyTopics, ...topics])].slice(-10);
    }
    
    // Check if we need to summarize
    if (context.totalTokens > MAX_TOKENS_BEFORE_SUMMARY) {
      this.summarizeOlderTurns(sessionId);
    }
    
    // Trim old turns if needed
    if (context.turns.length > MAX_TURNS_IN_CONTEXT) {
      this.trimOldTurns(sessionId);
    }
    
    return newTurn;
  }

  /**
   * Get formatted context for AI prompt
   */
  getFormattedContext(
    sessionId: string,
    maxTurns: number = 10
  ): string {
    const context = this.getContext(sessionId);
    const parts: string[] = [];
    
    // Add summary if available
    if (context.summary) {
      parts.push("## Previous Conversation Summary");
      parts.push(context.summary);
      parts.push("");
    }
    
    // Add key topics
    if (context.keyTopics.length > 0) {
      parts.push("## Key Topics Discussed");
      parts.push(context.keyTopics.join(", "));
      parts.push("");
    }
    
    // Add recent turns
    const recentTurns = context.turns.slice(-maxTurns);
    if (recentTurns.length > 0) {
      parts.push("## Recent Conversation");
      recentTurns.forEach(turn => {
        const roleLabel = turn.role === "user" ? "User" : `Agent (${turn.agentId || "system"})`;
        parts.push(`**${roleLabel}:** ${turn.content.slice(0, 500)}${turn.content.length > 500 ? "..." : ""}`);
      });
    }
    
    return parts.join("\n");
  }

  /**
   * Generate conversation summary for detailed exchanges
   */
  generateConversationSummary(sessionId: string): string {
    const context = this.getContext(sessionId);
    
    if (context.turns.length === 0) {
      return "No conversation history yet.";
    }
    
    const userTurns = context.turns.filter(t => t.role === "user");
    const agentTurns = context.turns.filter(t => t.role === "agent");
    
    const summary = [
      `**Conversation Summary (${context.turns.length} exchanges)**`,
      "",
      `**Topics Covered:** ${context.keyTopics.join(", ") || "General discussion"}`,
      "",
      `**User Requests:** ${userTurns.length} messages`,
      userTurns.slice(-3).map(t => `- ${t.content.slice(0, 100)}...`).join("\n"),
      "",
      `**Agent Responses:** ${agentTurns.length} responses`,
      "",
      `**Session Duration:** ${this.getSessionDuration(context)}`,
    ].join("\n");
    
    return summary;
  }

  /**
   * Summarize older turns to save context space
   */
  private summarizeOlderTurns(sessionId: string): void {
    const context = this.getContext(sessionId);
    
    // Take the first half of turns and summarize them
    const turnsToSummarize = context.turns.slice(0, Math.floor(context.turns.length / 2));
    
    if (turnsToSummarize.length === 0) return;
    
    // Create a simple summary
    const topics = new Set<string>();
    const actions = new Set<string>();
    
    turnsToSummarize.forEach(turn => {
      if (turn.role === "user") {
        // Extract intent
        if (turn.metadata?.intent) {
          actions.add(turn.metadata.intent);
        }
      }
      // Extract keywords
      const keywords = this.extractKeyTopics(turn.content);
      keywords.forEach(k => topics.add(k));
    });
    
    context.summary = [
      `Discussed ${turnsToSummarize.length} topics including: ${[...topics].slice(0, 5).join(", ")}.`,
      `Actions covered: ${[...actions].join(", ") || "general conversation"}.`,
    ].join(" ");
    
    // Remove summarized turns
    context.turns = context.turns.slice(turnsToSummarize.length);
    
    // Recalculate tokens
    context.totalTokens = context.turns.reduce(
      (sum, turn) => sum + this.estimateTokens(turn.content),
      this.estimateTokens(context.summary)
    );
  }

  /**
   * Trim old turns when exceeding max
   */
  private trimOldTurns(sessionId: string): void {
    const context = this.getContext(sessionId);
    const excess = context.turns.length - MAX_TURNS_IN_CONTEXT;
    
    if (excess > 0) {
      // Add trimmed content to summary
      const trimmedTurns = context.turns.slice(0, excess);
      const trimmedTopics = trimmedTurns
        .flatMap(t => this.extractKeyTopics(t.content))
        .slice(0, 5);
      
      context.summary = context.summary 
        ? `${context.summary} Also discussed: ${trimmedTopics.join(", ")}.`
        : `Earlier discussion covered: ${trimmedTopics.join(", ")}.`;
      
      context.turns = context.turns.slice(excess);
    }
  }

  /**
   * Extract key topics from text
   */
  private extractKeyTopics(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "must", "shall", "can", "to", "of", "in",
      "for", "on", "with", "at", "by", "from", "as", "into", "through",
      "during", "before", "after", "above", "below", "between", "under",
      "again", "further", "then", "once", "here", "there", "when", "where",
      "why", "how", "all", "each", "few", "more", "most", "other", "some",
      "such", "no", "nor", "not", "only", "own", "same", "so", "than",
      "too", "very", "just", "and", "but", "if", "or", "because", "until",
      "while", "about", "against", "between", "into", "through", "during",
      "i", "me", "my", "we", "our", "you", "your", "it", "its", "this",
      "that", "these", "those", "what", "which", "who", "whom", "please",
      "help", "want", "need", "like", "make", "get", "create", "build",
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    
    // Count frequency
    const freq = new Map<string, number>();
    words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
    
    // Return top keywords
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get session duration
   */
  private getSessionDuration(context: ConversationContext): string {
    const start = new Date(context.createdAt).getTime();
    const end = new Date(context.lastUpdatedAt).getTime();
    const minutes = Math.floor((end - start) / 60000);
    
    if (minutes < 1) return "Just started";
    if (minutes < 60) return `${minutes} minutes`;
    return `${Math.floor(minutes / 60)} hours ${minutes % 60} minutes`;
  }

  /**
   * Clear context for a session
   */
  clearContext(sessionId: string): void {
    contextStore.delete(sessionId);
  }

  /**
   * Get context stats
   */
  getStats(sessionId: string): {
    turnCount: number;
    totalTokens: number;
    hasSummary: boolean;
    keyTopicsCount: number;
  } {
    const context = this.getContext(sessionId);
    return {
      turnCount: context.turns.length,
      totalTokens: context.totalTokens,
      hasSummary: !!context.summary,
      keyTopicsCount: context.keyTopics.length,
    };
  }
}

export const contextManager = new ContextManagerService();
export default contextManager;
