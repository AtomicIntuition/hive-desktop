import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import type { Workflow, WorkflowRun } from "@hive-desktop/shared";
import { runWorkflow, cancelRun, isRunActive } from "../workflow/runner.js";
import { scheduleWorkflow, unscheduleWorkflow, getScheduledJobs } from "../workflow/scheduler.js";
import { triggerWebhook } from "../workflow/scheduler.js";
import { getTemplates, getTemplate } from "../workflow/templates.js";
import { broadcast } from "../server.js";

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  // ── CRUD ─────────────────────────────────────────────────

  // List all workflows
  app.get("/api/workflows", async () => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM workflows ORDER BY updated_at DESC").all();
    return rows.map(mapWorkflowRow);
  });

  // Get a single workflow
  app.get<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const db = getDb();
    const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(request.params.id);
    if (!row) return reply.status(404).send({ error: "Workflow not found" });
    return mapWorkflowRow(row);
  });

  // Create a workflow
  app.post<{ Body: { name: string; description?: string; trigger: string; steps: string } }>(
    "/api/workflows",
    async (request) => {
      const db = getDb();
      const id = nanoid();
      const { name, description, trigger, steps } = request.body;

      db.prepare(
        `INSERT INTO workflows (id, name, description, trigger, steps)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, name, description ?? "", trigger, steps);

      const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(id);
      return mapWorkflowRow(row);
    }
  );

  // Update a workflow
  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string; status?: string; trigger?: string; steps?: string } }>(
    "/api/workflows/:id",
    async (request, reply) => {
      const db = getDb();
      const updates: string[] = ["updated_at = datetime('now')"];
      const values: unknown[] = [];

      for (const [key, value] of Object.entries(request.body)) {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }

      values.push(request.params.id);
      db.prepare(`UPDATE workflows SET ${updates.join(", ")} WHERE id = ?`).run(...values);

      const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(request.params.id);
      if (!row) return reply.status(404).send({ error: "Workflow not found" });

      const workflow = mapWorkflowRow(row);

      // Update scheduler based on new status
      if (workflow.status === "active") {
        scheduleWorkflow(workflow);
      } else {
        unscheduleWorkflow(workflow.id);
      }

      return workflow;
    }
  );

  // Delete a workflow
  app.delete<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const db = getDb();
    unscheduleWorkflow(request.params.id);
    db.prepare("DELETE FROM workflow_runs WHERE workflow_id = ?").run(request.params.id);
    const result = db.prepare("DELETE FROM workflows WHERE id = ?").run(request.params.id);
    if (result.changes === 0) return reply.status(404).send({ error: "Workflow not found" });
    return { success: true };
  });

  // ── Execution ────────────────────────────────────────────

  // Trigger a manual workflow run
  app.post<{ Params: { id: string } }>("/api/workflows/:id/run", async (request, reply) => {
    const db = getDb();
    const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(request.params.id);
    if (!row) return reply.status(404).send({ error: "Workflow not found" });

    const workflow = mapWorkflowRow(row);

    // Run asynchronously — return the run ID immediately
    const runId = nanoid();
    reply.status(202).send({ runId, status: "started" });

    // Execute in background
    runWorkflow(workflow).catch((err) => {
      console.error(`[api] Workflow run failed:`, (err as Error).message);
    });
  });

  // Cancel an active run
  app.post<{ Params: { runId: string } }>("/api/workflows/runs/:runId/cancel", async (request, reply) => {
    const cancelled = cancelRun(request.params.runId);
    if (!cancelled) return reply.status(404).send({ error: "Run not found or already completed" });
    return { success: true };
  });

  // Check run status
  app.get<{ Params: { runId: string } }>("/api/workflows/runs/:runId", async (request, reply) => {
    const db = getDb();
    const row = db.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(request.params.runId);
    if (!row) return reply.status(404).send({ error: "Run not found" });
    return mapRunRow(row);
  });

  // List workflow runs
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/api/workflows/:id/runs",
    async (request) => {
      const db = getDb();
      const limit = Math.min(parseInt(request.query.limit ?? "50", 10), 200);
      const rows = db
        .prepare("SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?")
        .all(request.params.id, limit);
      return rows.map(mapRunRow);
    }
  );

  // ── Activation ───────────────────────────────────────────

  // Activate a workflow (set status to active + schedule)
  app.post<{ Params: { id: string } }>("/api/workflows/:id/activate", async (request, reply) => {
    const db = getDb();
    db.prepare("UPDATE workflows SET status = 'active', updated_at = datetime('now') WHERE id = ?")
      .run(request.params.id);

    const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(request.params.id);
    if (!row) return reply.status(404).send({ error: "Workflow not found" });

    const workflow = mapWorkflowRow(row);
    scheduleWorkflow(workflow);
    broadcast({ type: "workflow:status", data: { id: workflow.id, status: "active" } });

    return workflow;
  });

  // Pause a workflow (set status to paused + unschedule)
  app.post<{ Params: { id: string } }>("/api/workflows/:id/pause", async (request, reply) => {
    const db = getDb();
    db.prepare("UPDATE workflows SET status = 'paused', updated_at = datetime('now') WHERE id = ?")
      .run(request.params.id);

    unscheduleWorkflow(request.params.id);

    const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(request.params.id);
    if (!row) return reply.status(404).send({ error: "Workflow not found" });

    const workflow = mapWorkflowRow(row);
    broadcast({ type: "workflow:status", data: { id: workflow.id, status: "paused" } });

    return workflow;
  });

  // ── Scheduler Info ───────────────────────────────────────

  app.get("/api/workflows/scheduled", async () => {
    return getScheduledJobs();
  });

  // ── Webhooks ─────────────────────────────────────────────

  // Webhook trigger endpoint
  app.post<{ Params: { path: string } }>("/api/webhooks/:path", async (request, reply) => {
    const result = await triggerWebhook(request.params.path);
    if (!result.triggered) {
      return reply.status(404).send({ error: "No workflow configured for this webhook path" });
    }
    return { triggered: true, workflowId: result.workflowId };
  });

  // ── Templates ────────────────────────────────────────────

  // List all templates
  app.get("/api/workflows/templates", async () => {
    return getTemplates();
  });

  // Get a single template
  app.get<{ Params: { slug: string } }>("/api/workflows/templates/:slug", async (request, reply) => {
    const template = getTemplate(request.params.slug);
    if (!template) return reply.status(404).send({ error: "Template not found" });
    return template;
  });

  // Create a workflow from a template
  app.post<{ Params: { slug: string }; Body: { name?: string; variables?: Record<string, string> } }>(
    "/api/workflows/templates/:slug/create",
    async (request, reply) => {
      const template = getTemplate(request.params.slug);
      if (!template) return reply.status(404).send({ error: "Template not found" });

      const db = getDb();
      const id = nanoid();
      const name = request.body.name ?? template.name;

      // If variables provided, substitute them in steps
      let steps = JSON.parse(JSON.stringify(template.steps));
      const vars = request.body.variables;
      if (vars) {
        const stepsStr = JSON.stringify(steps);
        const resolved = stepsStr.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
          return vars[key] ?? `{{${key}}}`;
        });
        steps = JSON.parse(resolved);
      }

      db.prepare(
        `INSERT INTO workflows (id, name, description, trigger, steps)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, name, template.description, JSON.stringify(template.trigger), JSON.stringify(steps));

      const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(id);
      return mapWorkflowRow(row);
    }
  );
}

// ── Row Mappers ────────────────────────────────────────────

function mapWorkflowRow(row: unknown): Workflow {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    status: (r.status as Workflow["status"]) ?? "draft",
    trigger: JSON.parse(r.trigger as string),
    steps: JSON.parse(r.steps as string),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastRunAt: r.last_run_at as string | undefined,
    runCount: (r.run_count as number) ?? 0,
    errorCount: (r.error_count as number) ?? 0,
  };
}

function mapRunRow(row: unknown): WorkflowRun {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    workflowId: r.workflow_id as string,
    status: r.status as WorkflowRun["status"],
    startedAt: r.started_at as string,
    completedAt: r.completed_at as string | undefined,
    result: r.result ? JSON.parse(r.result as string) : undefined,
    error: r.error as string | undefined,
    stepsExecuted: (r.steps_executed as number) ?? 0,
  };
}
