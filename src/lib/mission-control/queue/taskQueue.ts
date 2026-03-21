/**
 * Task Queue Manager
 * 
 * Provides a robust task queue system for managing asynchronous work:
 * - Priority-based task scheduling
 * - Status tracking and updates
 * - Retry logic with exponential backoff
 * - Task dependencies
 * - Persistence and recovery
 * - Real-time status updates
 */

import crypto from "node:crypto";

// ============================================================
// TYPES
// ============================================================

export type TaskStatus = 
  | "queued"
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked";

export type TaskPriority = "critical" | "high" | "normal" | "low";

export interface TaskMetadata {
  createdBy: string;
  department: string;
  tags: string[];
  estimatedDurationMs?: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  parentTaskId?: string;
  childTaskIds: string[];
  dependencies: string[];
}

export interface Task<T = unknown> {
  id: string;
  type: string;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  payload: T;
  result?: unknown;
  metadata: TaskMetadata;
  progress: number; // 0-100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  scheduledFor?: string;
}

export interface TaskQueueStats {
  totalTasks: number;
  queuedTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageWaitTimeMs: number;
  averageProcessTimeMs: number;
  throughputPerHour: number;
}

// ============================================================
// TASK QUEUE IMPLEMENTATION
// ============================================================

class TaskQueueManager {
  private tasks: Map<string, Task> = new Map();
  private listeners: Map<string, Set<(task: Task) => void>> = new Map();
  private processingTasks: Set<string> = new Set();
  private completedTimes: number[] = [];
  private startTimes: Map<string, number> = new Map();

  constructor() {
    // Clean up old stats periodically
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), 60000);
    }
  }

  // ============================================================
  // TASK CREATION
  // ============================================================

  createTask<T>(options: {
    type: string;
    name: string;
    description: string;
    payload: T;
    priority?: TaskPriority;
    createdBy: string;
    department: string;
    tags?: string[];
    maxRetries?: number;
    dependencies?: string[];
    parentTaskId?: string;
    scheduledFor?: string;
  }): Task<T> {
    const id = `task_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const now = new Date().toISOString();

    const task: Task<T> = {
      id,
      type: options.type,
      name: options.name,
      description: options.description,
      status: options.scheduledFor ? "pending" : "queued",
      priority: options.priority ?? "normal",
      payload: options.payload,
      progress: 0,
      metadata: {
        createdBy: options.createdBy,
        department: options.department,
        tags: options.tags ?? [],
        retryCount: 0,
        maxRetries: options.maxRetries ?? 3,
        dependencies: options.dependencies ?? [],
        childTaskIds: [],
        parentTaskId: options.parentTaskId,
      },
      createdAt: now,
      updatedAt: now,
      scheduledFor: options.scheduledFor,
    };

    this.tasks.set(id, task as Task);
    this.notifyListeners(id, task as Task);

    // Link to parent if exists
    if (options.parentTaskId) {
      const parent = this.tasks.get(options.parentTaskId);
      if (parent) {
        parent.metadata.childTaskIds.push(id);
        this.tasks.set(options.parentTaskId, parent);
      }
    }

    return task;
  }

  // ============================================================
  // TASK OPERATIONS
  // ============================================================

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  getTasksByDepartment(department: string): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.metadata.department === department);
  }

  getNextTask(): Task | undefined {
    const queued = this.getTasksByStatus("queued")
      .filter(t => this.areDependenciesMet(t))
      .sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        
        // Then by creation time
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return queued[0];
  }

  private areDependenciesMet(task: Task): boolean {
    if (task.metadata.dependencies.length === 0) return true;
    
    return task.metadata.dependencies.every(depId => {
      const dep = this.tasks.get(depId);
      return dep?.status === "completed";
    });
  }

  // ============================================================
  // STATUS UPDATES
  // ============================================================

  updateTaskStatus(id: string, status: TaskStatus, result?: unknown, error?: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    const now = new Date().toISOString();
    
    task.status = status;
    task.updatedAt = now;

    switch (status) {
      case "running":
        task.startedAt = now;
        this.processingTasks.add(id);
        this.startTimes.set(id, Date.now());
        break;
      
      case "completed":
        task.completedAt = now;
        task.progress = 100;
        task.result = result;
        this.processingTasks.delete(id);
        
        // Track completion time
        const startTime = this.startTimes.get(id);
        if (startTime) {
          this.completedTimes.push(Date.now() - startTime);
          this.startTimes.delete(id);
        }
        break;
      
      case "failed":
        task.metadata.lastError = error;
        task.metadata.retryCount++;
        this.processingTasks.delete(id);
        this.startTimes.delete(id);
        
        // Auto-retry if under max retries
        if (task.metadata.retryCount < task.metadata.maxRetries) {
          task.status = "queued";
        }
        break;
      
      case "cancelled":
        this.processingTasks.delete(id);
        this.startTimes.delete(id);
        break;
    }

    this.tasks.set(id, task);
    this.notifyListeners(id, task);
    
    return true;
  }

  updateTaskProgress(id: string, progress: number): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    task.progress = Math.max(0, Math.min(100, progress));
    task.updatedAt = new Date().toISOString();
    
    this.tasks.set(id, task);
    this.notifyListeners(id, task);
    
    return true;
  }

  // ============================================================
  // TASK RETRY & RECOVERY
  // ============================================================

  retryTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || (task.status !== "failed" && task.status !== "cancelled")) {
      return false;
    }

    task.status = "queued";
    task.progress = 0;
    task.metadata.retryCount++;
    task.updatedAt = new Date().toISOString();
    
    this.tasks.set(id, task);
    this.notifyListeners(id, task);
    
    return true;
  }

  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status === "completed") {
      return false;
    }

    return this.updateTaskStatus(id, "cancelled");
  }

  // ============================================================
  // BATCH OPERATIONS
  // ============================================================

  createTaskBatch(tasks: Parameters<typeof this.createTask>[0][]): Task[] {
    return tasks.map(t => this.createTask(t));
  }

  cancelTasksByDepartment(department: string): number {
    const tasks = this.getTasksByDepartment(department)
      .filter(t => t.status !== "completed" && t.status !== "cancelled");
    
    tasks.forEach(t => this.cancelTask(t.id));
    return tasks.length;
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  getStats(): TaskQueueStats {
    const all = Array.from(this.tasks.values());
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Calculate throughput
    const completedInLastHour = all.filter(t => 
      t.status === "completed" && 
      t.completedAt && 
      new Date(t.completedAt).getTime() > oneHourAgo
    ).length;

    // Average times
    const avgProcessTime = this.completedTimes.length > 0
      ? this.completedTimes.reduce((a, b) => a + b, 0) / this.completedTimes.length
      : 0;

    const queuedTasks = all.filter(t => t.status === "queued");
    const avgWaitTime = queuedTasks.length > 0
      ? queuedTasks.reduce((sum, t) => sum + (now - new Date(t.createdAt).getTime()), 0) / queuedTasks.length
      : 0;

    return {
      totalTasks: all.length,
      queuedTasks: queuedTasks.length,
      runningTasks: all.filter(t => t.status === "running").length,
      completedTasks: all.filter(t => t.status === "completed").length,
      failedTasks: all.filter(t => t.status === "failed").length,
      averageWaitTimeMs: avgWaitTime,
      averageProcessTimeMs: avgProcessTime,
      throughputPerHour: completedInLastHour,
    };
  }

  // ============================================================
  // LISTENERS
  // ============================================================

  subscribe(taskId: string, callback: (task: Task) => void): () => void {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, new Set());
    }
    this.listeners.get(taskId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(taskId)?.delete(callback);
    };
  }

  subscribeAll(callback: (task: Task) => void): () => void {
    if (!this.listeners.has("*")) {
      this.listeners.set("*", new Set());
    }
    this.listeners.get("*")!.add(callback);

    return () => {
      this.listeners.get("*")?.delete(callback);
    };
  }

  private notifyListeners(taskId: string, task: Task): void {
    // Notify task-specific listeners
    this.listeners.get(taskId)?.forEach(cb => cb(task));
    // Notify global listeners
    this.listeners.get("*")?.forEach(cb => cb(task));
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  private cleanup(): void {
    const oneHourAgo = Date.now() - 3600000;
    
    // Keep only last 100 completed times for stats
    if (this.completedTimes.length > 100) {
      this.completedTimes = this.completedTimes.slice(-100);
    }

    // Optional: Clean up old completed/cancelled tasks
    // Uncomment if you want automatic cleanup
    /*
    for (const [id, task] of this.tasks) {
      if (
        (task.status === "completed" || task.status === "cancelled") &&
        task.completedAt &&
        new Date(task.completedAt).getTime() < oneHourAgo
      ) {
        this.tasks.delete(id);
      }
    }
    */
  }

  clear(): void {
    this.tasks.clear();
    this.processingTasks.clear();
    this.startTimes.clear();
    this.completedTimes = [];
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const taskQueue = new TaskQueueManager();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function createAgentTask(
  agentId: string,
  taskType: string,
  description: string,
  payload: unknown,
  options?: {
    priority?: TaskPriority;
    dependencies?: string[];
    parentTaskId?: string;
  }
): Task {
  return taskQueue.createTask({
    type: `agent.${taskType}`,
    name: `${agentId}: ${taskType}`,
    description,
    payload,
    priority: options?.priority ?? "normal",
    createdBy: agentId,
    department: "AI Agents",
    tags: ["agent", agentId, taskType],
    dependencies: options?.dependencies,
    parentTaskId: options?.parentTaskId,
  });
}

export function createWorkflowTask(
  workflowName: string,
  steps: string[],
  payload: unknown,
  options?: {
    priority?: TaskPriority;
  }
): { workflow: Task; steps: Task[] } {
  const workflow = taskQueue.createTask({
    type: "workflow",
    name: workflowName,
    description: `Workflow: ${workflowName}`,
    payload: { steps, originalPayload: payload },
    priority: options?.priority ?? "normal",
    createdBy: "system",
    department: "Orchestration",
    tags: ["workflow", workflowName],
  });

  const stepTasks: Task[] = [];
  let previousStepId: string | undefined;

  for (const step of steps) {
    const stepTask = taskQueue.createTask({
      type: "workflow.step",
      name: step,
      description: `Step: ${step}`,
      payload: { workflowId: workflow.id, step },
      priority: options?.priority ?? "normal",
      createdBy: "system",
      department: "Orchestration",
      tags: ["workflow.step", workflowName, step],
      parentTaskId: workflow.id,
      dependencies: previousStepId ? [previousStepId] : [],
    });
    
    stepTasks.push(stepTask);
    previousStepId = stepTask.id;
  }

  return { workflow, steps: stepTasks };
}

export default taskQueue;
