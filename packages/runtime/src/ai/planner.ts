/**
 * AI Workflow Planner — translates natural language into workflow definitions.
 *
 * Flow:
 * 1. User describes what they want ("Watch Stripe for payments over $500 and Slack me")
 * 2. Planner gathers context: installed servers, available templates
 * 3. Sends structured prompt to Claude
 * 4. Parses response into a WorkflowPlan (preview-ready)
 * 5. User reviews and confirms → workflow is created
 */

import type { WorkflowTrigger, WorkflowStep } from "@hive-desktop/shared";
import { getClient } from "./provider.js";
import { getAll as getAllServers } from "../mcp/registry.js";
import { getTemplates } from "../workflow/templates.js";

export interface WorkflowPlan {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  requiredServers: Array<{
    slug: string;
    name: string;
    installed: boolean;
  }>;
  reasoning: string;
}

/**
 * Generate a workflow plan from a natural language description.
 */
export async function planWorkflow(prompt: string): Promise<WorkflowPlan> {
  const client = getClient();

  // Gather context
  const installedServers = getAllServers();
  const installedSlugs = installedServers.map((s) => s.slug);
  const templates = getTemplates();

  const systemPrompt = buildSystemPrompt(installedSlugs, templates.map((t) => t.slug));

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extract text content
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => {
      if ("text" in block) return (block as { text: string }).text;
      return "";
    })
    .join("");

  // Parse the JSON plan from the response
  return parsePlanResponse(text, installedSlugs);
}

function buildSystemPrompt(installedSlugs: string[], templateSlugs: string[]): string {
  return `You are the Hive Desktop AI Workflow Planner. You translate natural language descriptions into structured workflow definitions.

## Your Task
Given a user's description of an automation they want, generate a complete workflow plan as JSON.

## Available MCP Servers (Known)
These are popular MCP servers that can be installed from Hive Market:
- stripe-mcp: Stripe payments (list-charges, list-customers, create-charge, etc.)
- github-mcp: GitHub (list_issues, search_issues, create_issue, list_commits, etc.)
- slack-mcp: Slack messaging (send-message, list-channels, etc.)
- brave-search-mcp: Web search (brave_web_search)
- supabase-mcp: Supabase database (list_projects, execute_sql, etc.)
- sentry-mcp: Error monitoring (list-issues, get-issue-details, etc.)
- vercel-mcp: Deployments (list-deployments, get-deployment, etc.)
- linear-mcp: Project management (list-issues, create-issue, etc.)
- notion-mcp: Knowledge base (search, get-page, create-page, etc.)
- postgres-mcp: PostgreSQL database (query, execute, etc.)
- memory-mcp: Knowledge graph (create_entities, search_nodes, etc.)

## Currently Installed Servers
${installedSlugs.length > 0 ? installedSlugs.map((s) => `- ${s}`).join("\n") : "None installed yet."}

## Available Templates
${templateSlugs.join(", ")}

## Workflow Schema

A workflow has:
- name: Short descriptive name
- description: What the workflow does (1-2 sentences)
- trigger: When it runs
- steps: Ordered list of actions

### Trigger Types
- { "type": "schedule", "cron": "<cron expression>" } — Run on schedule
- { "type": "interval", "seconds": <number> } — Run every N seconds
- { "type": "webhook", "path": "<endpoint-path>" } — HTTP trigger
- { "type": "manual" } — User-triggered
- { "type": "file_watch", "path": "<file-path>", "event": "create"|"modify"|"delete" }

### Step Types
1. **mcp_call** — Call an MCP tool
   { "id": "unique-id", "name": "Step name", "type": "mcp_call", "server": "<server-slug>", "tool": "<tool-name>", "arguments": { ... }, "outputVar": "<var-name>", "onError": "stop"|"continue"|"retry" }

2. **condition** — Evaluate a condition (false = skip remaining steps)
   { "id": "unique-id", "name": "Step name", "type": "condition", "condition": "<js-expression>", "outputVar": "<var-name>", "onError": "stop" }

3. **transform** — Compute/transform data
   { "id": "unique-id", "name": "Step name", "type": "transform", "condition": "<js-expression>", "outputVar": "<var-name>", "onError": "stop" }

4. **delay** — Wait
   { "id": "unique-id", "name": "Step name", "type": "delay", "arguments": { "seconds": <number> }, "onError": "continue" }

5. **notify** — Send notification
   { "id": "unique-id", "name": "Step name", "type": "notify", "arguments": { "title": "...", "message": "..." }, "onError": "continue" }

### Variable System
- Steps write outputs to variables via "outputVar"
- Subsequent steps reference variables using {{variableName}} or {{variableName.nested.path}}
- Template strings resolve in step arguments: "Found {{count}} items"

## Output Format
Respond with ONLY a JSON object (no markdown, no code blocks, no extra text):
{
  "name": "Workflow Name",
  "description": "What this workflow does",
  "trigger": { ... },
  "steps": [ ... ],
  "requiredServers": ["server-slug-1", "server-slug-2"],
  "reasoning": "Brief explanation of your design choices"
}

## Guidelines
- Use meaningful step IDs (e.g., "fetch-payments", "check-threshold")
- Set appropriate error handling: "retry" for network calls, "stop" for critical checks, "continue" for notifications
- Add retryCount (2-3) and retryDelay (3000-5000) for retry steps
- Use conditions to short-circuit when there's nothing to process
- Choose the most appropriate trigger type for the use case
- For intervals, use reasonable defaults (60s minimum, usually 300s+)
- For cron, use standard expressions (e.g., "0 9 * * 1-5" for weekday mornings)
- Keep workflows focused — 3-7 steps is ideal`;
}

function parsePlanResponse(text: string, installedSlugs: string[]): WorkflowPlan {
  // Try to extract JSON from the response
  let json: string;

  // Check for JSON code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    json = codeBlockMatch[1].trim();
  } else {
    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      json = jsonMatch[0];
    } else {
      throw new Error("Could not parse workflow plan from AI response");
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`Invalid JSON in AI response: ${(err as Error).message}`);
  }

  // Validate required fields
  if (!parsed.name || !parsed.trigger || !parsed.steps) {
    throw new Error("AI response missing required fields: name, trigger, steps");
  }

  const requiredServerSlugs = (parsed.requiredServers ?? []) as string[];

  return {
    name: parsed.name as string,
    description: (parsed.description as string) ?? "",
    trigger: parsed.trigger as WorkflowTrigger,
    steps: (parsed.steps as WorkflowStep[]).map((step, i) => ({
      ...step,
      id: step.id ?? `step-${i + 1}`,
      onError: step.onError ?? "stop",
    })),
    requiredServers: requiredServerSlugs.map((slug) => ({
      slug,
      name: slug.replace(/-mcp$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      installed: installedSlugs.includes(slug),
    })),
    reasoning: (parsed.reasoning as string) ?? "",
  };
}
