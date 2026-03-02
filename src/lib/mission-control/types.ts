export type DepartmentName =
  | "Program Management"
  | "Security & Compliance"
  | "Platform Orchestration"
  | "Agent Runtime"
  | "Data & Audit"
  | "Frontend Realtime UX"
  | "QA & Verification";

export type ActionRisk = "safe" | "destructive" | "external";

export type TaskStatus = "PENDING" | "RUNNING" | "BLOCKED" | "REVIEW" | "COMPLETED";

export type MissionEventType =
  | "THOUGHT"
  | "ACTION"
  | "ARTIFACT"
  | "APPROVAL_REQUIRED"
  | "STATUS";

export interface KPI {
  name: string;
  target: string;
}

export interface ComputeBudget {
  tokenLimitTotal: number;
  maxTokensPerTask: number;
  costGuardrailUsd?: number;
}

export interface MissionInput {
  projectName: string;
  objective: string;
  timeline: {
    startDate: string;
    targetDate: string;
    milestones: string[];
  };
  requiredDepartments: DepartmentName[];
  kpis: KPI[];
  computeBudget: ComputeBudget;
  uncertainty?: number;
}

export interface AgentDefinition {
  agentId: string;
  type: "department" | "worker";
  name: string;
  department?: DepartmentName;
  responsibility: string;
  tools: string[];
  safetyRules: string[];
}

export interface TaskQueueItem {
  queueId: string;
  name: string;
  status: TaskStatus;
}

export interface MissionEvent {
  eventId: string;
  sessionId: string;
  agentId: string;
  type: MissionEventType;
  timestampUtc: string;
  confidence: number;
  uncertainty: number;
  status: TaskStatus;
  message: string;
  artifactId?: string | null;
  auditId: string;
}

export interface AuditRecord {
  auditId: string;
  sessionId: string;
  timestampUtc: string;
  actorId: string;
  action: string;
  details: Record<string, unknown>;
}

export interface ArtifactRecord {
  artifactId: string;
  sessionId: string;
  createdAtUtc: string;
  category: "plan" | "deliverable" | "tests" | "screenshot" | "other";
  title: string;
  payload: Record<string, unknown>;
}

export interface ApprovalRecord {
  approvalId: string;
  sessionId: string;
  approvedAtUtc: string;
  requestedByAgentId: string;
  actionType: string;
  approvedBy: string;
  approved: boolean;
}

export interface UserModelOverrideInput {
  /** Supported providers include OpenAI, Anthropic, Google, Ollama, and custom */
  provider: "openai" | "anthropic" | "google" | "ollama" | "other";
  model: string;
  /** API key is optional for Ollama (local) */
  apiKey?: string;
}

export interface ModelConfig {
  /** Provider identifier */
  provider: "openai" | "anthropic" | "google" | "ollama" | "other";
  model: string;
  keyRef?: string;
  fingerprint?: string;
}

export interface MissionSession {
  sessionId: string;
  mission: MissionInput;
  modelPolicy: {
    defaultSafeModel: ModelConfig;
    activeModel: ModelConfig;
  };
  createdAgents: AgentDefinition[];
  taskQueue: TaskQueueItem[];
  status: TaskStatus;
}

export interface StartSessionRequest {
  mission: MissionInput;
  userModelOverride?: UserModelOverrideInput;
}

export interface StartSessionResponse {
  sessionId: string;
  createdAgents: AgentDefinition[];
  taskQueueIds: string[];
  streamingEndpoint: string;
  status: TaskStatus;
}

export interface CooEscalation {
  to: "COO";
  reason: string;
  items: string[];
}

export interface CeoDepartmentPlan {
  name: DepartmentName | "COO Escalation";
  tasks_estimate: {
    priority: "P0" | "P1" | "P2";
    count: number;
    plan_status: "APPROVED" | "REJECTED" | "ESCALATED";
    notes?: string;
  };
  escalation?: CooEscalation;
}

export interface CeoAgentRequest {
  userBrief: string;
  companyMemory?: string;
  riskPolicy?: string;
}

export interface CeoAgentResponse {
  mission: string;
  KPIs: KPI[];
  budget_tokens: {
    total: number;
    max_per_task: number;
    review_reserve: number;
    compute_profile: {
      max_parallel_agents: number;
      expected_monthly_calls: number;
    };
  };
  departments: CeoDepartmentPlan[];
}

export type WorkerSkill = "scrape" | "codegen" | "design" | "deploy";

export interface CooTask {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  order: number;
  priority: "P0" | "P1" | "P2";
  estimatedRuntimeMin: number;
  deadlineUtc: string;
  department: DepartmentName;
  assignedAgentId: string;
  requiredSkills: WorkerSkill[];
  status: TaskStatus;
  blockedIterations: number;
  reassignedFromAgentId?: string;
}

export interface CooTaskProgressUpdate {
  taskId: string;
  status?: TaskStatus;
  blockedIterations?: number;
}

export interface CooAgentRequest {
  mission: string;
  sessionId?: string;
  startDateUtc?: string;
  timelineDays?: number;
  progressUpdates?: CooTaskProgressUpdate[];
}

export interface TaskQueueCreatedEvent {
  eventId: string;
  sessionId: string;
  type: "task.created";
  timestampUtc: string;
  taskId: string;
  payload: CooTask;
}

export interface CooAgentResponse {
  tasks: CooTask[];
  createdEventIds: string[];
}

export interface MarketingReasoningTraceItem {
  timestampUtc: string;
  thought: string;
  confidence: number;
}

export interface MarketingCitation {
  url: string;
  title: string;
  retrievedAtUtc: string;
  snapshotArtifactId: string;
  status: "captured" | "failed";
}

export interface MarketingAgentRequest {
  brief: string;
  sessionId?: string;
  researchUrls?: string[];
  companyMemory?: string[];
}

export interface MarketingAgentResponse {
  sessionId: string;
  campaignPlan: [string, string, string];
  sampleDeliverable: {
    title: string;
    channel: "blog" | "email" | "social";
    content: string;
  };
  validationTest: {
    name: string;
    method: string;
    passCriteria: string;
  };
  citations: MarketingCitation[];
  reasoningTrace: MarketingReasoningTraceItem[];
  handoff: {
    engineeringArtifactIds: string[];
    publishingArtifactIds: string[];
  };
}

export interface WorkerExecutionTraceItem {
  step: number;
  timestampUtc: string;
  action: string;
  toolUri?: string;
  outcome: "simulated" | "executed" | "blocked";
  details: string;
}

export interface WorkerAgentRequest {
  workerType: string;
  task: string;
  allowed_tool_uris: string[];
  requestedTools?: string[];
  dryRun?: boolean;
}

export interface WorkerAgentResponse {
  workerType: string;
  task: string;
  dryRun: boolean;
  plan: string[];
  stepByStepExecutionTrace: WorkerExecutionTraceItem[];
  finalArtifactUrl: string;
}
