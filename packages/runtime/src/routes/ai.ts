import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import { isConfigured, setApiKey, removeApiKey, getClient } from "../ai/provider.js";
import { planWorkflow } from "../ai/planner.js";
import type { WorkflowPlan } from "../ai/planner.js";
import { agentPlanWorkflow } from "../ai/agent-planner.js";
import { auditWorkflowPlan } from "../ai/auditor.js";
import { fixWorkflowPlan } from "../ai/fixer.js";
import { parseFixResponse } from "../ai/fixer.js";

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

  // ── Agent Plan Workflow (SSE) ─────────────────────────

  app.post<{ Body: { prompt: string } }>("/api/ai/agent-plan-workflow", async (request, reply) => {
    const { prompt } = request.body;

    if (!prompt?.trim()) {
      return reply.status(400).send({ error: "Prompt is required" });
    }

    if (!isConfigured()) {
      return reply.status(400).send({
        error: "Anthropic API key not configured",
        message: "Go to Settings and add your Anthropic API key.",
      });
    }

    // Set up Server-Sent Events
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const sendEvent = (event: { type: string; data: Record<string, unknown> }) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const result = await agentPlanWorkflow(prompt, sendEvent);

      // Send the final result with the complete workflow
      sendEvent({
        type: "agent:result",
        data: {
          name: result.name,
          description: result.description,
          trigger: result.trigger as unknown as Record<string, unknown>,
          steps: result.steps as unknown as Record<string, unknown>,
          reasoning: result.reasoning,
          iterations: result.iterations,
          toolCallCount: result.toolCallCount,
        },
      });
    } catch (err) {
      sendEvent({
        type: "agent:error",
        data: { message: (err as Error).message },
      });
    } finally {
      reply.raw.end();
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

  // ── Modify Workflow via NL ──────────────────────────────

  app.post<{
    Body: {
      workflow: { name: string; description: string; trigger: unknown; steps: unknown[] };
      prompt: string;
    };
  }>("/api/ai/modify-workflow", async (request, reply) => {
    const { workflow, prompt } = request.body;

    if (!prompt?.trim()) {
      return reply.status(400).send({ error: "Prompt is required" });
    }
    if (!workflow?.steps || !Array.isArray(workflow.steps)) {
      return reply.status(400).send({ error: "Workflow with steps array is required" });
    }
    if (!isConfigured()) {
      return reply.status(400).send({ error: "Anthropic API key not configured" });
    }

    try {
      const client = getClient();
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: buildModifySystemPrompt(),
        messages: [
          {
            role: "user",
            content: `Current workflow:\n${JSON.stringify(workflow, null, 2)}\n\nUser request: ${prompt}`,
          },
        ],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? (block as { text: string }).text : ""))
        .join("");

      const result = parseFixResponse(text, workflow);
      return result;
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("401")) {
        return reply.status(401).send({ error: "Invalid API key." });
      }
      if (message.includes("429")) {
        return reply.status(429).send({ error: "Rate limited. Try again shortly." });
      }
      return reply.status(500).send({ error: `Modification failed: ${message}` });
    }
  });

  // ── Fix Workflow (with score guard) ────────────────────

  app.post<{
    Body: {
      workflow: { name: string; description: string; trigger: unknown; steps: unknown[] };
      issues: Array<{ severity: string; message: string; stepIndex?: number; stepId?: string }>;
      suggestions: Array<{ severity: string; message: string; stepIndex?: number }>;
      originalScore?: number;
    };
  }>("/api/ai/fix-workflow", async (request, reply) => {
    const { workflow, issues, suggestions, originalScore } = request.body;

    if (!workflow?.steps || !Array.isArray(workflow.steps)) {
      return reply.status(400).send({ error: "Workflow with steps array is required" });
    }

    if (!isConfigured()) {
      return reply.status(400).send({ error: "Anthropic API key not configured" });
    }

    try {
      // First fix attempt
      let fixed = await fixWorkflowPlan(workflow, issues, suggestions);

      // If caller provided originalScore, audit the fix and guard against regression
      if (originalScore !== undefined) {
        const audit = await auditWorkflowPlan({
          name: fixed.name,
          description: fixed.description,
          trigger: fixed.trigger,
          steps: fixed.steps,
        });

        if (audit.score < originalScore) {
          // Score dropped — retry once with conservative hint
          const retryFixed = await fixWorkflowPlan(
            workflow,
            issues,
            suggestions,
            "Your previous fix attempt made the quality score WORSE (dropped from " +
              originalScore + " to " + audit.score +
              "). Be more conservative this time — make minimal targeted changes that address the specific issues without introducing new problems."
          );

          const retryAudit = await auditWorkflowPlan({
            name: retryFixed.name,
            description: retryFixed.description,
            trigger: retryFixed.trigger,
            steps: retryFixed.steps,
          });

          if (retryAudit.score < originalScore) {
            // Still worse — return original with warning
            return {
              ...workflow,
              changes: [] as string[],
              warning: `Fix could not improve the workflow (score dropped from ${originalScore} to ${retryAudit.score}). Original preserved.`,
              newScore: originalScore,
              audit: null,
            };
          }

          // Retry was better
          return {
            ...retryFixed,
            newScore: retryAudit.score,
            audit: retryAudit,
          };
        }

        // First fix didn't regress — return with inline audit
        return {
          ...fixed,
          newScore: audit.score,
          audit,
        };
      }

      // No score guard — return as before
      return fixed;
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes("401")) {
        return reply.status(401).send({ error: "Invalid API key." });
      }
      if (message.includes("429")) {
        return reply.status(429).send({ error: "Rate limited. Try again shortly." });
      }
      return reply.status(500).send({ error: `Fix failed: ${message}` });
    }
  });

  // ── Audit Workflow ───────────────────────────────────────

  app.post<{ Body: { workflow: { name: string; description: string; trigger: unknown; steps: unknown[] } } }>(
    "/api/ai/audit-workflow",
    async (request, reply) => {
      const { workflow } = request.body;

      if (!workflow?.steps || !Array.isArray(workflow.steps)) {
        return reply.status(400).send({ error: "Workflow with steps array is required" });
      }

      if (!isConfigured()) {
        return reply.status(400).send({
          error: "Anthropic API key not configured",
          message: "Go to Settings and add your Anthropic API key to use AI audit.",
        });
      }

      try {
        const result = await auditWorkflowPlan(workflow);
        return result;
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes("401") || message.includes("authentication")) {
          return reply.status(401).send({ error: "Invalid API key." });
        }
        if (message.includes("429") || message.includes("rate")) {
          return reply.status(429).send({ error: "Rate limited. Try again shortly." });
        }
        return reply.status(500).send({ error: `Audit failed: ${message}` });
      }
    }
  );
}

function buildModifySystemPrompt(): string {
  return `You are a workflow editor assistant for Hive Desktop, a workflow automation platform using MCP (Model Context Protocol) tool servers.

You will receive a current workflow JSON and a natural language request from the user. Modify the workflow to fulfill the request.

## Rules
1. Make the minimum changes needed to fulfill the request.
2. Preserve existing step IDs where possible.
3. New steps should have IDs in the format "step-XXXXXXXX" (8 random chars).
4. Valid step types: mcp_call, condition, transform, delay, notify.
5. mcp_call steps need: server, tool, arguments, outputVar, onError.
6. condition steps need: condition (JS expression), outputVar, onError.
7. transform steps need: condition (JS expression), outputVar, onError.
8. delay steps need: arguments.seconds, onError.
9. notify steps need: arguments.title, arguments.message, onError.
10. Valid triggers: manual, interval (seconds), schedule (cron), webhook (path), file_watch (path, event).
11. onError values: "stop", "continue", "retry" (with retryCount and retryDelay).

## Output Format
Respond with ONLY valid JSON (no markdown fences):
{
  "name": "<workflow name>",
  "description": "<workflow description>",
  "trigger": { ... },
  "steps": [ ... ],
  "changes": ["<human-readable description of each change made>"]
}`;
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
