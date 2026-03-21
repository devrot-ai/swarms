/**
 * Response Mode Configuration
 * 
 * This module defines the different response modes that control how AI agents
 * present their answers - from detailed step-by-step explanations to concise direct answers.
 */

export type ResponseMode = "detailed" | "concise" | "balanced";

export interface ResponseModeConfig {
  id: ResponseMode;
  label: string;
  description: string;
  icon: string;
  includeReasoning: boolean;
  includeAlternatives: boolean;
  includeSteps: boolean;
  maxLength: "short" | "medium" | "long";
}

export const responseModes: Record<ResponseMode, ResponseModeConfig> = {
  detailed: {
    id: "detailed",
    label: "Detailed Analysis",
    description: "Step-by-step explanation with reasoning and alternatives",
    icon: "book",
    includeReasoning: true,
    includeAlternatives: true,
    includeSteps: true,
    maxLength: "long",
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Clear answer with key reasoning points",
    icon: "scale",
    includeReasoning: true,
    includeAlternatives: false,
    includeSteps: false,
    maxLength: "medium",
  },
  concise: {
    id: "concise",
    label: "Concise Answer",
    description: "Direct answer, minimal explanation",
    icon: "zap",
    includeReasoning: false,
    includeAlternatives: false,
    includeSteps: false,
    maxLength: "short",
  },
};

/**
 * Generate system prompt modifier based on response mode
 */
export function getResponseModePrompt(mode: ResponseMode): string {
  const config = responseModes[mode];
  
  const prompts: Record<ResponseMode, string> = {
    detailed: `
RESPONSE FORMAT: DETAILED ANALYSIS MODE

Structure your response with the following sections:

## Understanding the Problem
First, restate the problem in your own words to confirm understanding. Identify key requirements and constraints.

## My Approach
Explain your reasoning step-by-step like a teacher would:
1. Break down your thought process
2. Explain WHY you chose this approach
3. Highlight key decisions and trade-offs

## Solution
Provide the complete solution with:
- Clear organization
- Inline comments explaining key parts
- Best practices highlighted

## Reasoning Behind This Approach
Explain the methodology:
- Why this solution fits the requirements
- What principles or patterns you applied
- What makes this approach effective

## Alternative Strategies
Suggest 2-3 alternative approaches that could work:
1. **Alternative A**: [Description] - Pros: ... Cons: ...
2. **Alternative B**: [Description] - Pros: ... Cons: ...

## Key Takeaways
Summarize the most important learning points for educational value.
`,
    
    balanced: `
RESPONSE FORMAT: BALANCED MODE

Structure your response with:

## Solution
Provide a clear, well-organized solution.

## Key Reasoning
Briefly explain 2-3 key decisions and why they matter:
- What approach you took and why
- Important trade-offs considered

## Quick Summary
One paragraph summarizing the solution and its benefits.
`,
    
    concise: `
RESPONSE FORMAT: CONCISE MODE

Provide a direct, actionable response:
- Lead with the solution or answer
- Minimize explanation - only include what's essential
- Use bullet points for clarity
- Skip alternatives unless critical
- Keep total response under 200 words when possible
`,
  };
  
  return prompts[mode];
}

/**
 * Generate response mode suffix for demo responses
 */
export function getDemoResponseSuffix(mode: ResponseMode): string {
  const config = responseModes[mode];
  
  let suffix = "";
  
  if (config.includeReasoning) {
    suffix += `

---

## Why This Approach?

**Reasoning:** This solution was chosen because it balances practicality with best practices. Here's my thought process:

1. **Problem Analysis**: I identified the core requirements and constraints
2. **Pattern Recognition**: This problem fits a common pattern that has proven solutions
3. **Trade-off Evaluation**: I weighed simplicity vs flexibility, performance vs maintainability
4. **Best Practice Alignment**: The solution follows industry standards and established conventions

**Teaching Moment:** When approaching similar problems, start by breaking them into smaller, manageable parts. This makes complex challenges more tractable.
`;
  }
  
  if (config.includeAlternatives) {
    suffix += `

## Alternative Strategies Considered

**Strategy 1: Simpler Approach**
- *Description*: A more basic implementation with fewer features
- *Pros*: Faster to implement, easier to understand
- *Cons*: Less scalable, may need refactoring later
- *When to use*: Prototyping or small projects

**Strategy 2: More Robust Approach**
- *Description*: Enterprise-grade implementation with extensive error handling
- *Pros*: Production-ready, handles edge cases
- *Cons*: More complex, longer development time
- *When to use*: Critical production systems

**Strategy 3: Modern Approach**
- *Description*: Using cutting-edge tools and patterns
- *Pros*: Best performance, latest features
- *Cons*: Steeper learning curve, newer ecosystem
- *When to use*: New projects without legacy constraints
`;
  }
  
  if (config.includeSteps) {
    suffix += `

## Step-by-Step Breakdown

1. **Step 1 - Setup**: Initialize the project structure and dependencies
2. **Step 2 - Core Logic**: Implement the main functionality 
3. **Step 3 - Integration**: Connect components and handle data flow
4. **Step 4 - Testing**: Verify the solution works correctly
5. **Step 5 - Refinement**: Optimize and polish the implementation

*Each step builds on the previous one, creating a solid foundation for the next.*
`;
  }
  
  return suffix;
}

/**
 * Format response based on mode
 */
export function formatResponseForMode(
  content: string,
  mode: ResponseMode,
  metadata?: {
    agentName?: string;
    intent?: string;
    processingTime?: number;
  }
): string {
  const config = responseModes[mode];
  
  // For concise mode, strip extra sections
  if (mode === "concise") {
    // Remove reasoning sections from response
    let formatted = content
      .replace(/##\s*(Why This Approach|Alternative Strategies|Reasoning|Teaching Moment)[^\n]*\n[\s\S]*?(?=##|$)/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    
    return formatted;
  }
  
  // For detailed mode, add metadata header
  if (mode === "detailed" && metadata) {
    const header = `> **Analysis by ${metadata.agentName || "Agent"}** | Intent: ${metadata.intent || "general"} | Mode: ${config.label}\n\n`;
    return header + content;
  }
  
  return content;
}
