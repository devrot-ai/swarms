export interface BudgetEstimateInput {
  appComplexity: "low" | "medium" | "high";
  users: number;
  aiUsage: "low" | "medium" | "high";
}

export interface BudgetEstimate {
  devCost: number;
  infraCost: number;
  aiCost: number;
  marketing: number;
  total: number;
}

export function estimateBudget(input: BudgetEstimateInput): BudgetEstimate {
  const devCost =
    input.appComplexity === "low"
      ? 3000
      : input.appComplexity === "medium"
        ? 10000
        : 25000;

  const infraCost = input.users < 1000 ? 50 : input.users < 10000 ? 300 : 1500;

  const aiCost =
    input.aiUsage === "low" ? 100 : input.aiUsage === "medium" ? 500 : 2000;

  const marketing = Math.round(devCost * 0.3);

  return {
    devCost,
    infraCost,
    aiCost,
    marketing,
    total: devCost + infraCost + aiCost + marketing,
  };
}
