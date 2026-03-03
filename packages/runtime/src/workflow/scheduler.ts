/**
 * Workflow scheduler — manages triggers for automatic workflow execution.
 *
 * Trigger types:
 * - schedule:   Cron expression (e.g., "0 9 * * *" = daily at 9am)
 * - interval:   Run every N seconds
 * - webhook:    HTTP endpoint that triggers the workflow
 * - manual:     User-initiated only (no scheduling)
 * - file_watch: Watch a filesystem path for changes
 */

import cron from "node-cron";
import { watch, type FSWatcher } from "chokidar";
import type { Workflow, WorkflowTrigger } from "@hive-desktop/shared";
import { getDb } from "../db/index.js";
import { runWorkflow } from "./runner.js";
import { broadcast } from "../server.js";

interface ScheduledJob {
  workflowId: string;
  trigger: WorkflowTrigger;
  cleanup: () => void;
}

const activeJobs = new Map<string, ScheduledJob>();

/**
 * Schedule a workflow based on its trigger configuration.
 * If already scheduled, it will be unscheduled first.
 */
export function scheduleWorkflow(workflow: Workflow): void {
  // Remove existing schedule
  unscheduleWorkflow(workflow.id);

  const { trigger } = workflow;

  if (trigger.type === "manual") {
    // Manual workflows don't get scheduled
    return;
  }

  let cleanup: () => void;

  switch (trigger.type) {
    case "schedule":
      cleanup = scheduleCron(workflow, trigger.cron);
      break;
    case "interval":
      cleanup = scheduleInterval(workflow, trigger.seconds);
      break;
    case "file_watch":
      cleanup = scheduleFileWatch(workflow, trigger.path, trigger.event);
      break;
    case "webhook":
      // Webhooks are handled via HTTP routes, not the scheduler
      // Just register the path for reference
      cleanup = () => {};
      break;
    default:
      return;
  }

  activeJobs.set(workflow.id, { workflowId: workflow.id, trigger, cleanup });
  console.log(`[scheduler] Scheduled workflow "${workflow.name}" (${trigger.type})`);
}

/**
 * Remove a workflow's schedule.
 */
export function unscheduleWorkflow(workflowId: string): void {
  const job = activeJobs.get(workflowId);
  if (job) {
    job.cleanup();
    activeJobs.delete(workflowId);
    console.log(`[scheduler] Unscheduled workflow ${workflowId}`);
  }
}

/**
 * Get all active scheduled jobs.
 */
export function getScheduledJobs(): Array<{ workflowId: string; trigger: WorkflowTrigger }> {
  return Array.from(activeJobs.values()).map(({ workflowId, trigger }) => ({ workflowId, trigger }));
}

/**
 * Load all active workflows from DB and schedule them.
 * Called on runtime startup.
 */
export function initializeScheduler(): void {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM workflows WHERE status = 'active'").all() as Array<Record<string, unknown>>;

  for (const row of rows) {
    const workflow = mapRow(row);
    try {
      scheduleWorkflow(workflow);
    } catch (err) {
      console.error(`[scheduler] Failed to schedule "${workflow.name}":`, (err as Error).message);
    }
  }

  console.log(`[scheduler] Initialized with ${activeJobs.size} scheduled workflows`);
}

/**
 * Shut down all scheduled jobs.
 */
export function shutdownScheduler(): void {
  for (const [id] of activeJobs) {
    unscheduleWorkflow(id);
  }
  console.log("[scheduler] All jobs stopped");
}

// ── Trigger Implementations ──────────────────────────────

function scheduleCron(workflow: Workflow, cronExpression: string): () => void {
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  const task = cron.schedule(cronExpression, () => {
    triggerRun(workflow.id);
  });

  return () => task.stop();
}

function scheduleInterval(workflow: Workflow, seconds: number): () => void {
  if (seconds < 1) {
    throw new Error(`Interval must be at least 1 second, got ${seconds}`);
  }

  const timer = setInterval(() => {
    triggerRun(workflow.id);
  }, seconds * 1000);

  return () => clearInterval(timer);
}

function scheduleFileWatch(
  workflow: Workflow,
  path: string,
  event: "create" | "modify" | "delete"
): () => void {
  const watcher: FSWatcher = watch(path, {
    ignoreInitial: true,
    persistent: true,
  });

  const eventMap: Record<string, string> = {
    create: "add",
    modify: "change",
    delete: "unlink",
  };

  watcher.on(eventMap[event] ?? "change", () => {
    triggerRun(workflow.id);
  });

  return () => {
    watcher.close();
  };
}

// ── Run Trigger ──────────────────────────────────────────

/**
 * Trigger a workflow run. Fetches the latest workflow state from DB.
 */
async function triggerRun(workflowId: string): Promise<void> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(workflowId) as Record<string, unknown> | undefined;

  if (!row) {
    console.warn(`[scheduler] Workflow ${workflowId} not found, unscheduling`);
    unscheduleWorkflow(workflowId);
    return;
  }

  const workflow = mapRow(row);

  if (workflow.status !== "active") {
    console.warn(`[scheduler] Workflow "${workflow.name}" is ${workflow.status}, skipping`);
    return;
  }

  console.log(`[scheduler] Triggering workflow "${workflow.name}"`);

  try {
    await runWorkflow(workflow);
  } catch (err) {
    console.error(`[scheduler] Run failed for "${workflow.name}":`, (err as Error).message);
    broadcast({
      type: "workflow:status",
      data: { id: workflowId, status: "error" },
    });
  }
}

/**
 * Handle webhook trigger — called from HTTP route.
 */
export async function triggerWebhook(path: string): Promise<{ triggered: boolean; workflowId?: string }> {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM workflows WHERE status = 'active'").all() as Array<Record<string, unknown>>;

  for (const row of rows) {
    const workflow = mapRow(row);
    if (workflow.trigger.type === "webhook" && workflow.trigger.path === path) {
      console.log(`[scheduler] Webhook triggered workflow "${workflow.name}"`);
      // Run async — don't block the webhook response
      runWorkflow(workflow).catch((err) => {
        console.error(`[scheduler] Webhook run failed:`, (err as Error).message);
      });
      return { triggered: true, workflowId: workflow.id };
    }
  }

  return { triggered: false };
}

// ── Helpers ──────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Workflow {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    status: (row.status as Workflow["status"]) ?? "draft",
    trigger: JSON.parse(row.trigger as string),
    steps: JSON.parse(row.steps as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastRunAt: row.last_run_at as string | undefined,
    runCount: (row.run_count as number) ?? 0,
    errorCount: (row.error_count as number) ?? 0,
  };
}
