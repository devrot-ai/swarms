import crypto from "node:crypto";
import {
  CooAgentRequest,
  CooAgentResponse,
  CooTask,
  DepartmentName,
  WorkerSkill,
} from "@/lib/mission-control/types";
import { taskQueueStore } from "@/lib/mission-control/taskQueue";
import { cooTaskStore } from "@/lib/mission-control/cooTaskStore";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

const PRIMARY_AGENT_BY_SKILL: Record<WorkerSkill, string> = {
  scrape: "wrk_scout_01",
  codegen: "wrk_codegen_01",
  design: "wrk_design_01",
  deploy: "wrk_deploy_01",
};

const BACKUP_AGENT_BY_SKILL: Record<WorkerSkill, string> = {
  scrape: "wrk_scout_02",
  codegen: "wrk_codegen_02",
  design: "wrk_design_02",
  deploy: "wrk_deploy_02",
};

interface TaskTemplate {
  title: string;
  description: string;
  priority: CooTask["priority"];
  estimatedRuntimeMin: number;
  department: DepartmentName;
  requiredSkills: WorkerSkill[];
}

function buildTemplates(mission: string): TaskTemplate[] {
  const normalized = mission.toLowerCase();
  const needsDesign = /(ui|ux|frontend|dashboard|design)/.test(normalized);
  const needsDeploy = /(deploy|release|infra|production)/.test(normalized);
  const needsScrape = /(scrape|crawl|research|intelligence|data gather)/.test(normalized);

  const templates: TaskTemplate[] = [
    {
      title: "Mission decomposition and acceptance criteria",
      description:
        "Break the mission into execution-ready tasks, dependencies, and completion criteria for all departments.",
      priority: "P0",
      estimatedRuntimeMin: 45,
      department: "Program Management",
      requiredSkills: ["codegen"],
    },
    {
      title: "Security and approval-gate policy mapping",
      description:
        "Map destructive/external actions to explicit approval requirements and define policy checks before execution.",
      priority: "P0",
      estimatedRuntimeMin: 60,
      department: "Security & Compliance",
      requiredSkills: ["codegen"],
    },
    {
      title: "Core implementation workstream",
      description:
        "Implement mission-critical backend/service logic with auditable actions and artifact outputs.",
      priority: "P0",
      estimatedRuntimeMin: 140,
      department: "Agent Runtime",
      requiredSkills: ["codegen"],
    },
    {
      title: "Verification and audit instrumentation",
      description:
        "Attach audit records and artifact checkpoints across major steps and verify data integrity paths.",
      priority: "P1",
      estimatedRuntimeMin: 75,
      department: "Data & Audit",
      requiredSkills: ["codegen"],
    },
  ];

  if (needsScrape) {
    templates.push({
      title: "External intelligence collection",
      description:
        "Gather external technical and domain signals to improve mission execution and risk decisions.",
      priority: "P1",
      estimatedRuntimeMin: 90,
      department: "Agent Runtime",
      requiredSkills: ["scrape"],
    });
  }

  if (needsDesign) {
    templates.push({
      title: "UX delivery and interaction design",
      description:
        "Produce frontend workflows for realtime visibility of tasks, status, and approvals.",
      priority: "P1",
      estimatedRuntimeMin: 100,
      department: "Frontend Realtime UX",
      requiredSkills: ["design"],
    });
  }

  if (needsDeploy) {
    templates.push({
      title: "Deployment readiness and rollout",
      description:
        "Prepare release sequence, rollout checks, and recovery plan for production deployment.",
      priority: "P0",
      estimatedRuntimeMin: 120,
      department: "Platform Orchestration",
      requiredSkills: ["deploy"],
    });
  }

  templates.push({
    title: "Final QA and stabilization",
    description:
      "Run validation pass, verify no blockers remain, and confirm mission readiness for closure.",
    priority: "P1",
    estimatedRuntimeMin: 80,
    department: "QA & Verification",
    requiredSkills: ["codegen"],
  });

  return templates;
}

function chooseAgent(requiredSkills: WorkerSkill[]) {
  const primarySkill = requiredSkills[0];
  return PRIMARY_AGENT_BY_SKILL[primarySkill] ?? "wrk_general_01";
}

function chooseBackupAgent(requiredSkills: WorkerSkill[]) {
  const primarySkill = requiredSkills[0];
  return BACKUP_AGENT_BY_SKILL[primarySkill] ?? "wrk_general_02";
}

function withDeadline(startDateUtc: string, daysFromStart: number) {
  const date = new Date(startDateUtc);
  date.setUTCDate(date.getUTCDate() + daysFromStart);
  return date.toISOString();
}

export function buildCooTasks(input: CooAgentRequest): CooAgentResponse {
  const sessionId = input.sessionId ?? id("sess");
  const existingTasks = cooTaskStore.getTasks(sessionId);

  const tasks: CooTask[] =
    existingTasks.length > 0
      ? existingTasks.map((task) => ({ ...task }))
      : (() => {
          const startDateUtc = input.startDateUtc ?? nowIso();
          const timelineDays = Math.max(2, input.timelineDays ?? 10);
          const templates = buildTemplates(input.mission);
          const dayStride = Math.max(1, Math.floor(timelineDays / Math.max(1, templates.length)));

          return templates
            .map((template, index) => {
              const assignedAgentId = chooseAgent(template.requiredSkills);

              return {
                id: id("task"),
                sessionId,
                title: template.title,
                description: template.description,
                order: index + 1,
                priority: template.priority,
                estimatedRuntimeMin: template.estimatedRuntimeMin,
                deadlineUtc: withDeadline(
                  startDateUtc,
                  Math.min(timelineDays, (index + 1) * dayStride),
                ),
                department: template.department,
                assignedAgentId,
                requiredSkills: template.requiredSkills,
                status: "PENDING" as const,
                blockedIterations: 0,
              };
            })
            .sort((a, b) => a.order - b.order);
        })();

  if (input.progressUpdates && input.progressUpdates.length > 0) {
    const byId = new Map(tasks.map((task) => [task.id, task]));

    input.progressUpdates.forEach((update) => {
      const existing = byId.get(update.taskId);
      if (!existing) return;

      if (update.status) {
        existing.status = update.status;
      }

      if (typeof update.blockedIterations === "number") {
        existing.blockedIterations = update.blockedIterations;
      }

      if (existing.blockedIterations >= 2 && existing.status === "BLOCKED") {
        const previousAgent = existing.assignedAgentId;
        existing.assignedAgentId = chooseBackupAgent(existing.requiredSkills);
        existing.reassignedFromAgentId = previousAgent;
        existing.status = "PENDING";
      }
    });
  }

  const createdEventIds =
    existingTasks.length > 0
      ? []
      : tasks.map((task) => taskQueueStore.emitTaskCreated(task).eventId);

  cooTaskStore.saveTasks(sessionId, tasks);

  return {
    tasks,
    createdEventIds,
  };
}
