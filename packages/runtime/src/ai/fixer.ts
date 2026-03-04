/**
 * Workflow Fixer — fixes workflow issues via AI.
 *
 * Extracted from routes/ai.ts so both routes and the planner
 * can call fix logic directly from TypeScript (no HTTP).
 */

import { getClient } from "./provider.js";

export interface FixedWorkflow {
  name: string;
  description: string;
  trigger: unknown;
  steps: unknown[];
  changes: string[];
}

/**
 * Fix a workflow's issues via Claude.
 *
 * @param workflow   The current workflow JSON.
 * @param issues     Audit issues to fix.
 * @param suggestions Audit suggestions to consider.
 * @param extraHint  Optional extra context appended to the user message
 *                   (e.g. "Your previous fix made the score worse — be more conservative").
 */
export async function fixWorkflowPlan(
  workflow: { name: string; description: string; trigger: unknown; steps: unknown[] },
  issues: Array<{ severity: string; message: string; stepIndex?: number; stepId?: string }>,
  suggestions: Array<{ severity: string; message: string; stepIndex?: number }>,
  extraHint?: string
): Promise<FixedWorkflow> {
  const client = getClient();

  let userContent = JSON.stringify({ workflow, issues, suggestions }, null, 2);
  if (extraHint) {
    userContent += `\n\n## IMPORTANT\n${extraHint}`;
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: buildFixSystemPrompt(),
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? (block as { text: string }).text : ""))
    .join("");

  return parseFixResponse(text, workflow);
}

export function buildFixSystemPrompt(): string {
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

export function parseFixResponse(
  text: string,
  original: { name: string; description: string; trigger: unknown; steps: unknown[] }
): FixedWorkflow {
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
