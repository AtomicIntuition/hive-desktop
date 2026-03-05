/**
 * Agent-Loop Workflow Builder — iteratively builds workflows using Claude tool_use.
 *
 * Unlike the single-shot planner, this agent:
 * 1. Discovers real MCP tool schemas via listTools()
 * 2. Tests actual tool calls to see real output formats
 * 3. Validates expressions against real data
 * 4. Builds steps incrementally with verified data flow
 *
 * Uses Claude's tool_use API to give the AI access to runtime infrastructure.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { WorkflowStep, WorkflowTrigger, McpTool } from "@hive-desktop/shared";
import { getClient } from "./provider.js";
import { getAll as getAllServers } from "../mcp/registry.js";
import { mcpManager } from "../mcp/manager.js";
import { listTools, callTool, connectToServer, isConnected } from "../mcp/client.js";
import { validateExpression } from "./expression-validator.js";

// ── Types ──────────────────────────────────────────────

export interface AgentPlanEvent {
  type:
    | "agent:thinking"
    | "agent:tool_call"
    | "agent:tool_result"
    | "agent:step_added"
    | "agent:complete"
    | "agent:error";
  data: Record<string, unknown>;
}

export interface AgentPlanResult {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  reasoning: string;
  iterations: number;
  toolCallCount: number;
}

// ── Tool Definitions ───────────────────────────────────

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_installed_servers",
    description:
      "List all MCP servers installed on this machine. Returns each server's slug, name, status, and available environment variables. Use this first to see what tools are available.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_server_tools",
    description:
      "Get all available tools for a specific MCP server, including their full JSON Schema input specifications. The server must be installed. If it's not running, it will be started automatically. Use this to understand exactly what arguments each tool expects.",
    input_schema: {
      type: "object" as const,
      properties: {
        server_slug: {
          type: "string",
          description: "The slug of the MCP server (e.g., 'brave-search-mcp', 'github-mcp')",
        },
      },
      required: ["server_slug"],
    },
  },
  {
    name: "test_tool_call",
    description:
      "Actually call an MCP tool on a running server and see the REAL output. Use this to understand the exact output format before writing transform expressions that depend on it. The output will be stored in the test context so you can reference it in validate_expression.",
    input_schema: {
      type: "object" as const,
      properties: {
        server_slug: {
          type: "string",
          description: "The slug of the MCP server",
        },
        tool_name: {
          type: "string",
          description: "The tool to call",
        },
        arguments: {
          type: "object",
          description: "Arguments to pass to the tool (must match the tool's input schema)",
        },
        output_var: {
          type: "string",
          description: "Variable name to store the output under (for referencing in validate_expression)",
        },
      },
      required: ["server_slug", "tool_name"],
    },
  },
  {
    name: "validate_expression",
    description:
      "Test a JavaScript expression against the current test context (accumulated from test_tool_call outputs). Returns the evaluation result or an error. Use this to verify transform/condition expressions work with real data before adding them to the workflow. Expressions must be pure: no assignments (=), no semicolons, no variable declarations. Use chained methods (.map, .filter, .split, .join), ternary (?:), template literals, and arrow callbacks.",
    input_schema: {
      type: "object" as const,
      properties: {
        expression: {
          type: "string",
          description: "The JavaScript expression to evaluate",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "add_workflow_step",
    description:
      "Add a step to the workflow being built. Steps are appended in order. Only add a step after you have verified it works (via test_tool_call for mcp_call steps, or validate_expression for transform/condition steps).",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Unique step ID (e.g., 'search-news', 'filter-results')" },
        name: { type: "string", description: "Human-readable step name" },
        type: {
          type: "string",
          enum: ["mcp_call", "condition", "transform", "delay", "notify"],
          description: "Step type",
        },
        server: { type: "string", description: "MCP server slug (required for mcp_call)" },
        tool: { type: "string", description: "Tool name (required for mcp_call)" },
        arguments: { type: "object", description: "Step arguments (for mcp_call, delay, notify)" },
        expression: { type: "string", description: "JS expression (for transform steps)" },
        condition: { type: "string", description: "JS expression (for condition steps)" },
        outputVar: { type: "string", description: "Variable name to store step output" },
        onError: {
          type: "string",
          enum: ["stop", "continue", "retry"],
          description: "Error handling strategy",
        },
        retryCount: { type: "number", description: "Number of retries (when onError is retry)" },
        retryDelay: { type: "number", description: "Delay between retries in ms" },
      },
      required: ["id", "name", "type"],
    },
  },
  {
    name: "finalize_workflow",
    description:
      "Finalize and save the workflow. Call this only when all steps are built and verified. The workflow will be returned to the user for review.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Workflow name" },
        description: { type: "string", description: "What the workflow does (1-2 sentences)" },
        trigger: {
          type: "object",
          description:
            'Trigger configuration. Examples: {"type":"manual"}, {"type":"interval","seconds":300}, {"type":"schedule","cron":"0 9 * * 1-5"}',
        },
        reasoning: { type: "string", description: "Brief explanation of design choices" },
      },
      required: ["name", "description", "trigger"],
    },
  },
];

// ── System Prompt ──────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are the Hive Desktop AI Workflow Builder. You build reliable, tested workflows by iteratively discovering tools, testing them, and verifying data flow.

## Your Approach
1. First, call list_installed_servers to see what MCP servers are available
2. Call get_server_tools to see the exact tools and their input schemas
3. Test tool calls with test_tool_call to see REAL output formats
4. Build each step based on verified data, using add_workflow_step
5. For transform/condition steps, validate expressions with validate_expression
6. When all steps are built and verified, call finalize_workflow

## Critical Rules
- ALWAYS test a tool call before adding an mcp_call step — you need to see the real output format
- ALWAYS validate expressions before adding transform/condition steps
- Steps execute sequentially. A condition that returns false skips ALL remaining steps.
- Transform expressions must be pure: no assignments (=), no semicolons, no var/let/const. Use chained methods, ternary, template literals.
- For mcp_call steps, ALWAYS set onError to "retry" with retryCount 2-3 and retryDelay 3000-5000
- Every workflow should end with a notify step so the user sees results
- Keep workflows focused: 3-7 steps is ideal
- Use meaningful step IDs like "search-news" not "step-1"

## Variable System
- Steps write outputs via outputVar
- Subsequent steps reference variables using {{variableName}} in arguments
- Transform/condition expressions access variables directly by name (no {{ }})

## Trigger Types
- manual: User-triggered
- interval: { type: "interval", seconds: 300 } — every N seconds (min 60)
- schedule: { type: "schedule", cron: "0 9 * * 1-5" } — cron expression
- webhook: { type: "webhook", path: "/my-hook" }
- file_watch: { type: "file_watch", path: "/path", event: "create"|"modify"|"delete" }`;

// ── Agent Loop ─────────────────────────────────────────

const MAX_ITERATIONS = 25;

export async function agentPlanWorkflow(
  prompt: string,
  onProgress: (event: AgentPlanEvent) => void
): Promise<AgentPlanResult> {
  const client = getClient();
  const builtSteps: WorkflowStep[] = [];
  const testContext: Record<string, unknown> = {};
  let toolCallCount = 0;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  let finalized: { name: string; description: string; trigger: WorkflowTrigger; reasoning: string } | null = null;
  let iterations = 0;

  while (!finalized && iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: AGENT_SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
    });

    // Collect assistant content and process tool uses
    const assistantContent: Anthropic.ContentBlock[] = [];
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      assistantContent.push(block);

      if (block.type === "text" && block.text.trim()) {
        onProgress({
          type: "agent:thinking",
          data: { text: block.text, iteration: iterations },
        });
      }

      if (block.type === "tool_use") {
        toolCallCount++;
        const input = block.input as Record<string, unknown>;

        onProgress({
          type: "agent:tool_call",
          data: { tool: block.name, input, iteration: iterations },
        });

        const result = await executeAgentTool(
          block.name,
          input,
          builtSteps,
          testContext,
          onProgress
        );

        onProgress({
          type: "agent:tool_result",
          data: {
            tool: block.name,
            result: truncateForEvent(result),
            iteration: iterations,
          },
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });

        if (block.name === "finalize_workflow") {
          const r = result as Record<string, unknown>;
          if (r.success) {
            finalized = {
              name: input.name as string,
              description: input.description as string,
              trigger: input.trigger as WorkflowTrigger,
              reasoning: (input.reasoning as string) ?? "",
            };
          }
        }
      }
    }

    // Add to conversation history
    messages.push({ role: "assistant", content: assistantContent });

    if (toolResults.length > 0) {
      messages.push({ role: "user", content: toolResults });
    }

    // If Claude stopped without using tools and hasn't finalized, nudge it
    if (response.stop_reason === "end_turn" && !finalized) {
      if (builtSteps.length > 0) {
        messages.push({
          role: "user",
          content:
            "You have built steps but haven't finalized. Please call finalize_workflow to complete the workflow, or add more steps if needed.",
        });
      }
    }
  }

  if (!finalized) {
    // Force finalize with what we have
    if (builtSteps.length > 0) {
      finalized = {
        name: "Custom Workflow",
        description: "AI-built workflow",
        trigger: { type: "manual" } as WorkflowTrigger,
        reasoning: "Agent reached max iterations — finalizing with built steps.",
      };
    } else {
      throw new Error("Agent could not build a workflow within the iteration limit. Try a more specific prompt.");
    }
  }

  const result: AgentPlanResult = {
    ...finalized,
    steps: builtSteps,
    iterations,
    toolCallCount,
  };

  onProgress({
    type: "agent:complete",
    data: {
      name: result.name,
      description: result.description,
      stepCount: builtSteps.length,
      iterations,
      toolCallCount,
    },
  });

  return result;
}

// ── Tool Execution ─────────────────────────────────────

async function executeAgentTool(
  toolName: string,
  input: Record<string, unknown>,
  builtSteps: WorkflowStep[],
  testContext: Record<string, unknown>,
  onProgress: (event: AgentPlanEvent) => void
): Promise<unknown> {
  switch (toolName) {
    case "list_installed_servers":
      return handleListServers();

    case "get_server_tools":
      return handleGetServerTools(input.server_slug as string);

    case "test_tool_call":
      return handleTestToolCall(
        input.server_slug as string,
        input.tool_name as string,
        (input.arguments as Record<string, unknown>) ?? {},
        input.output_var as string | undefined,
        testContext
      );

    case "validate_expression":
      return handleValidateExpression(input.expression as string, testContext);

    case "add_workflow_step":
      return handleAddStep(input, builtSteps, onProgress);

    case "finalize_workflow":
      return handleFinalize(input, builtSteps);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function handleListServers(): Promise<unknown> {
  const servers = getAllServers();
  return {
    servers: servers.map((s) => ({
      slug: s.slug,
      name: s.name,
      status: s.status,
      description: s.description,
      hasEnvVars: (s.envVars ?? []).length > 0,
    })),
    count: servers.length,
  };
}

async function handleGetServerTools(slug: string): Promise<unknown> {
  try {
    const serverId = mcpManager.resolveId(slug);
    if (!serverId) {
      return { error: `Server '${slug}' is not installed. Use list_installed_servers to see available servers.` };
    }

    // Ensure server is running
    const managed = mcpManager.get(serverId);
    if (!managed || managed.status !== "running") {
      await mcpManager.start(serverId);
      // Wait for startup
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Connect and get tools
    if (!isConnected(serverId)) {
      await connectToServer(serverId);
    }

    const tools = await listTools(serverId);
    return {
      server: slug,
      tools: tools.map((t: McpTool) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
      toolCount: tools.length,
    };
  } catch (err) {
    return { error: `Failed to get tools for ${slug}: ${(err as Error).message}` };
  }
}

async function handleTestToolCall(
  slug: string,
  toolName: string,
  args: Record<string, unknown>,
  outputVar: string | undefined,
  testContext: Record<string, unknown>
): Promise<unknown> {
  try {
    const serverId = mcpManager.resolveId(slug);
    if (!serverId) {
      return { error: `Server '${slug}' is not installed.` };
    }

    // Ensure ready
    const managed = mcpManager.get(serverId);
    if (!managed || managed.status !== "running") {
      await mcpManager.start(serverId);
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!isConnected(serverId)) {
      await connectToServer(serverId);
    }

    const result = await callTool(serverId, toolName, args);

    // Extract text output
    const textContent = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n");

    // Try JSON parse
    let output: unknown;
    try {
      output = JSON.parse(textContent);
    } catch {
      output = textContent;
    }

    // Store in test context
    const varName = outputVar ?? `testOutput_${Date.now()}`;
    testContext[varName] = output;

    // Truncate for response if very large
    const outputStr = typeof output === "string" ? output : JSON.stringify(output);
    const truncated = outputStr.length > 3000 ? outputStr.slice(0, 3000) + "\n... (truncated)" : outputStr;

    return {
      success: true,
      outputVar: varName,
      outputType: typeof output,
      isArray: Array.isArray(output),
      output: truncated,
      rawLength: outputStr.length,
      hint:
        typeof output === "string"
          ? "Output is a plain text string. Use .split(), .includes(), .startsWith() for parsing."
          : Array.isArray(output)
            ? `Output is an array with ${(output as unknown[]).length} items.`
            : typeof output === "object" && output !== null
              ? `Output is an object with keys: ${Object.keys(output as Record<string, unknown>).join(", ")}`
              : `Output is a ${typeof output}.`,
    };
  } catch (err) {
    return { error: `Tool call failed: ${(err as Error).message}` };
  }
}

function handleValidateExpression(
  expression: string,
  testContext: Record<string, unknown>
): unknown {
  try {
    validateExpression(expression);

    const keys = Object.keys(testContext);
    const values = Object.values(testContext);
    const fn = new Function(...keys, `"use strict"; return (${expression})`);
    const result = fn(...values);

    // Summarize result
    const resultStr = typeof result === "string" ? result : JSON.stringify(result);
    const truncated = resultStr && resultStr.length > 2000 ? resultStr.slice(0, 2000) + "... (truncated)" : resultStr;

    return {
      success: true,
      resultType: typeof result,
      isArray: Array.isArray(result),
      result: truncated,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
      hint: "Expressions must be pure: no assignments (=), no semicolons, no var/let/const. Use .map(), .filter(), .split(), ternary (?:), template literals.",
    };
  }
}

function handleAddStep(
  input: Record<string, unknown>,
  builtSteps: WorkflowStep[],
  onProgress: (event: AgentPlanEvent) => void
): unknown {
  const step: WorkflowStep = {
    id: (input.id as string) ?? `step-${builtSteps.length + 1}`,
    name: (input.name as string) ?? "Unnamed step",
    type: (input.type as WorkflowStep["type"]) ?? "transform",
    server: input.server as string | undefined,
    tool: input.tool as string | undefined,
    arguments: input.arguments as Record<string, unknown> | undefined,
    condition: input.condition as string | undefined,
    expression: input.expression as string | undefined,
    outputVar: input.outputVar as string | undefined,
    onError: (input.onError as WorkflowStep["onError"]) ?? "stop",
    retryCount: input.retryCount as number | undefined,
    retryDelay: input.retryDelay as number | undefined,
  };

  builtSteps.push(step);

  onProgress({
    type: "agent:step_added",
    data: { step, index: builtSteps.length - 1 },
  });

  return {
    success: true,
    stepIndex: builtSteps.length - 1,
    totalSteps: builtSteps.length,
    message: `Step "${step.name}" added at index ${builtSteps.length - 1}.`,
  };
}

function handleFinalize(
  input: Record<string, unknown>,
  builtSteps: WorkflowStep[]
): unknown {
  if (builtSteps.length === 0) {
    return {
      success: false,
      error: "Cannot finalize — no steps have been added. Use add_workflow_step first.",
    };
  }

  return {
    success: true,
    name: input.name,
    description: input.description,
    trigger: input.trigger,
    stepCount: builtSteps.length,
    message: `Workflow "${input.name}" finalized with ${builtSteps.length} steps.`,
  };
}

// ── Helpers ────────────────────────────────────────────

function truncateForEvent(data: unknown): unknown {
  const str = JSON.stringify(data);
  if (str.length <= 1000) return data;
  // Return a summary for large results
  if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    return { ...d, _truncated: true, _originalSize: str.length };
  }
  return { _truncated: true, _originalSize: str.length };
}
