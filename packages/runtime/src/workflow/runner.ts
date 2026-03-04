/**
 * Workflow runner — executes a complete workflow run, step by step.
 *
 * Handles:
 * - Sequential step execution
 * - Conditional branching (condition steps that return false skip remaining steps)
 * - Error strategies: stop, continue, retry
 * - Variable context passing between steps
 * - Run recording in the database
 * - Real-time WebSocket event broadcasting
 */

import { nanoid } from "nanoid";
import type { Workflow, WorkflowRun, WorkflowStep } from "@hive-desktop/shared";
import { getDb } from "../db/index.js";
import { broadcast } from "../server.js";
import { WorkflowContext } from "./context.js";
import { executeStep } from "./engine.js";
import type { StepResult } from "./engine.js";

/** Active runs keyed by run ID — for cancellation support. */
const activeRuns = new Map<string, { abort: boolean }>();

/**
 * Execute a workflow from start to finish.
 * Returns the completed WorkflowRun record.
 */
export async function runWorkflow(workflow: Workflow): Promise<WorkflowRun> {
  const db = getDb();
  const runId = nanoid();
  const now = new Date().toISOString();

  // Create run record
  db.prepare(
    `INSERT INTO workflow_runs (id, workflow_id, status, started_at, steps_executed)
     VALUES (?, ?, 'running', ?, 0)`
  ).run(runId, workflow.id, now);

  const run: WorkflowRun = {
    id: runId,
    workflowId: workflow.id,
    status: "running",
    startedAt: now,
    stepsExecuted: 0,
  };

  // Track for cancellation
  const control = { abort: false };
  activeRuns.set(runId, control);

  // Broadcast run start
  broadcast({ type: "workflow:run:start", data: { run } });

  const context = new WorkflowContext();
  let stepsExecuted = 0;
  let runError: string | undefined;
  let skipRemaining = false;

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      // Check for abort
      if (control.abort) {
        runError = "Run cancelled";
        break;
      }

      if (skipRemaining) break;

      const step = workflow.steps[i];

      const stepStartedAt = new Date().toISOString();

      // Broadcast step start
      broadcast({
        type: "workflow:run:step",
        data: { runId, stepIndex: i, status: "running" },
      });
      broadcast({
        type: "workflow:run:step:detail",
        data: {
          runId,
          stepIndex: i,
          stepId: step.id,
          status: "running",
          startedAt: stepStartedAt,
        },
      });

      const stepStartMs = Date.now();
      let result: StepResult;

      try {
        result = await executeStepWithRetry(step, context);
      } catch (err) {
        result = { success: false, error: (err as Error).message };
      }

      const durationMs = Date.now() - stepStartMs;
      const stepCompletedAt = new Date().toISOString();

      // Record the step result
      context.recordStep(step.id, result.output, result.error);
      stepsExecuted++;

      if (result.success) {
        broadcast({
          type: "workflow:run:step",
          data: { runId, stepIndex: i, status: "completed" },
        });
        broadcast({
          type: "workflow:run:step:detail",
          data: {
            runId,
            stepIndex: i,
            stepId: step.id,
            status: "completed",
            output: result.output,
            durationMs,
            startedAt: stepStartedAt,
            completedAt: stepCompletedAt,
          },
        });

        // Condition steps can skip remaining steps
        if (step.type === "condition" && result.skipped) {
          skipRemaining = true;
        }
      } else {
        broadcast({
          type: "workflow:run:step",
          data: { runId, stepIndex: i, status: "failed" },
        });
        broadcast({
          type: "workflow:run:step:detail",
          data: {
            runId,
            stepIndex: i,
            stepId: step.id,
            status: "failed",
            error: result.error,
            durationMs,
            startedAt: stepStartedAt,
            completedAt: stepCompletedAt,
          },
        });

        switch (step.onError) {
          case "stop":
            runError = `Step "${step.name}" failed: ${result.error}`;
            skipRemaining = true;
            break;
          case "continue":
            // Keep going
            break;
          case "retry":
            // Retry is handled inside executeStepWithRetry, if it still failed → stop
            runError = `Step "${step.name}" failed after retries: ${result.error}`;
            skipRemaining = true;
            break;
        }
      }
    }
  } catch (err) {
    runError = (err as Error).message;
  } finally {
    activeRuns.delete(runId);
  }

  // Finalize run
  const completedAt = new Date().toISOString();
  const finalStatus = runError ? "failed" : "completed";
  const resultData = context.toJSON();

  db.prepare(
    `UPDATE workflow_runs SET status = ?, completed_at = ?, result = ?, error = ?, steps_executed = ?
     WHERE id = ?`
  ).run(finalStatus, completedAt, JSON.stringify(resultData), runError ?? null, stepsExecuted, runId);

  // Update workflow counters
  db.prepare(
    `UPDATE workflows SET
       last_run_at = ?,
       run_count = run_count + 1,
       error_count = error_count + ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(completedAt, runError ? 1 : 0, workflow.id);

  if (runError) {
    // Set workflow status to error if it was active
    db.prepare(
      `UPDATE workflows SET status = 'error' WHERE id = ? AND status = 'active'`
    ).run(workflow.id);
  }

  const completedRun: WorkflowRun = {
    id: runId,
    workflowId: workflow.id,
    status: finalStatus as WorkflowRun["status"],
    startedAt: now,
    completedAt,
    result: resultData,
    error: runError,
    stepsExecuted,
  };

  // Broadcast run complete
  broadcast({ type: "workflow:run:complete", data: { run: completedRun } });

  return completedRun;
}

/**
 * Cancel an active workflow run.
 */
export function cancelRun(runId: string): boolean {
  const control = activeRuns.get(runId);
  if (!control) return false;
  control.abort = true;
  return true;
}

/**
 * Check if a run is currently active.
 */
export function isRunActive(runId: string): boolean {
  return activeRuns.has(runId);
}

/**
 * Execute a step with retry logic.
 */
async function executeStepWithRetry(
  step: WorkflowStep,
  context: WorkflowContext
): Promise<StepResult> {
  const maxAttempts = step.onError === "retry" ? (step.retryCount ?? 3) : 1;
  const retryDelay = step.retryDelay ?? 2000;

  let lastResult: StepResult = { success: false, error: "No attempts made" };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await executeStep(step, context);

    if (lastResult.success) return lastResult;

    // If not retrying or this was the last attempt, return the failure
    if (attempt < maxAttempts) {
      console.log(
        `[workflow] Step "${step.name}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${retryDelay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return lastResult;
}
