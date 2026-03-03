import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import type { Workflow } from "@hive-desktop/shared";

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
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
      return mapWorkflowRow(row);
    }
  );

  // Delete a workflow
  app.delete<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const db = getDb();
    const result = db.prepare("DELETE FROM workflows WHERE id = ?").run(request.params.id);
    if (result.changes === 0) return reply.status(404).send({ error: "Workflow not found" });
    return { success: true };
  });

  // List workflow runs
  app.get<{ Params: { id: string } }>("/api/workflows/:id/runs", async (request) => {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT 50")
      .all(request.params.id);
    return rows;
  });
}

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
