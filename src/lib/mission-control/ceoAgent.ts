import {
  CeoAgentRequest,
  CeoAgentResponse,
  CeoDepartmentPlan,
  DepartmentName,
  KPI,
} from "@/lib/mission-control/types";

function normalize(input: string) {
  return input.trim().toLowerCase();
}

function detectRiskTier(riskPolicy?: string) {
  const text = normalize(riskPolicy ?? "");
  if (/(high|strict|critical|zero[- ]trust)/.test(text)) return "high" as const;
  if (/(moderate|standard|balanced)/.test(text)) return "medium" as const;
  return "low" as const;
}

function missionParagraph(userBrief: string, companyMemory?: string, riskPolicy?: string) {
  const memoryPart = companyMemory
    ? " using historical Company Memory to preserve proven execution patterns"
    : " with a clean execution baseline";

  const riskPart = riskPolicy
    ? " while enforcing the provided risk policy for approval gates, external effects, and uncertainty handling"
    : " while enforcing conservative default risk controls for destructive and external actions";

  return `Execute the user brief as a measurable company mission by aligning departments on outcomes, timelines, and resource limits${memoryPart}${riskPart}, ensuring every major step is auditable and artifact-backed, and keeping token consumption efficient without reducing planning transparency.`;
}

function kpisByRisk(riskTier: "low" | "medium" | "high"): KPI[] {
  const latencyTarget = riskTier === "high" ? "p95 <= 6s" : "p95 <= 4s";
  const tokenTarget = riskTier === "high" ? "<= 9,000 avg/task" : "<= 10,500 avg/task";

  return [
    { name: "Mission Planning SLA", target: latencyTarget },
    { name: "Audit Coverage", target: "100% action-level audit records" },
    { name: "Artifact Completeness", target: ">= 1 artifact per major step" },
    {
      name: "Approval Gate Compliance",
      target: "100% destructive/external actions blocked without explicit human approval",
    },
    {
      name: "Uncertainty Escalation",
      target: "100% outputs above 40% uncertainty set to REVIEW and escalated",
    },
    { name: "Token Efficiency", target: tokenTarget },
  ];
}

function budgetByRisk(riskTier: "low" | "medium" | "high") {
  if (riskTier === "high") {
    return {
      total: 900000,
      max_per_task: 10000,
      review_reserve: 220000,
      compute_profile: {
        max_parallel_agents: 10,
        expected_monthly_calls: 3200,
      },
    };
  }

  if (riskTier === "medium") {
    return {
      total: 1100000,
      max_per_task: 12000,
      review_reserve: 180000,
      compute_profile: {
        max_parallel_agents: 12,
        expected_monthly_calls: 3900,
      },
    };
  }

  return {
    total: 1300000,
    max_per_task: 12000,
    review_reserve: 150000,
    compute_profile: {
      max_parallel_agents: 14,
      expected_monthly_calls: 4500,
    },
  };
}

function baseDepartments(): Array<{ name: DepartmentName; priority: "P0" | "P1"; count: number }> {
  return [
    { name: "Program Management", priority: "P0", count: 5 },
    { name: "Security & Compliance", priority: "P0", count: 6 },
    { name: "Agent Runtime", priority: "P0", count: 7 },
    { name: "Data & Audit", priority: "P0", count: 5 },
    { name: "Frontend Realtime UX", priority: "P1", count: 4 },
    { name: "QA & Verification", priority: "P1", count: 5 },
  ];
}

function findAmbiguities(userBrief: string, companyMemory?: string) {
  const fullText = normalize([userBrief, companyMemory ?? ""].join(" "));
  const items: string[] = [];

  if (/(asap|soon|fast|quickly|urgent)/.test(fullText)) {
    items.push("Timeline language is non-specific and needs concrete milestones.");
  }
  if (!/(kpi|metric|target|sla|okr)/.test(fullText)) {
    items.push("Success criteria are underspecified; KPI targets are ambiguous.");
  }
  if (/(global|all tenants|every tenant|cross-tenant)/.test(fullText)) {
    items.push("Cross-tenant operating boundaries require COO policy confirmation.");
  }

  return items;
}

function evaluatePlanStatus(
  name: DepartmentName,
  riskTier: "low" | "medium" | "high",
  ambiguityItems: string[],
): CeoDepartmentPlan["tasks_estimate"]["plan_status"] {
  if (name === "Security & Compliance" && riskTier === "high") return "APPROVED";
  if (ambiguityItems.length > 0 && (name === "Program Management" || name === "Agent Runtime")) {
    return "ESCALATED";
  }
  return "APPROVED";
}

export function buildCeoPlan(input: CeoAgentRequest): CeoAgentResponse {
  const riskTier = detectRiskTier(input.riskPolicy);
  const ambiguities = findAmbiguities(input.userBrief, input.companyMemory);
  const departments: CeoDepartmentPlan[] = baseDepartments().map((dept) => ({
    name: dept.name,
    tasks_estimate: {
      priority: dept.priority,
      count: dept.count,
      plan_status: evaluatePlanStatus(dept.name, riskTier, ambiguities),
    },
  }));

  if (ambiguities.length > 0) {
    departments.push({
      name: "COO Escalation",
      tasks_estimate: {
        priority: "P0",
        count: ambiguities.length,
        plan_status: "ESCALATED",
        notes: "Ambiguous planning items require COO decision.",
      },
      escalation: {
        to: "COO",
        reason: "Ambiguous scope/risk details found during CEO plan approval.",
        items: ambiguities,
      },
    });
  }

  return {
    mission: missionParagraph(input.userBrief, input.companyMemory, input.riskPolicy),
    KPIs: kpisByRisk(riskTier),
    budget_tokens: budgetByRisk(riskTier),
    departments,
  };
}
