import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import { isConfigured, setApiKey, removeApiKey, getApiKey } from "../ai/provider.js";
import { planWorkflow } from "../ai/planner.js";
import type { WorkflowPlan } from "../ai/planner.js";

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // ── Status ─────────────────────────────────────────────

  app.get("/api/ai/status", async () => {
    return {
      configured: isConfigured(),
      provider: "claude",
      model: "claude-sonnet-4-20250514",
    };
  });

  // ── API Key Management ─────────────────────────────────

  app.post<{ Body: { apiKey: string } }>("/api/ai/config", async (request, reply) => {
    const { apiKey } = request.body;
    if (!apiKey || !apiKey.startsWith("sk-ant-")) {
      return reply.status(400).send({ error: "Invalid API key format. Must start with 'sk-ant-'" });
    }

    setApiKey(apiKey);
    return { success: true, configured: true };
  });

  app.delete("/api/ai/config", async () => {
    removeApiKey();
    return { success: true, configured: false };
  });

  // ── Plan Workflow ──────────────────────────────────────

  app.post<{ Body: { prompt: string } }>("/api/ai/plan-workflow", async (request, reply) => {
    const { prompt } = request.body;

    if (!prompt?.trim()) {
      return reply.status(400).send({ error: "Prompt is required" });
    }

    if (!isConfigured()) {
      return reply.status(400).send({
        error: "Anthropic API key not configured",
        message: "Go to Settings and add your Anthropic API key to use the AI planner.",
      });
    }

    try {
      const plan = await planWorkflow(prompt);
      return plan;
    } catch (err) {
      const message = (err as Error).message;

      // Handle specific API errors
      if (message.includes("401") || message.includes("authentication")) {
        return reply.status(401).send({ error: "Invalid API key. Check your Anthropic API key in Settings." });
      }
      if (message.includes("429") || message.includes("rate")) {
        return reply.status(429).send({ error: "Rate limited. Please try again in a moment." });
      }

      return reply.status(500).send({ error: `AI planning failed: ${message}` });
    }
  });

  // ── Confirm Workflow (plan → save) ─────────────────────

  app.post<{ Body: WorkflowPlan }>("/api/ai/confirm-workflow", async (request) => {
    const plan = request.body;
    const db = getDb();
    const id = nanoid();

    db.prepare(
      `INSERT INTO workflows (id, name, description, trigger, steps)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      id,
      plan.name,
      plan.description,
      JSON.stringify(plan.trigger),
      JSON.stringify(plan.steps)
    );

    const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(id);
    return mapWorkflowRow(row);
  });
}

function mapWorkflowRow(row: unknown) {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    status: (r.status as string) ?? "draft",
    trigger: JSON.parse(r.trigger as string),
    steps: JSON.parse(r.steps as string),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastRunAt: r.last_run_at as string | undefined,
    runCount: (r.run_count as number) ?? 0,
    errorCount: (r.error_count as number) ?? 0,
  };
}
