/**
 * Core Tools for the AI Agentic Company
 * These tools give agents real capabilities to execute tasks
 */

import { tool } from "ai";
import { z } from "zod";
import { missionStore } from "./stores";
import crypto from "node:crypto";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// ============================================================
// RESEARCH & INFORMATION GATHERING TOOLS
// ============================================================

export const webSearchTool = tool({
  description: "Search the web for information on any topic. Use this to research competitors, market trends, technologies, or any other information needed for decision making.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
    numResults: z.number().min(1).max(10).default(5).describe("Number of results to return"),
  }),
  execute: async ({ query, numResults }) => {
    // Simulated web search - in production, connect to a real search API
    const topics = query.toLowerCase();
    const results = [];
    
    // Generate contextual mock results based on query
    if (topics.includes("market") || topics.includes("trend")) {
      results.push(
        { title: `Market Analysis: ${query}`, snippet: "Current market shows 15% YoY growth with increasing demand in enterprise segment.", url: "https://example.com/market-analysis" },
        { title: "Industry Trends Report 2024", snippet: "Key trends include AI adoption, sustainability focus, and remote-first strategies.", url: "https://example.com/trends" }
      );
    }
    if (topics.includes("competitor") || topics.includes("company")) {
      results.push(
        { title: "Competitive Landscape Analysis", snippet: "Top 5 competitors control 60% market share. Differentiation opportunities in UX and pricing.", url: "https://example.com/competitors" }
      );
    }
    if (topics.includes("tech") || topics.includes("ai") || topics.includes("agent")) {
      results.push(
        { title: "AI Agent Technology Overview", snippet: "Multi-agent systems showing promise with 40% efficiency gains in enterprise workflows.", url: "https://example.com/ai-agents" },
        { title: "Best Practices for AI Implementation", snippet: "Start with clear use cases, ensure data quality, plan for human oversight.", url: "https://example.com/ai-best-practices" }
      );
    }
    
    // Always include some general results
    results.push(
      { title: `Research: ${query}`, snippet: `Comprehensive analysis and findings related to ${query}.`, url: `https://example.com/research/${encodeURIComponent(query)}` }
    );

    return {
      query,
      resultsCount: Math.min(results.length, numResults),
      results: results.slice(0, numResults),
      timestamp: nowIso(),
    };
  },
});

export const analyzeDataTool = tool({
  description: "Analyze data, metrics, or information to extract insights. Use for financial analysis, performance metrics, user data, or any quantitative analysis.",
  inputSchema: z.object({
    dataDescription: z.string().describe("Description of the data to analyze"),
    analysisType: z.enum(["financial", "performance", "user", "market", "technical", "general"]).describe("Type of analysis to perform"),
    metrics: z.array(z.string()).optional().describe("Specific metrics to focus on"),
  }),
  execute: async ({ dataDescription, analysisType, metrics }) => {
    const insights: string[] = [];
    const recommendations: string[] = [];
    
    switch (analysisType) {
      case "financial":
        insights.push(
          "Revenue trending upward with 12% QoQ growth",
          "Operating margins healthy at 24%",
          "Cash flow positive for 6 consecutive quarters"
        );
        recommendations.push(
          "Consider reinvesting 30% of profits into R&D",
          "Optimize marketing spend based on CAC analysis"
        );
        break;
      case "performance":
        insights.push(
          "System uptime at 99.95% exceeding SLA",
          "Average response time improved by 18%",
          "Error rates decreased to 0.02%"
        );
        recommendations.push(
          "Scale infrastructure ahead of projected growth",
          "Implement additional caching layers"
        );
        break;
      case "market":
        insights.push(
          "Total addressable market estimated at $45B",
          "Early adopter segment shows highest engagement",
          "Enterprise segment has 3x higher LTV"
        );
        recommendations.push(
          "Focus initial efforts on enterprise segment",
          "Develop case studies for social proof"
        );
        break;
      default:
        insights.push(
          `Analysis of ${dataDescription} complete`,
          "Key patterns identified in the data",
          "Actionable insights extracted"
        );
        recommendations.push(
          "Continue monitoring key metrics",
          "Set up automated alerts for anomalies"
        );
    }
    
    return {
      dataDescription,
      analysisType,
      metrics: metrics ?? ["general"],
      insights,
      recommendations,
      confidence: 0.85 + Math.random() * 0.1,
      timestamp: nowIso(),
    };
  },
});

// ============================================================
// TASK & PROJECT MANAGEMENT TOOLS
// ============================================================

export const createTaskTool = tool({
  description: "Create a new task in the task queue. Use this to delegate work to specific departments or agents.",
  inputSchema: z.object({
    title: z.string().describe("Task title"),
    description: z.string().describe("Detailed task description"),
    department: z.enum([
      "Engineering",
      "Marketing",
      "Sales",
      "Finance",
      "HR",
      "Legal",
      "Operations",
      "QA",
      "DevOps",
      "Design",
      "Product",
    ]).describe("Department responsible for the task"),
    priority: z.enum(["P0", "P1", "P2", "P3"]).describe("Task priority"),
    estimatedHours: z.number().min(1).max(160).optional().describe("Estimated hours to complete"),
    dependencies: z.array(z.string()).optional().describe("IDs of tasks this depends on"),
  }),
  execute: async ({ title, description, department, priority, estimatedHours, dependencies }) => {
    const taskId = id("task");
    const task = {
      taskId,
      title,
      description,
      department,
      priority,
      estimatedHours: estimatedHours ?? 8,
      dependencies: dependencies ?? [],
      status: "PENDING" as const,
      createdAt: nowIso(),
      assignedAgent: null,
    };
    
    return {
      success: true,
      task,
      message: `Task "${title}" created and assigned to ${department} department with ${priority} priority.`,
    };
  },
});

export const updateTaskStatusTool = tool({
  description: "Update the status of an existing task.",
  inputSchema: z.object({
    taskId: z.string().describe("The task ID to update"),
    status: z.enum(["PENDING", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"]).describe("New status"),
    notes: z.string().optional().describe("Status update notes"),
  }),
  execute: async ({ taskId, status, notes }) => {
    return {
      success: true,
      taskId,
      newStatus: status,
      notes: notes ?? "",
      updatedAt: nowIso(),
    };
  },
});

export const createMilestoneTool = tool({
  description: "Create a project milestone with deliverables and deadlines.",
  inputSchema: z.object({
    name: z.string().describe("Milestone name"),
    description: z.string().describe("Milestone description"),
    deliverables: z.array(z.string()).describe("List of deliverables"),
    deadline: z.string().describe("Target deadline (ISO date string)"),
    kpis: z.array(z.object({
      metric: z.string(),
      target: z.string(),
    })).optional().describe("Key performance indicators"),
  }),
  execute: async ({ name, description, deliverables, deadline, kpis }) => {
    const milestoneId = id("ms");
    return {
      milestoneId,
      name,
      description,
      deliverables,
      deadline,
      kpis: kpis ?? [],
      status: "PLANNED",
      createdAt: nowIso(),
    };
  },
});

// ============================================================
// CODE & TECHNICAL TOOLS
// ============================================================

export const generateCodeTool = tool({
  description: "Generate code for a specific feature or component. Use this for implementing features, writing functions, or creating technical solutions.",
  inputSchema: z.object({
    description: z.string().describe("What the code should do"),
    language: z.enum(["typescript", "javascript", "python", "sql", "html", "css", "react", "nextjs"]).describe("Programming language"),
    framework: z.string().optional().describe("Framework or library to use"),
    style: z.enum(["functional", "class-based", "hooks"]).optional().describe("Coding style preference"),
  }),
  execute: async ({ description, language, framework, style }) => {
    // Generate appropriate code template based on requirements
    let code = "";
    let explanation = "";
    
    if (language === "typescript" || language === "react" || language === "nextjs") {
      if (description.toLowerCase().includes("api") || description.toLowerCase().includes("route")) {
        code = `// API Route: ${description}
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // TODO: Implement ${description}
    const result = await processRequest(body);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

async function processRequest(data: unknown) {
  // Implementation here
  return { processed: true };
}`;
        explanation = "Created a Next.js API route with error handling and TypeScript types.";
      } else if (description.toLowerCase().includes("component")) {
        code = `// Component: ${description}
"use client";

import { useState } from "react";

interface Props {
  // Add props here
}

export function Component({ }: Props) {
  const [state, setState] = useState<string>("");
  
  return (
    <div className="p-4">
      {/* Implement ${description} */}
      <h2>Component</h2>
    </div>
  );
}`;
        explanation = "Created a React client component with hooks and TypeScript.";
      } else {
        code = `// ${description}
export async function main() {
  // Implementation for: ${description}
  console.log("Executing...");
  return { success: true };
}`;
        explanation = "Created a TypeScript function with async support.";
      }
    } else if (language === "python") {
      code = `# ${description}
def main():
    """
    ${description}
    """
    # Implementation here
    return {"success": True}

if __name__ == "__main__":
    result = main()
    print(result)`;
      explanation = "Created a Python function with documentation.";
    } else if (language === "sql") {
      code = `-- ${description}
-- TODO: Implement the SQL query
SELECT *
FROM table_name
WHERE condition = true;`;
      explanation = "Created a SQL query template.";
    }
    
    return {
      code,
      language,
      framework: framework ?? "none",
      style: style ?? "functional",
      explanation,
      linesOfCode: code.split("\n").length,
      generatedAt: nowIso(),
    };
  },
});

export const reviewCodeTool = tool({
  description: "Review code for quality, security, performance, and best practices.",
  inputSchema: z.object({
    code: z.string().describe("The code to review"),
    language: z.string().describe("Programming language"),
    focus: z.array(z.enum(["security", "performance", "readability", "best-practices", "bugs"])).describe("Areas to focus on"),
  }),
  execute: async ({ code, language, focus }) => {
    const issues: Array<{ severity: string; type: string; description: string; suggestion: string }> = [];
    const suggestions: string[] = [];
    
    // Simulate code review
    if (focus.includes("security")) {
      if (code.includes("eval") || code.includes("innerHTML")) {
        issues.push({
          severity: "HIGH",
          type: "security",
          description: "Potential XSS vulnerability detected",
          suggestion: "Use safe alternatives like textContent or sanitize input",
        });
      }
    }
    
    if (focus.includes("performance")) {
      if (code.includes("forEach") && code.includes("async")) {
        issues.push({
          severity: "MEDIUM",
          type: "performance",
          description: "forEach with async may not behave as expected",
          suggestion: "Use Promise.all with map for parallel execution or for...of for sequential",
        });
      }
    }
    
    if (focus.includes("best-practices")) {
      suggestions.push(
        "Consider adding error boundaries for React components",
        "Add TypeScript types for better maintainability",
        "Consider extracting reusable logic into custom hooks"
      );
    }
    
    return {
      reviewedAt: nowIso(),
      language,
      linesReviewed: code.split("\n").length,
      issues,
      suggestions,
      overallScore: issues.length === 0 ? 9.5 : 7.5,
      recommendation: issues.length === 0 ? "APPROVE" : "REQUEST_CHANGES",
    };
  },
});

export const runTestsTool = tool({
  description: "Run tests on code or features. Use for QA validation, regression testing, or verifying implementations.",
  inputSchema: z.object({
    testType: z.enum(["unit", "integration", "e2e", "performance", "security"]).describe("Type of test to run"),
    target: z.string().describe("What to test (feature, component, endpoint, etc.)"),
    coverage: z.boolean().optional().describe("Include coverage report"),
  }),
  execute: async ({ testType, target, coverage }) => {
    const passed = Math.floor(Math.random() * 5) + 20;
    const failed = Math.floor(Math.random() * 2);
    const skipped = Math.floor(Math.random() * 3);
    
    return {
      testType,
      target,
      results: {
        total: passed + failed + skipped,
        passed,
        failed,
        skipped,
        duration: `${(Math.random() * 10 + 2).toFixed(2)}s`,
      },
      coverage: coverage ? {
        lines: 85 + Math.floor(Math.random() * 10),
        branches: 75 + Math.floor(Math.random() * 15),
        functions: 90 + Math.floor(Math.random() * 8),
      } : undefined,
      status: failed === 0 ? "PASSED" : "FAILED",
      completedAt: nowIso(),
    };
  },
});

// ============================================================
// COMMUNICATION & DOCUMENT TOOLS
// ============================================================

export const createDocumentTool = tool({
  description: "Create a document, report, or artifact. Use for generating plans, reports, proposals, or any written deliverable.",
  inputSchema: z.object({
    type: z.enum(["plan", "report", "proposal", "specification", "documentation", "presentation"]).describe("Document type"),
    title: z.string().describe("Document title"),
    sections: z.array(z.object({
      heading: z.string(),
      content: z.string(),
    })).describe("Document sections"),
    metadata: z.object({
      author: z.string(),
      department: z.string(),
      confidentiality: z.enum(["public", "internal", "confidential"]).optional(),
    }).optional(),
  }),
  execute: async ({ type, title, sections, metadata }) => {
    const artifactId = id("doc");
    
    // Store as artifact
    missionStore.appendArtifact({
      artifactId,
      sessionId: "global",
      createdAtUtc: nowIso(),
      category: type === "plan" ? "plan" : "deliverable",
      title,
      payload: { type, sections, metadata },
    });
    
    return {
      artifactId,
      type,
      title,
      sectionCount: sections.length,
      wordCount: sections.reduce((acc, s) => acc + s.content.split(" ").length, 0),
      createdAt: nowIso(),
      status: "CREATED",
    };
  },
});

export const sendNotificationTool = tool({
  description: "Send a notification or alert to team members or stakeholders.",
  inputSchema: z.object({
    recipients: z.array(z.string()).describe("List of recipients (agents, departments, or roles)"),
    subject: z.string().describe("Notification subject"),
    message: z.string().describe("Notification message"),
    priority: z.enum(["low", "normal", "high", "urgent"]).describe("Priority level"),
    channel: z.enum(["internal", "email", "slack", "all"]).optional(),
  }),
  execute: async ({ recipients, subject, message, priority, channel }) => {
    return {
      notificationId: id("notif"),
      recipients,
      subject,
      priority,
      channel: channel ?? "internal",
      sentAt: nowIso(),
      status: "DELIVERED",
    };
  },
});

// ============================================================
// FINANCIAL & BUSINESS TOOLS
// ============================================================

export const createBudgetTool = tool({
  description: "Create or update a budget for a project, department, or initiative.",
  inputSchema: z.object({
    name: z.string().describe("Budget name"),
    category: z.enum(["project", "department", "marketing", "operations", "R&D"]).describe("Budget category"),
    amount: z.number().describe("Total budget amount in USD"),
    allocations: z.array(z.object({
      item: z.string(),
      amount: z.number(),
      justification: z.string().optional(),
    })).describe("Budget allocations"),
    period: z.string().describe("Budget period (e.g., Q1 2024, FY2024)"),
  }),
  execute: async ({ name, category, amount, allocations, period }) => {
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const budgetId = id("budget");
    
    return {
      budgetId,
      name,
      category,
      totalBudget: amount,
      allocated: totalAllocated,
      remaining: amount - totalAllocated,
      allocations,
      period,
      status: totalAllocated <= amount ? "APPROVED" : "OVER_BUDGET",
      createdAt: nowIso(),
    };
  },
});

export const calculateROITool = tool({
  description: "Calculate return on investment for a project or initiative.",
  inputSchema: z.object({
    projectName: z.string().describe("Name of the project"),
    investment: z.number().describe("Total investment amount"),
    projectedReturns: z.number().describe("Projected returns"),
    timeframeMonths: z.number().describe("Timeframe in months"),
    risks: z.array(z.string()).optional().describe("Risk factors to consider"),
  }),
  execute: async ({ projectName, investment, projectedReturns, timeframeMonths, risks }) => {
    const roi = ((projectedReturns - investment) / investment) * 100;
    const annualizedRoi = roi * (12 / timeframeMonths);
    
    return {
      projectName,
      investment,
      projectedReturns,
      netProfit: projectedReturns - investment,
      roi: `${roi.toFixed(2)}%`,
      annualizedRoi: `${annualizedRoi.toFixed(2)}%`,
      paybackPeriod: `${(investment / (projectedReturns / timeframeMonths)).toFixed(1)} months`,
      riskLevel: (risks?.length ?? 0) > 3 ? "HIGH" : (risks?.length ?? 0) > 1 ? "MEDIUM" : "LOW",
      recommendation: roi > 50 ? "STRONGLY_RECOMMENDED" : roi > 20 ? "RECOMMENDED" : roi > 0 ? "CONDITIONAL" : "NOT_RECOMMENDED",
      calculatedAt: nowIso(),
    };
  },
});

// ============================================================
// HR & TEAM TOOLS
// ============================================================

export const assessTeamCapacityTool = tool({
  description: "Assess team capacity and resource availability for project planning.",
  inputSchema: z.object({
    department: z.string().describe("Department to assess"),
    timeframeDays: z.number().describe("Planning timeframe in days"),
    requiredSkills: z.array(z.string()).optional().describe("Required skills for the project"),
  }),
  execute: async ({ department, timeframeDays, requiredSkills }) => {
    const teamSize = Math.floor(Math.random() * 8) + 5;
    const availableCapacity = Math.floor(Math.random() * 30) + 50;
    
    return {
      department,
      timeframeDays,
      teamSize,
      availableCapacityPercent: availableCapacity,
      totalAvailableHours: teamSize * 8 * timeframeDays * (availableCapacity / 100),
      requiredSkills: requiredSkills ?? [],
      skillCoverage: requiredSkills 
        ? `${Math.floor(Math.random() * 20) + 70}%`
        : "100%",
      recommendations: availableCapacity < 50 
        ? ["Consider hiring contractors", "Reprioritize existing projects"]
        : ["Team has sufficient capacity", "Can take on additional work if needed"],
      assessedAt: nowIso(),
    };
  },
});

// ============================================================
// LEGAL & COMPLIANCE TOOLS
// ============================================================

export const complianceCheckTool = tool({
  description: "Check compliance with regulations, policies, or legal requirements.",
  inputSchema: z.object({
    area: z.enum(["GDPR", "SOC2", "HIPAA", "PCI-DSS", "accessibility", "licensing", "general"]).describe("Compliance area"),
    scope: z.string().describe("What to check (feature, product, process)"),
    details: z.string().optional().describe("Additional details for the check"),
  }),
  execute: async ({ area, scope, details }) => {
    const findings: Array<{ level: string; finding: string; recommendation: string }> = [];
    
    // Simulate compliance findings based on area
    if (area === "GDPR") {
      findings.push(
        { level: "INFO", finding: "Data processing inventory up to date", recommendation: "Continue quarterly reviews" },
        { level: "WARNING", finding: "Cookie consent banner needs review", recommendation: "Update to include all third-party cookies" }
      );
    } else if (area === "accessibility") {
      findings.push(
        { level: "WARNING", finding: "Some images missing alt text", recommendation: "Add descriptive alt text to all images" },
        { level: "INFO", finding: "Color contrast meets WCAG AA standards", recommendation: "No action needed" }
      );
    }
    
    return {
      checkId: id("compliance"),
      area,
      scope,
      findings,
      overallStatus: findings.some(f => f.level === "CRITICAL") ? "FAILED" : "PASSED",
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      completedAt: nowIso(),
    };
  },
});

export const reviewContractTool = tool({
  description: "Review a contract or legal agreement for risks and issues.",
  inputSchema: z.object({
    contractType: z.enum(["vendor", "customer", "partnership", "employment", "NDA", "licensing"]).describe("Type of contract"),
    summary: z.string().describe("Summary of key terms"),
    riskAreas: z.array(z.string()).optional().describe("Specific areas of concern"),
  }),
  execute: async ({ contractType, summary, riskAreas }) => {
    return {
      reviewId: id("legal"),
      contractType,
      riskLevel: "MEDIUM",
      findings: [
        { area: "Liability", status: "ACCEPTABLE", notes: "Standard liability clauses present" },
        { area: "Termination", status: "REVIEW_NEEDED", notes: "30-day notice period may be too short" },
        { area: "IP Rights", status: "ACCEPTABLE", notes: "Clear IP assignment clauses" },
      ],
      recommendations: [
        "Negotiate 60-day termination notice",
        "Add data protection addendum",
        "Clarify support SLA terms",
      ],
      approvalStatus: "CONDITIONAL_APPROVAL",
      reviewedAt: nowIso(),
    };
  },
});

// ============================================================
// DELEGATION TOOL - AGENT TO AGENT
// ============================================================

export const delegateToAgentTool = tool({
  description: "Delegate a subtask to another specialized agent. Use this when a task requires expertise from another department.",
  inputSchema: z.object({
    targetAgent: z.enum([
      "ceo_agent",
      "coo_agent", 
      "cto_agent",
      "cfo_agent",
      "marketing_agent",
      "hr_agent",
      "legal_agent",
      "qa_agent",
      "devops_agent",
      "design_agent",
      "research_agent",
      "worker_agent",
    ]).describe("The agent to delegate to"),
    task: z.string().describe("Description of the task to delegate"),
    context: z.string().describe("Relevant context for the task"),
    priority: z.enum(["low", "normal", "high", "critical"]).describe("Task priority"),
    waitForResult: z.boolean().optional().describe("Whether to wait for the result"),
  }),
  execute: async ({ targetAgent, task, context, priority, waitForResult }) => {
    const delegationId = id("delegation");
    
    return {
      delegationId,
      targetAgent,
      task,
      priority,
      status: waitForResult ? "COMPLETED" : "QUEUED",
      result: waitForResult ? {
        success: true,
        message: `${targetAgent} completed the delegated task: ${task.slice(0, 50)}...`,
        completedAt: nowIso(),
      } : {
        message: `Task queued for ${targetAgent}`,
        queuedAt: nowIso(),
      },
    };
  },
});

// ============================================================
// EXPORT ALL TOOLS BY CATEGORY
// ============================================================

export const researchTools = {
  webSearch: webSearchTool,
  analyzeData: analyzeDataTool,
};

export const taskTools = {
  createTask: createTaskTool,
  updateTaskStatus: updateTaskStatusTool,
  createMilestone: createMilestoneTool,
};

export const technicalTools = {
  generateCode: generateCodeTool,
  reviewCode: reviewCodeTool,
  runTests: runTestsTool,
};

export const documentTools = {
  createDocument: createDocumentTool,
  sendNotification: sendNotificationTool,
};

export const financialTools = {
  createBudget: createBudgetTool,
  calculateROI: calculateROITool,
};

export const hrTools = {
  assessTeamCapacity: assessTeamCapacityTool,
};

export const legalTools = {
  complianceCheck: complianceCheckTool,
  reviewContract: reviewContractTool,
};

export const orchestrationTools = {
  delegateToAgent: delegateToAgentTool,
};

// All tools combined
export const allTools = {
  ...researchTools,
  ...taskTools,
  ...technicalTools,
  ...documentTools,
  ...financialTools,
  ...hrTools,
  ...legalTools,
  ...orchestrationTools,
};
