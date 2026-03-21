/**
 * Demo Mode - Simulated AI Responses
 * 
 * Provides intelligent simulated responses when no AI providers are available.
 * This allows the system to demonstrate functionality without requiring API keys.
 */

import { type AgentId, agentMetadata } from "../agents/index";

export interface DemoResponse {
  content: string;
  thinkingSteps: string[];
  toolsUsed: string[];
  delegatedTo: string[];
}

// ============================================================
// DEMO RESPONSE TEMPLATES
// ============================================================

const demoResponses: Record<string, DemoResponse> = {
  // Strategic Planning
  "strategic_planning": {
    content: `# Strategic Analysis Complete

Based on my analysis, here's the strategic plan:

## Executive Summary
I've evaluated the request and developed a comprehensive strategy that aligns with our company's vision and market opportunities.

## Key Strategic Initiatives

### 1. Market Positioning
- Identify target market segments
- Define unique value proposition
- Establish competitive differentiation

### 2. Growth Strategy
- Phase 1: Foundation (Months 1-3)
- Phase 2: Expansion (Months 4-6)
- Phase 3: Scale (Months 7-12)

### 3. Resource Allocation
- Prioritize high-impact initiatives
- Optimize budget distribution
- Build key capabilities

## Next Steps
I'm delegating the operational planning to the COO for task breakdown and timeline creation.

**Status:** Strategy framework established. Ready for operational execution.`,
    thinkingSteps: [
      "Analyzing market conditions and competitive landscape",
      "Identifying key growth opportunities",
      "Evaluating resource requirements",
      "Formulating strategic recommendations",
    ],
    toolsUsed: ["market_research", "competitor_analysis", "data_analysis"],
    delegatedTo: ["COO", "CTO"],
  },

  // Technical Build
  "technical_build": {
    content: `# Technical Implementation Plan

I've designed the technical architecture for this request.

## System Design

### Architecture Overview
\`\`\`
┌─────────────────────────────────────────┐
│           Frontend Layer                 │
│   (React/Next.js, TypeScript)           │
├─────────────────────────────────────────┤
│           API Layer                      │
│   (REST/GraphQL, Authentication)        │
├─────────────────────────────────────────┤
│           Business Logic                 │
│   (Services, Validation)                │
├─────────────────────────────────────────┤
│           Data Layer                     │
│   (PostgreSQL, Redis Cache)             │
└─────────────────────────────────────────┘
\`\`\`

### Key Components
1. **API Endpoints** - RESTful services with proper error handling
2. **Authentication** - JWT-based with refresh tokens
3. **Database Schema** - Normalized design with proper indexing
4. **Caching Strategy** - Redis for session and frequent queries

### Security Considerations
- Input validation on all endpoints
- Rate limiting implemented
- SQL injection prevention
- XSS protection

## Implementation Status
Code structure prepared. Delegating to Worker agent for implementation.

**Estimated completion:** 2-3 development cycles`,
    thinkingSteps: [
      "Analyzing requirements and constraints",
      "Designing system architecture",
      "Planning database schema",
      "Defining API contracts",
      "Security review",
    ],
    toolsUsed: ["architecture_design", "code_generation", "security_review"],
    delegatedTo: ["Worker", "QA"],
  },

  // Research
  "research": {
    content: `# Research Report

## Executive Summary
I've conducted comprehensive research on the requested topic.

## Key Findings

### Market Overview
- Current market size: Growing rapidly
- Key players: Multiple established and emerging competitors
- Trends: AI integration, automation, personalization

### Competitive Analysis
| Competitor | Strengths | Weaknesses |
|------------|-----------|------------|
| Company A | Market leader, strong brand | Slow innovation |
| Company B | Technical excellence | Limited market reach |
| Company C | Competitive pricing | Quality concerns |

### Opportunities
1. Underserved market segments identified
2. Technology gaps in current solutions
3. Partnership possibilities

### Recommendations
- Focus on differentiation through AI capabilities
- Target enterprise market initially
- Build strong integrations ecosystem

## Data Sources
Research conducted using web search, market analysis tools, and industry reports.

**Confidence Level:** High (based on multiple data sources)`,
    thinkingSteps: [
      "Defining research scope",
      "Gathering market data",
      "Analyzing competitor landscape",
      "Synthesizing findings",
      "Formulating recommendations",
    ],
    toolsUsed: ["web_search", "data_analysis", "market_research"],
    delegatedTo: ["Marketing", "CEO"],
  },

  // Marketing
  "marketing": {
    content: `# Marketing Campaign Plan

## Campaign Overview
I've developed a comprehensive marketing strategy for your request.

## Campaign Components

### 1. Content Strategy
- Blog posts highlighting key features
- Video demonstrations
- Case studies and testimonials
- Social media content calendar

### 2. Channel Strategy
| Channel | Approach | Expected ROI |
|---------|----------|--------------|
| LinkedIn | B2B thought leadership | High |
| Twitter/X | Community engagement | Medium |
| Email | Nurture sequences | High |
| Paid Ads | Targeted campaigns | Medium |

### 3. Messaging Framework
- **Headline:** Transform your workflow with AI
- **Value Prop:** Save 10+ hours per week
- **CTA:** Start your free trial today

### 4. Timeline
- Week 1-2: Content creation
- Week 3-4: Launch campaign
- Week 5+: Optimize based on metrics

## Budget Allocation
Recommended allocation across channels with focus on highest ROI activities.

**Ready for execution:** Pending final approval`,
    thinkingSteps: [
      "Analyzing target audience",
      "Defining campaign objectives",
      "Creating content strategy",
      "Planning channel distribution",
      "Setting success metrics",
    ],
    toolsUsed: ["content_generation", "campaign_planning", "budget_planning"],
    delegatedTo: ["Design", "Worker"],
  },

  // Code Review / Security
  "technical_review": {
    content: `# Security & Code Review Report

## Review Summary
I've completed a comprehensive review of the codebase.

## Security Assessment

### Critical Findings
None identified in current review scope.

### High Priority Items
1. **Input Validation** - Some endpoints need enhanced validation
2. **Error Handling** - Improve error messages (avoid leaking stack traces)
3. **Authentication** - Consider adding 2FA for admin routes

### Medium Priority Items
- Add rate limiting on public APIs
- Implement request logging for audit trail
- Review third-party dependencies for vulnerabilities

## Code Quality

### Strengths
- Good component structure
- TypeScript properly typed
- Consistent coding style

### Improvements Suggested
- Add more unit tests (current coverage ~40%)
- Document complex business logic
- Refactor large components into smaller ones

## Recommendations
1. Address high priority security items first
2. Implement automated security scanning in CI/CD
3. Schedule regular dependency updates

**Overall Risk Level:** Low to Medium`,
    thinkingSteps: [
      "Scanning codebase structure",
      "Analyzing security patterns",
      "Reviewing authentication flow",
      "Checking for common vulnerabilities",
      "Evaluating code quality",
    ],
    toolsUsed: ["code_review", "security_audit", "static_analysis"],
    delegatedTo: ["DevOps", "Worker"],
  },

  // Financial
  "financial": {
    content: `# Financial Analysis Report

## Overview
I've completed the financial analysis as requested.

## Budget Analysis

### Current Budget Allocation
| Category | Allocation | Utilization |
|----------|------------|-------------|
| Engineering | 40% | 85% |
| Marketing | 25% | 70% |
| Operations | 20% | 90% |
| R&D | 15% | 60% |

### ROI Projections
- **Short-term (3 months):** 15-20% return expected
- **Medium-term (6 months):** 40-50% return projected
- **Long-term (12 months):** 100%+ return potential

## Cost Optimization Opportunities
1. Consolidate cloud infrastructure (-15% costs)
2. Automate repetitive tasks (-20% operational costs)
3. Optimize marketing spend (+25% efficiency)

## Recommendations
- Reallocate 5% from Operations to R&D
- Invest in automation tooling
- Review vendor contracts for savings

**Financial Health:** Strong`,
    thinkingSteps: [
      "Analyzing current budget",
      "Calculating ROI projections",
      "Identifying cost optimizations",
      "Evaluating investment opportunities",
      "Preparing recommendations",
    ],
    toolsUsed: ["budget_analysis", "roi_calculator", "data_analysis"],
    delegatedTo: ["CEO", "COO"],
  },

  // General / Default
  "general": {
    content: `# Task Analysis Complete

I've processed your request and here's my analysis:

## Summary
I've reviewed the request and identified the key areas that need attention.

## Approach
1. **Understanding:** Parsed the request and identified key objectives
2. **Analysis:** Evaluated different approaches
3. **Planning:** Created an action plan
4. **Execution:** Ready to proceed with implementation

## Key Points
- Request has been understood and categorized
- Relevant team members identified
- Initial planning complete

## Next Steps
The appropriate department agents will now handle the specific aspects of this request. You'll receive updates as we progress.

**Status:** Processing initiated`,
    thinkingSteps: [
      "Parsing request",
      "Classifying intent",
      "Identifying stakeholders",
      "Creating action plan",
    ],
    toolsUsed: ["task_planning", "delegation"],
    delegatedTo: [],
  },
};

// ============================================================
// DEMO MODE EXECUTOR
// ============================================================

export class DemoModeExecutor {
  private streamDelay = 20; // ms per character for realistic streaming

  /**
   * Check if demo mode should be used
   */
  shouldUseDemoMode(): boolean {
    // Demo mode is enabled when explicitly set OR when no providers are available
    return process.env.DEMO_MODE === "true" || process.env.ENABLE_DEMO_MODE === "true";
  }

  /**
   * Get demo response for an intent
   */
  getDemoResponse(intent: string): DemoResponse {
    return demoResponses[intent] ?? demoResponses.general;
  }

  /**
   * Execute in demo mode with simulated streaming
   */
  async *streamDemoResponse(
    agentId: AgentId,
    intent: string,
    userMessage: string
  ): AsyncGenerator<{ type: string; data: unknown }> {
    const meta = agentMetadata[agentId];
    const response = this.getDemoResponse(intent);

    // Emit start
    yield {
      type: "start",
      data: {
        agent: agentId,
        agentName: meta.name,
        department: meta.department,
        model: "demo-mode",
        provider: "demo",
      },
    };

    // Emit thinking steps
    for (const step of response.thinkingSteps) {
      yield {
        type: "thinking",
        data: { step, agent: agentId },
      };
      await this.sleep(300); // Simulate thinking time
    }

    // Emit tool usage
    for (const tool of response.toolsUsed) {
      yield {
        type: "tool_call",
        data: { tool, status: "executing" },
      };
      await this.sleep(200);
      yield {
        type: "tool_result",
        data: { tool, status: "completed" },
      };
    }

    // Personalize the response with context
    const personalizedContent = this.personalizeResponse(
      response.content,
      userMessage,
      meta.name
    );

    // Stream the content token by token
    for (const char of personalizedContent) {
      yield {
        type: "token",
        data: { token: char },
      };
      await this.sleep(this.streamDelay);
    }

    // Emit completion
    yield {
      type: "complete",
      data: {
        agent: agentId,
        agentName: meta.name,
        department: meta.department,
        model: "demo-mode",
        tokensUsed: personalizedContent.length,
        delegatedTo: response.delegatedTo,
      },
    };
  }

  /**
   * Execute demo mode synchronously (for fallback)
   */
  async executeDemoResponse(
    agentId: AgentId,
    intent: string,
    userMessage: string,
    responseMode: "detailed" | "concise" | "balanced" = "balanced"
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    tokensUsed: number;
  }> {
    const meta = agentMetadata[agentId];
    const response = this.getDemoResponse(intent);
    let content = response.content;
    
    // Apply response mode formatting
    if (responseMode === "detailed") {
      content = this.formatDetailedResponse(content, response, meta.name, intent);
    } else if (responseMode === "concise") {
      content = this.formatConciseResponse(content);
    }
    
    const personalizedContent = this.personalizeResponse(
      content,
      userMessage,
      meta.name
    );

    // Simulate some processing time
    await this.sleep(500);

    return {
      content: personalizedContent,
      model: "demo-mode",
      provider: "demo",
      tokensUsed: personalizedContent.length,
    };
  }
  
  /**
   * Format response for detailed mode with reasoning and alternatives
   */
  private formatDetailedResponse(
    content: string,
    response: DemoResponse,
    agentName: string,
    intent: string
  ): string {
    let detailed = content;
    
    // Add thinking steps if available
    if (response.thinkingSteps.length > 0) {
      detailed += `\n\n---\n\n## My Approach & Reasoning\n\n`;
      detailed += `**Thought Process:**\n`;
      response.thinkingSteps.forEach((step, i) => {
        detailed += `${i + 1}. ${step}\n`;
      });
      detailed += `\n**Why this approach?** This methodology was chosen because it provides a systematic way to address the request while considering best practices and potential edge cases.`;
    }
    
    // Add tools used
    if (response.toolsUsed.length > 0) {
      detailed += `\n\n## Tools & Resources Used\n\n`;
      response.toolsUsed.forEach(tool => {
        detailed += `- **${tool.replace(/_/g, ' ')}**: Applied to gather information and validate approach\n`;
      });
    }
    
    // Add alternative strategies
    detailed += `\n\n## Alternative Strategies Considered\n\n`;
    detailed += `**Alternative 1: Incremental Approach**\n`;
    detailed += `- *Description*: Start with a minimal viable solution and iterate\n`;
    detailed += `- *Pros*: Faster initial delivery, early feedback\n`;
    detailed += `- *Cons*: May require significant refactoring later\n\n`;
    
    detailed += `**Alternative 2: Comprehensive Approach**\n`;
    detailed += `- *Description*: Build a complete solution from the start\n`;
    detailed += `- *Pros*: More robust, handles edge cases early\n`;
    detailed += `- *Cons*: Longer initial development time\n\n`;
    
    // Add educational takeaway
    detailed += `## Key Takeaways\n\n`;
    detailed += `1. Always consider the trade-offs between speed and completeness\n`;
    detailed += `2. Break complex problems into manageable components\n`;
    detailed += `3. Document decisions for future reference\n`;
    detailed += `4. Plan for scalability from the beginning\n`;
    
    return detailed;
  }
  
  /**
   * Format response for concise mode
   */
  private formatConciseResponse(content: string): string {
    // Remove detailed sections, keep only essential content
    let concise = content
      .split('##').slice(0, 3).join('##') // Keep first 2-3 sections
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Limit length
    if (concise.length > 1500) {
      concise = concise.substring(0, 1500) + '\n\n*[Response truncated for brevity]*';
    }
    
    return concise;
  }

  /**
   * Personalize the response with context
   */
  private personalizeResponse(
    content: string,
    userMessage: string,
    agentName: string
  ): string {
    // Add context header with the user's request
    const header = `> Processing request from ${agentName}: "${userMessage.slice(0, 100)}${userMessage.length > 100 ? "..." : ""}"\n\n`;

    return header + content;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const demoExecutor = new DemoModeExecutor();
export default demoExecutor;
