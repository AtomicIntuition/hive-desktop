/**
 * Workflow step executor — dispatches each step type to its handler.
 *
 * Step types:
 * - mcp_call:   Call an MCP tool on a connected server
 * - condition:  Evaluate a JS expression, skip remaining steps if false
 * - transform:  Run a JS expression to transform/compute data
 * - delay:      Wait for a specified duration
 * - notify:     Log a notification (extensible for desktop notifications)
 */

import type { WorkflowStep, McpToolCallResult } from "@hive-desktop/shared";
import { callTool, connectToServer, isConnected } from "../mcp/client.js";
import { mcpManager } from "../mcp/manager.js";
import type { WorkflowContext } from "./context.js";

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  skipped?: boolean;
}

/**
 * Execute a single workflow step within the given context.
 */
export async function executeStep(
  step: WorkflowStep,
  context: WorkflowContext
): Promise<StepResult> {
  switch (step.type) {
    case "mcp_call":
      return executeMcpCall(step, context);
    case "condition":
      return executeCondition(step, context);
    case "transform":
      return executeTransform(step, context);
    case "delay":
      return executeDelay(step, context);
    case "notify":
      return executeNotify(step, context);
    default:
      return { success: false, error: `Unknown step type: ${(step as WorkflowStep).type}` };
  }
}

// ── MCP Call ─────────────────────────────────────────────

async function executeMcpCall(
  step: WorkflowStep,
  context: WorkflowContext
): Promise<StepResult> {
  const { server, tool, arguments: rawArgs } = step;

  if (!server || !tool) {
    return { success: false, error: "mcp_call requires 'server' and 'tool'" };
  }

  // Resolve template variables in arguments
  const resolvedArgs = rawArgs ? context.resolve(rawArgs) : {};

  try {
    // Ensure server is running and connected
    await ensureServerReady(server);

    // Call the tool
    const result: McpToolCallResult = await callTool(server, tool, resolvedArgs as Record<string, unknown>);

    if (result.isError) {
      const errorText = result.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n");
      return { success: false, error: errorText || "Tool returned an error", output: result };
    }

    // Extract output — prefer text content for variable storage
    const textContent = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");

    // Try to parse as JSON for structured data
    let output: unknown;
    try {
      output = JSON.parse(textContent);
    } catch {
      output = textContent;
    }

    // Store in context if outputVar specified
    if (step.outputVar) {
      context.set(step.outputVar, output);
    }

    return { success: true, output };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function ensureServerReady(serverId: string): Promise<void> {
  const managed = mcpManager.get(serverId);

  if (!managed) {
    throw new Error(`Server ${serverId} is not installed`);
  }

  // Start if stopped
  if (managed.status === "stopped" || managed.status === "error") {
    await mcpManager.start(serverId);
    // Wait a bit for process to stabilize
    await sleep(1000);
  }

  // Connect if not connected
  if (!isConnected(serverId)) {
    await connectToServer(serverId);
  }
}

// ── Condition ────────────────────────────────────────────

async function executeCondition(
  step: WorkflowStep,
  context: WorkflowContext
): Promise<StepResult> {
  const { condition } = step;

  if (!condition) {
    return { success: false, error: "condition step requires 'condition' expression" };
  }

  try {
    const vars = context.toJSON();
    // Build a safe evaluation scope
    const fn = new Function(...Object.keys(vars), `return Boolean(${condition})`);
    const result = fn(...Object.values(vars));

    if (step.outputVar) {
      context.set(step.outputVar, result);
    }

    return { success: true, output: result, skipped: !result };
  } catch (err) {
    return { success: false, error: `Condition evaluation failed: ${(err as Error).message}` };
  }
}

// ── Transform ────────────────────────────────────────────

async function executeTransform(
  step: WorkflowStep,
  context: WorkflowContext
): Promise<StepResult> {
  const { condition: expression } = step;

  if (!expression) {
    return { success: false, error: "transform step requires a 'condition' field with the JS expression" };
  }

  try {
    const vars = context.toJSON();
    const fn = new Function(...Object.keys(vars), `return (${expression})`);
    const result = fn(...Object.values(vars));

    if (step.outputVar) {
      context.set(step.outputVar, result);
    }

    return { success: true, output: result };
  } catch (err) {
    return { success: false, error: `Transform evaluation failed: ${(err as Error).message}` };
  }
}

// ── Delay ────────────────────────────────────────────────

async function executeDelay(
  step: WorkflowStep,
  context: WorkflowContext
): Promise<StepResult> {
  // Get delay from arguments or default 1s
  const resolvedArgs = step.arguments ? context.resolve(step.arguments) : {};
  const seconds = (resolvedArgs as Record<string, unknown>).seconds;
  const delayMs = (typeof seconds === "number" ? seconds : 1) * 1000;

  await sleep(delayMs);

  return { success: true, output: { delayed: delayMs } };
}

// ── Notify ───────────────────────────────────────────────

async function executeNotify(
  step: WorkflowStep,
  context: WorkflowContext
): Promise<StepResult> {
  const resolvedArgs = step.arguments ? context.resolve(step.arguments) : {};
  const { message, title, channel } = resolvedArgs as Record<string, unknown>;

  const notification = {
    title: (title as string) ?? step.name,
    message: (message as string) ?? "Workflow notification",
    channel: (channel as string) ?? "log",
    timestamp: new Date().toISOString(),
  };

  // Log the notification — in Phase 5, this could trigger desktop notifications via Tauri
  console.log(`[workflow:notify] ${notification.title}: ${notification.message}`);

  if (step.outputVar) {
    context.set(step.outputVar, notification);
  }

  return { success: true, output: notification };
}

// ── Helpers ──────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
