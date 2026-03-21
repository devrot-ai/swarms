/**
 * Response Mode Configuration
 * 
 * This module defines the different response modes that control how AI agents
 * present their answers - from detailed step-by-step explanations to concise direct answers.
 * 
 * Features:
 * - Teacher-style explanations with reasoning
 * - Alternative strategy suggestions
 * - Dynamic adaptation based on user preference
 * - Learning-focused educational insights
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
  includeTeachingMoments: boolean;
  maxLength: "short" | "medium" | "long";
  contextWindowMultiplier: number; // How much extra context to include
}

export const responseModes: Record<ResponseMode, ResponseModeConfig> = {
  detailed: {
    id: "detailed",
    label: "Detailed Analysis",
    description: "Step-by-step explanation with reasoning, alternatives, and teaching moments",
    icon: "book-open",
    includeReasoning: true,
    includeAlternatives: true,
    includeSteps: true,
    includeTeachingMoments: true,
    maxLength: "long",
    contextWindowMultiplier: 1.5,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Clear answer with key reasoning points",
    icon: "scale",
    includeReasoning: true,
    includeAlternatives: false,
    includeSteps: false,
    includeTeachingMoments: false,
    maxLength: "medium",
    contextWindowMultiplier: 1.0,
  },
  concise: {
    id: "concise",
    label: "Concise Answer",
    description: "Direct answer, minimal explanation",
    icon: "zap",
    includeReasoning: false,
    includeAlternatives: false,
    includeSteps: false,
    includeTeachingMoments: false,
    maxLength: "short",
    contextWindowMultiplier: 0.5,
  },
};

/**
 * Generate system prompt modifier based on response mode
 */
export function getResponseModePrompt(mode: ResponseMode): string {
  const config = responseModes[mode];
  
  const prompts: Record<ResponseMode, string> = {
    detailed: `
RESPONSE FORMAT: DETAILED ANALYSIS MODE (Teacher-Style)

You are explaining your solution like an experienced mentor teaching a student. Structure your response to maximize learning and understanding.

## 1. Understanding the Problem
First, restate the problem in your own words to confirm understanding:
- What is being asked?
- What are the constraints?
- What would a successful solution look like?

## 2. My Thought Process (Reasoning)
Walk through your reasoning step-by-step, as if thinking out loud:
1. "First, I considered..."
2. "This led me to think about..."
3. "I weighed the trade-offs between..."
4. "Ultimately, I decided on this approach because..."

## 3. The Solution
Provide the complete solution with:
- Clear organization and structure
- Inline comments explaining WHY, not just WHAT
- Best practices highlighted with explanations
- Common pitfalls to avoid

## 4. Why This Approach? (Teaching Moment)
Explain the methodology like a teacher:
- What principles or patterns did you apply?
- Why is this approach effective for this type of problem?
- What makes this solution maintainable/scalable/robust?
- What would you tell a junior developer to watch out for?

## 5. Alternative Strategies
Present 2-3 alternative approaches with honest analysis:

**Alternative A: [Name]**
- Approach: [Brief description]
- When to use: [Best scenarios]
- Pros: [Advantages]
- Cons: [Disadvantages]
- Why I didn't choose this: [Reasoning]

**Alternative B: [Name]**
- Approach: [Brief description]
- When to use: [Best scenarios]  
- Pros: [Advantages]
- Cons: [Disadvantages]
- Why I didn't choose this: [Reasoning]

## 6. Key Takeaways
Summarize the most important learning points:
1. [Most critical insight]
2. [Second key learning]
3. [Third important point]
4. [Pattern or principle to remember]

## 7. Further Learning (Optional)
If relevant, suggest:
- Related concepts to explore
- Common variations of this problem
- Advanced techniques for future consideration
`,
    
    balanced: `
RESPONSE FORMAT: BALANCED MODE

Provide a clear, well-organized response that includes key reasoning without excessive detail.

## Solution
Deliver the solution directly, organized clearly with:
- Main implementation or answer
- Key code/steps highlighted
- Brief inline comments for important parts

## Key Reasoning
Explain 2-3 key decisions in 1-2 sentences each:
- Why you chose this approach
- Important trade-offs considered
- Any critical considerations

## Quick Summary
One paragraph summarizing:
- What the solution does
- Why this approach works well
- Any important caveats or next steps
`,
    
    concise: `
RESPONSE FORMAT: CONCISE MODE

Provide a direct, actionable response optimized for efficiency:

- Lead with the solution or answer immediately
- Use bullet points and code blocks
- Include only essential explanation
- Skip background, alternatives, and extended reasoning
- Target response length: under 200 words when possible
- If code is required, provide clean, minimal implementation
- One-line summary at the end if helpful
`,
  };
  
  return prompts[mode];
}

/**
 * Generate teaching-style explanation for a concept
 */
export function generateTeachingExplanation(
  concept: string,
  context: string,
  difficulty: "beginner" | "intermediate" | "advanced" = "intermediate"
): string {
  const levelAdjustments = {
    beginner: "Explain this as if to someone new to programming. Use simple analogies and avoid jargon.",
    intermediate: "Assume familiarity with basic concepts. Focus on practical application and best practices.",
    advanced: "Assume deep technical knowledge. Focus on nuances, edge cases, and optimization.",
  };

  return `
When explaining "${concept}" in the context of "${context}":

${levelAdjustments[difficulty]}

Structure your explanation:
1. **The Core Idea**: What is this and why does it matter?
2. **How It Works**: Step-by-step breakdown
3. **Real Example**: Concrete application
4. **Common Mistakes**: What to avoid
5. **Pro Tip**: Expert insight
`;
}

/**
 * Generate alternative strategy analysis
 */
export function generateAlternativesAnalysis(
  primaryApproach: string,
  problemType: string
): string {
  return `
For this ${problemType} problem, I chose ${primaryApproach}. Here are alternatives I considered:

**Alternative 1: Simpler Approach**
- Trade-off: Less complexity vs fewer features
- Best when: Prototyping or tight deadlines
- Risk: May need refactoring later

**Alternative 2: More Robust Approach**  
- Trade-off: More upfront work vs long-term stability
- Best when: Production systems or critical paths
- Risk: Over-engineering for simple cases

**Alternative 3: Modern/Experimental Approach**
- Trade-off: Latest features vs ecosystem maturity
- Best when: Greenfield projects with flexibility
- Risk: Less community support or documentation

**Why I Chose ${primaryApproach}:**
[Specific reasoning based on the problem context]
`;
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

## My Reasoning (Why This Approach?)

**How I approached this problem:**

1. **Problem Analysis**: I first broke down the request to understand the core requirements and constraints. This helps ensure the solution addresses what's actually needed, not just what seems obvious.

2. **Pattern Recognition**: This type of problem follows a common pattern I've seen before. Recognizing these patterns helps apply proven solutions rather than reinventing the wheel.

3. **Trade-off Evaluation**: I considered multiple factors:
   - *Simplicity vs Flexibility*: Chose a balanced approach that's easy to understand but can be extended
   - *Performance vs Maintainability*: Prioritized code clarity while keeping performance reasonable
   - *Short-term vs Long-term*: Built for current needs while leaving room for growth

4. **Best Practice Alignment**: The solution follows established conventions and standards, making it easier for others to understand and maintain.

**Teaching Moment:** When approaching similar problems, always start by clearly defining what success looks like. This prevents scope creep and keeps you focused on delivering value.
`;
  }
  
  if (config.includeAlternatives) {
    suffix += `

## Alternative Strategies Considered

I evaluated several approaches before settling on this solution:

**Strategy 1: Minimal Viable Approach**
- *What it is*: The simplest possible implementation that meets basic requirements
- *Pros*: Fast to implement, easy to understand, low risk
- *Cons*: May need significant rework as requirements evolve
- *When to use*: Prototyping, proof-of-concept, or when requirements are uncertain
- *Why I didn't use it here*: The problem warranted a more complete solution

**Strategy 2: Enterprise-Grade Approach**
- *What it is*: Full-featured implementation with extensive error handling, logging, and configuration
- *Pros*: Production-ready, handles edge cases, highly maintainable
- *Cons*: More complex, longer to implement, may be overkill for simple cases
- *When to use*: Mission-critical systems, large teams, long-term projects
- *Why I didn't use it here*: Would add unnecessary complexity for this use case

**Strategy 3: Framework-Heavy Approach**
- *What it is*: Leveraging existing libraries and frameworks extensively
- *Pros*: Faster development, battle-tested code, community support
- *Cons*: Dependencies, potential bloat, learning curve
- *When to use*: Standard use cases where frameworks excel
- *Why I didn't use it here*: Custom solution better fits the specific requirements
`;
  }
  
  if (config.includeSteps) {
    suffix += `

## Step-by-Step Breakdown

Here's how I built this solution, broken into clear phases:

**Phase 1: Setup & Foundation**
- Established the basic structure
- Set up necessary dependencies
- Created the skeleton for the main components
- *Key decision*: Started with the data model to ensure a solid foundation

**Phase 2: Core Implementation**
- Built the main functionality piece by piece
- Added validation and error handling
- Connected components together
- *Key decision*: Prioritized the critical path first

**Phase 3: Integration & Polish**
- Connected all parts into a working whole
- Added finishing touches and edge case handling
- Verified everything works together
- *Key decision*: Tested early and often to catch issues

**Phase 4: Review & Refinement**
- Reviewed for best practices
- Optimized where beneficial
- Added documentation and comments
- *Key decision*: Focused on clarity over cleverness
`;
  }

  if (config.includeTeachingMoments) {
    suffix += `

## Learning Points

**Key Takeaways from this solution:**

1. **Start with the end in mind**: Before writing any code, I clearly defined what success looks like. This keeps you focused and prevents scope creep.

2. **Break complex problems into smaller pieces**: Instead of tackling everything at once, I divided the problem into manageable chunks. Each piece is easier to understand, test, and debug.

3. **Consider the reader**: Code is read more often than it's written. I prioritized clarity and added comments explaining *why*, not just *what*.

4. **Think about edge cases early**: Anticipating what could go wrong helps build more robust solutions. I considered failure modes from the start.

5. **Balance pragmatism with perfectionism**: A working solution today is often better than a perfect solution next month. Ship, then iterate.

**Further Exploration:**
- Look into related patterns that solve similar problems
- Consider how this approach scales with increased complexity
- Explore how different frameworks handle this type of challenge
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
    let formatted = content
      .replace(/##\s*(Why This Approach|Alternative Strategies|Reasoning|Teaching Moment|My Reasoning|Learning Points|Key Takeaways|Further|Step-by-Step)[^\n]*\n[\s\S]*?(?=##|$)/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    
    return formatted;
  }
  
  // For detailed mode, add metadata header
  if (mode === "detailed" && metadata) {
    const header = `> **Analysis by ${metadata.agentName || "Agent"}** | Mode: ${config.label}\n> Intent: ${metadata.intent || "general"} | Processing time: ${metadata.processingTime || "N/A"}ms\n\n`;
    return header + content;
  }
  
  return content;
}

/**
 * Get context window size multiplier for mode
 */
export function getContextMultiplier(mode: ResponseMode): number {
  return responseModes[mode].contextWindowMultiplier;
}

/**
 * Check if mode should include a specific feature
 */
export function shouldInclude(mode: ResponseMode, feature: keyof ResponseModeConfig): boolean {
  const config = responseModes[mode];
  const value = config[feature];
  return typeof value === "boolean" ? value : false;
}
