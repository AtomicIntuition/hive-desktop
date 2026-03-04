import type { FastifyInstance } from "fastify";
import { getDb } from "../db/index.js";
import { nanoid } from "nanoid";
import { isConfigured, setApiKey, removeApiKey, getApiKey, getClient } from "../ai/provider.js";
import { planWorkflow } from "../ai/planner.js";
import type { WorkflowPlan } from "../ai/planner.js";
import type { WorkflowAuditResult } from "@hive-desktop/shared";

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

  // ── Fix Workflow ────────────────────────────────────────

  app.post<{
    Body: {
      workflow: { name: string; description: string; trigger: unknown; steps: unknown[] };
      issues: Array<{ severity: string; message: string; stepIndex?: number; stepId?: string }>;
      suggestions: Array<{ severity: string; message: string; stepIndex?: number }>;
    };
  }>("/api/ai/fix-workflow", async (request, reply) => {
    const { workflow, issues, suggestions } = request.body;

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
        system: buildFixSystemPrompt(),
        messages: [
          {
            role: "user",
            content: JSON.stringify({ workflow, issues, suggestions }, null, 2),
          },
        ],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? (block as { text: string }).text : ""))
        .join("");

      const fixed = parseFixResponse(text, workflow);
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
        const client = getClient();
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: buildAuditSystemPrompt(),
          messages: [
            {
              role: "user",
              content: JSON.stringify(workflow, null, 2),
            },
          ],
        });

        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => ("text" in block ? (block as { text: string }).text : ""))
          .join("");

        const result = parseAuditResponse(text);
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

function buildAuditSystemPrompt(): string {
  return `You are a workflow quality auditor for Hive Desktop, a workflow automation platform that connects MCP (Model Context Protocol) tool servers.

Analyze the given workflow JSON and return a quality audit as JSON.

## What to Check
1. **Error handling**: Steps with onError "stop" should have retry alternatives for network calls (mcp_call). Missing error handling is a warning.
2. **Unused variables**: Steps that set outputVar but the variable is never referenced by subsequent steps. This is an info-level note.
3. **Missing required arguments**: mcp_call steps should have a server, tool, and reasonable arguments.
4. **Unreachable steps**: Steps after an unconditional stop that can never execute.
5. **Trigger issues**: Intervals under 60s may be too aggressive. Cron expressions should be valid.
6. **Security**: Condition/transform steps using eval-like patterns or accessing dangerous globals.
7. **Data flow**: Variables referenced via {{var}} that are never defined by any prior step's outputVar.

## Output Format
Respond with ONLY valid JSON, no markdown fences:
{
  "score": <0-100>,
  "summary": "<1-2 sentence summary>",
  "issues": [
    { "severity": "error"|"warning"|"info", "message": "<description>", "stepIndex": <0-based index or omit>, "stepId": "<step id or omit>" }
  ],
  "suggestions": [
    { "severity": "info", "message": "<improvement suggestion>", "stepIndex": <0-based index or omit> }
  ]
}

## Scoring
- Start at 100
- Each error: -15 to -25
- Each warning: -5 to -10
- Each info: -1 to -3
- Minimum score: 0

Be concise and actionable in messages. Focus on real problems, not style preferences.`;
}

function parseAuditResponse(text: string): WorkflowAuditResult {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const json = codeBlockMatch ? codeBlockMatch[1].trim() : text.match(/\{[\s\S]*\}/)?.[0] ?? "";

  try {
    const parsed = JSON.parse(json);
    return {
      score: Math.max(0, Math.min(100, parsed.score ?? 50)),
      summary: parsed.summary ?? "Audit complete.",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return {
      score: 50,
      summary: "Could not parse audit results.",
      issues: [{ severity: "warning", message: "AI response could not be parsed" }],
      suggestions: [],
    };
  }
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

function buildFixSystemPrompt(): string {
  return `You are a workflow fixer for Hive Desktop, a workflow automation platform using MCP (Model Context Protocol) tool servers.

You will receive a workflow JSON along with audit issues and suggestions. Your job is to FIX the workflow by addressing the issues.

## Rules
1. Fix all "error" severity issues. Fix "warning" issues where possible. Apply reasonable suggestions.
2. Preserve the workflow's intent — don't change what it does, just fix HOW it does it.
3. For missing error handling: add onError "retry" with retryCount 3 and retryDelay 3000 for mcp_call steps.
4. For unused variables: remove the outputVar if it's truly unused, or leave it if it might be useful.
5. For missing arguments: add reasonable defaults or placeholders.
6. For unreachable steps: remove them or restructure so they're reachable.
7. Keep all step IDs the same when possible.
8. Keep the same trigger unless the issue specifically mentions the trigger.

## Output Format
Respond with ONLY valid JSON (no markdown fences):
{
  "name": "<fixed name>",
  "description": "<fixed description>",
  "trigger": { ... },
  "steps": [ ... ],
  "changes": ["<human-readable description of each change made>"]
}

The steps array must contain complete step objects with all fields (id, name, type, onError, etc.).`;
}

function parseFixResponse(
  text: string,
  original: { name: string; description: string; trigger: unknown; steps: unknown[] }
): { name: string; description: string; trigger: unknown; steps: unknown[]; changes: string[] } {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const json = codeBlockMatch ? codeBlockMatch[1].trim() : text.match(/\{[\s\S]*\}/)?.[0] ?? "";

  try {
    const parsed = JSON.parse(json);
    return {
      name: parsed.name ?? original.name,
      description: parsed.description ?? original.description,
      trigger: parsed.trigger ?? original.trigger,
      steps: Array.isArray(parsed.steps) ? parsed.steps : original.steps,
      changes: Array.isArray(parsed.changes) ? parsed.changes : ["Applied fixes"],
    };
  } catch {
    return {
      ...original,
      changes: ["Could not parse AI fix response — no changes applied"],
    };
  }
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
