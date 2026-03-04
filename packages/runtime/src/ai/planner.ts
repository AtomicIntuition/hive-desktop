/**
 * AI Workflow Planner — translates natural language into workflow definitions.
 *
 * Flow:
 * 1. User describes what they want ("Watch Stripe for payments over $500 and Slack me")
 * 2. Planner gathers context: installed servers, available templates
 * 3. Sends structured prompt to Claude
 * 4. Parses response into a WorkflowPlan (preview-ready)
 * 5. Self-validates: audit → fix → re-audit (max 2 iterations)
 * 6. User reviews and confirms → workflow is created
 */

import type { WorkflowTrigger, WorkflowStep } from "@hive-desktop/shared";
import { getClient } from "./provider.js";
import { getAll as getAllServers } from "../mcp/registry.js";
import { getTemplates } from "../workflow/templates.js";
import { auditWorkflowPlan } from "./auditor.js";
import { fixWorkflowPlan } from "./fixer.js";

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
  qualityScore: number;
  auditSummary: string;
  iterationsUsed: number;
}

const QUALITY_THRESHOLD = 90;
const MAX_ITERATIONS = 2;

/**
 * Generate a workflow plan from a natural language description.
 * Self-validates via audit/fix loop for quality assurance.
 */
export async function planWorkflow(prompt: string): Promise<WorkflowPlan> {
  const client = getClient();

  // Gather context
  const installedServers = getAllServers();
  const installedSlugs = installedServers.map((s) => s.slug);
  const templates = getTemplates();

  const systemPrompt = buildSystemPrompt(installedSlugs, templates.map((t) => t.slug));

  // Step 1: Generate initial plan
  const basePlan = await generatePlan(client, systemPrompt, prompt, installedSlugs);

  // Step 2: Self-validate via audit/fix loop
  let bestPlan = basePlan;
  let bestScore = 0;
  let iterationsUsed = 0;

  try {
    const audit = await auditWorkflowPlan({
      name: basePlan.name,
      description: basePlan.description,
      trigger: basePlan.trigger,
      steps: basePlan.steps,
    });

    bestScore = audit.score;
    bestPlan = { ...basePlan, qualityScore: audit.score, auditSummary: audit.summary };

    const hasErrors = audit.issues.some((i) => i.severity === "error");

    if ((audit.score < QUALITY_THRESHOLD || hasErrors) && (audit.issues.length > 0 || audit.suggestions.length > 0)) {
      // Iteration 1: Fix issues
      iterationsUsed = 1;

      try {
        const fixed = await fixWorkflowPlan(
          { name: basePlan.name, description: basePlan.description, trigger: basePlan.trigger, steps: basePlan.steps },
          audit.issues,
          audit.suggestions
        );

        const fixedAudit = await auditWorkflowPlan({
          name: fixed.name,
          description: fixed.description,
          trigger: fixed.trigger,
          steps: fixed.steps,
        });

        if (fixedAudit.score >= bestScore) {
          // Fix improved or maintained score — use it
          bestScore = fixedAudit.score;
          bestPlan = {
            ...basePlan,
            name: fixed.name as string,
            description: fixed.description as string,
            trigger: fixed.trigger as WorkflowTrigger,
            steps: fixed.steps as WorkflowStep[],
            qualityScore: fixedAudit.score,
            auditSummary: fixedAudit.summary,
          };
        } else if (fixedAudit.score < bestScore) {
          // Fix made it worse — retry with conservative hint
          iterationsUsed = 2;

          try {
            const retryFixed = await fixWorkflowPlan(
              { name: basePlan.name, description: basePlan.description, trigger: basePlan.trigger, steps: basePlan.steps },
              audit.issues,
              audit.suggestions,
              "Your previous fix attempt made the quality score WORSE. Be more conservative — make minimal targeted changes that address only the specific errors and warnings."
            );

            const retryAudit = await auditWorkflowPlan({
              name: retryFixed.name,
              description: retryFixed.description,
              trigger: retryFixed.trigger,
              steps: retryFixed.steps,
            });

            if (retryAudit.score > bestScore) {
              bestScore = retryAudit.score;
              bestPlan = {
                ...basePlan,
                name: retryFixed.name as string,
                description: retryFixed.description as string,
                trigger: retryFixed.trigger as WorkflowTrigger,
                steps: retryFixed.steps as WorkflowStep[],
                qualityScore: retryAudit.score,
                auditSummary: retryAudit.summary,
              };
            }
          } catch {
            // Retry failed — keep best so far
          }
        }
      } catch {
        // Fix failed — keep original with audit score
      }
    }
  } catch {
    // Audit failed — return plan without quality score
    bestPlan = { ...basePlan, qualityScore: 0, auditSummary: "Audit unavailable" };
  }

  return { ...bestPlan, iterationsUsed };
}

/**
 * Generate a raw plan from Claude (no validation).
 */
async function generatePlan(
  client: ReturnType<typeof getClient>,
  systemPrompt: string,
  prompt: string,
  installedSlugs: string[]
): Promise<WorkflowPlan> {
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
  return { ...parsePlanResponse(text, installedSlugs), qualityScore: 0, auditSummary: "", iterationsUsed: 0 };
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
- brave-search-mcp: Web search (brave_web_search) — IMPORTANT: returns a PLAIN TEXT string (not JSON). Each result has "Title: ...\nDescription: ...\nURL: ...\n\n" format. To extract titles use: searchResults.split("\\n").filter(line => line.startsWith("Title: ")).map((line, i) => (i + 1) + ". " + line.replace("Title: ", "")).join("\\n")
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

2. **condition** — Evaluate a condition (false = skip ALL remaining steps in the workflow)
   { "id": "unique-id", "name": "Step name", "type": "condition", "condition": "<js-expression>", "outputVar": "<var-name>", "onError": "stop" }
   IMPORTANT: Conditions do NOT support branching (no trueSteps/falseSteps/onTrue/onFalse). If the condition returns false, all subsequent steps are skipped. Design your workflow as a flat sequential pipeline.

3. **transform** — Compute/transform data
   { "id": "unique-id", "name": "Step name", "type": "transform", "expression": "<js-expression>", "outputVar": "<var-name>", "onError": "stop" }
   NOTE: Use "expression" field (not "condition") for transform steps.
   CRITICAL: Expressions are sandboxed — NO variable assignments (const/let/var x = ...), NO semicolons, NO IIFEs, NO try/catch. Write a single pure expression using chained methods (.map(), .filter(), .join(), .slice()), ternary (?:), template literals, and arrow callbacks (=> is allowed in callbacks). Good: searchResults.split("\\n").filter(line => line.startsWith("Title: ")).map((line, i) => (i+1) + ". " + line.replace("Title: ", "")).join("\\n")

4. **delay** — Wait
   { "id": "unique-id", "name": "Step name", "type": "delay", "arguments": { "seconds": <number> }, "onError": "continue" }

5. **notify** — Send notification
   { "id": "unique-id", "name": "Step name", "type": "notify", "arguments": { "title": "...", "message": "..." }, "onError": "continue" }

### Variable System
- Steps write outputs to variables via "outputVar"
- Subsequent steps reference variables using {{variableName}} or {{variableName.nested.path}}
- Template strings resolve in step arguments: "Found {{count}} items"

## Output Format
You MUST respond with ONLY valid JSON. No markdown fences, no code blocks, no backticks, no prose before or after.
Every string value MUST use double quotes ("). Never use backticks (\`) or single quotes (') for JSON string values.

Example structure:
{"name":"Workflow Name","description":"What this workflow does","trigger":{...},"steps":[...],"requiredServers":["server-slug-1","server-slug-2"],"reasoning":"Brief explanation of your design choices"}

## Quality Requirements (CRITICAL)
Your workflow will be automatically audited. To pass quality checks:
1. ALL mcp_call steps MUST have onError "retry" with retryCount (2-3) and retryDelay (3000-5000). Network calls fail — always retry.
2. No orphaned outputVars — every variable set by a step's outputVar must be referenced by at least one subsequent step via {{varName}}.
3. Complete data flow — every {{varName}} reference must be defined by a prior step's outputVar.
4. The workflow must produce user-visible output — include at least one notify step or a final transform that surfaces results.
5. Use meaningful step IDs (e.g., "fetch-payments", "check-threshold"), not generic ones.

## CRITICAL RULES
- The "steps" array MUST be flat — NO nested steps. No trueSteps, falseSteps, onTrue, onFalse, or any branching.
- All steps execute sequentially. A "condition" step that returns false skips ALL remaining steps.
- Transform steps use "expression" (not "condition") for their JS expression.
- ALL expressions (condition and transform) are sandboxed: NO assignments (=), NO semicolons, NO try/catch, NO IIFEs. Write single pure expressions only.
- MCP tool outputs may be plain text strings, not JSON objects. Use .split(), .includes(), .startsWith() for text parsing.

## Guidelines
- Set appropriate error handling: "retry" for network calls, "stop" for critical checks, "continue" for notifications
- Use conditions to short-circuit when there's nothing to process
- Choose the most appropriate trigger type for the use case
- For intervals, use reasonable defaults (60s minimum, usually 300s+)
- For cron, use standard expressions (e.g., "0 9 * * 1-5" for weekday mornings)
- Keep workflows focused — 3-7 steps is ideal`;
}

/**
 * Flatten nested branching steps into a sequential array.
 * AI sometimes generates trueSteps/falseSteps/onTrue/onFalse — extract those inline.
 */
function flattenSteps(steps: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const flat: Array<Record<string, unknown>>[] = [];

  for (const step of steps) {
    // Strip branching properties and keep the condition step itself
    const { trueSteps, falseSteps, onTrue, onFalse, ...cleanStep } = step;
    flat.push([cleanStep]);

    // Inline nested steps (true branch first, then false branch)
    const branches = [trueSteps, onTrue, falseSteps, onFalse].filter(Boolean);
    for (const branch of branches) {
      if (Array.isArray(branch)) {
        flat.push(flattenSteps(branch as Array<Record<string, unknown>>));
      }
    }
  }

  return flat.flat();
}

function parsePlanResponse(text: string, installedSlugs: string[]): Omit<WorkflowPlan, "qualityScore" | "auditSummary" | "iterationsUsed"> {
  // Try to extract JSON from the response
  let json: string;

  // Strip markdown code fences if present
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    json = codeBlockMatch[1].trim();
  } else {
    // Try to find raw JSON object (use non-greedy match from first { to balanced })
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
  } catch {
    // Claude sometimes uses backtick-quoted strings instead of double-quoted.
    // Replace backtick-delimited values with double-quoted values:
    // Pattern: a colon/comma/[ followed by optional whitespace then `...`
    const sanitized = json.replace(/(?<=[:,\[]\s*)`([^`]*)`/g, (_m, inner) => {
      // Escape any unescaped double quotes inside the value
      const escaped = inner.replace(/(?<!\\)"/g, '\\"');
      return `"${escaped}"`;
    });

    try {
      parsed = JSON.parse(sanitized);
    } catch (err2) {
      throw new Error(`Invalid JSON in AI response: ${(err2 as Error).message}`);
    }
  }

  // Validate required fields
  if (!parsed.name || !parsed.trigger || !parsed.steps) {
    throw new Error("AI response missing required fields: name, trigger, steps");
  }

  const requiredServerSlugs = (parsed.requiredServers ?? []) as string[];

  // Flatten any nested branching steps (trueSteps/falseSteps/onTrue/onFalse)
  const rawSteps = parsed.steps as Array<Record<string, unknown>>;
  const flatSteps = flattenSteps(rawSteps);

  return {
    name: parsed.name as string,
    description: (parsed.description as string) ?? "",
    trigger: parsed.trigger as WorkflowTrigger,
    steps: flatSteps.map((step, i) => ({
      ...step,
      id: step.id ?? `step-${i + 1}`,
      onError: step.onError ?? "stop",
    })) as WorkflowStep[],
    requiredServers: requiredServerSlugs.map((slug) => ({
      slug,
      name: slug.replace(/-mcp$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      installed: installedSlugs.includes(slug),
    })),
    reasoning: (parsed.reasoning as string) ?? "",
  };
}
