/**
 * Workflow Auditor — validates workflow quality via AI.
 *
 * Extracted from routes/ai.ts so both routes and the planner
 * can call audit logic directly from TypeScript (no HTTP).
 */

import type { WorkflowAuditResult } from "@hive-desktop/shared";
import { getClient } from "./provider.js";

/**
 * Audit a workflow plan via Claude and return structured results.
 */
export async function auditWorkflowPlan(workflow: {
  name: string;
  description: string;
  trigger: unknown;
  steps: unknown[];
}): Promise<WorkflowAuditResult> {
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

  return parseAuditResponse(text);
}

export function buildAuditSystemPrompt(): string {
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

export function parseAuditResponse(text: string): WorkflowAuditResult {
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
