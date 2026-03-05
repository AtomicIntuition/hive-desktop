import { RUNTIME_URL } from "./constants.js";
import type {
  McpServer,
  McpTool,
  McpToolCallResult,
  Workflow,
  WorkflowRun,
  WorkflowAuditResult,
  WorkflowAuditItem,
  Credential,
  MarketTool,
  MarketCategory,
  ServerEnvVar,
  AgentPlanEvent,
} from "@hive-desktop/shared";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  // Only set Content-Type when there's a body — Fastify rejects empty JSON bodies
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${RUNTIME_URL}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Health ──────────────────────────────────────────

export async function checkHealth(): Promise<{
  status: string;
  version: string;
  uptime: number;
  servers: { running: number };
}> {
  return request("/api/health");
}

// ── Servers — CRUD ──────────────────────────────────

export interface ServerWithStatus extends McpServer {
  connected?: boolean;
}

export async function listServers(): Promise<ServerWithStatus[]> {
  return request("/api/servers");
}

export async function getServer(id: string): Promise<ServerWithStatus> {
  return request(`/api/servers/${id}`);
}

export async function installServer(data: {
  slug: string;
  name: string;
  description?: string;
  npmPackage: string;
  installCommand?: "npx" | "uvx";
  envVars?: ServerEnvVar[];
}): Promise<McpServer> {
  return request("/api/servers", { method: "POST", body: JSON.stringify(data) });
}

export async function removeServer(id: string): Promise<void> {
  return request(`/api/servers/${id}`, { method: "DELETE" });
}

// ── Servers — Lifecycle ─────────────────────────────

export async function startServer(id: string): Promise<{ status: string; pid?: number }> {
  return request(`/api/servers/${id}/start`, { method: "POST" });
}

export async function stopServer(id: string): Promise<{ status: string }> {
  return request(`/api/servers/${id}/stop`, { method: "POST" });
}

export async function restartServer(id: string): Promise<{ status: string; pid?: number }> {
  return request(`/api/servers/${id}/restart`, { method: "POST" });
}

// ── Servers — Tools ─────────────────────────────────

export async function listServerTools(id: string): Promise<{ tools: McpTool[] }> {
  return request(`/api/servers/${id}/tools`);
}

export async function callServerTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<McpToolCallResult> {
  return request(`/api/servers/${serverId}/tools/${encodeURIComponent(toolName)}/call`, {
    method: "POST",
    body: JSON.stringify({ arguments: args }),
  });
}

export async function connectServer(id: string): Promise<{ tools: McpTool[]; connected: boolean }> {
  return request(`/api/servers/${id}/connect`, { method: "POST" });
}

export async function disconnectServer(id: string): Promise<void> {
  return request(`/api/servers/${id}/disconnect`, { method: "POST" });
}

// ── Servers — Logs ──────────────────────────────────

export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
}

export async function getServerLogs(id: string): Promise<{ logs: LogEntry[] }> {
  return request(`/api/servers/${id}/logs`);
}

// ── Workflows — CRUD ────────────────────────────────

export async function listWorkflows(): Promise<Workflow[]> {
  return request("/api/workflows");
}

export async function getWorkflow(id: string): Promise<Workflow> {
  return request(`/api/workflows/${id}`);
}

export async function createWorkflow(data: {
  name: string;
  description?: string;
  trigger: unknown;
  steps: unknown[];
}): Promise<Workflow> {
  return request("/api/workflows", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      trigger: JSON.stringify(data.trigger),
      steps: JSON.stringify(data.steps),
    }),
  });
}

export async function updateWorkflow(
  id: string,
  data: { name?: string; description?: string; status?: string; trigger?: string; steps?: string }
): Promise<Workflow> {
  return request(`/api/workflows/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteWorkflow(id: string): Promise<void> {
  return request(`/api/workflows/${id}`, { method: "DELETE" });
}

// ── Workflows — Execution ──────────────────────────

export async function runWorkflow(id: string): Promise<{ runId: string; status: string }> {
  return request(`/api/workflows/${id}/run`, { method: "POST" });
}

export async function cancelWorkflowRun(runId: string): Promise<{ success: boolean }> {
  return request(`/api/workflows/runs/${runId}/cancel`, { method: "POST" });
}

export async function getWorkflowRun(runId: string): Promise<WorkflowRun> {
  return request(`/api/workflows/runs/${runId}`);
}

export async function listWorkflowRuns(workflowId: string, limit?: number): Promise<WorkflowRun[]> {
  const params = limit ? `?limit=${limit}` : "";
  return request(`/api/workflows/${workflowId}/runs${params}`);
}

// ── Workflows — Activation ─────────────────────────

export async function activateWorkflow(id: string): Promise<Workflow> {
  return request(`/api/workflows/${id}/activate`, { method: "POST" });
}

export async function pauseWorkflow(id: string): Promise<Workflow> {
  return request(`/api/workflows/${id}/pause`, { method: "POST" });
}

// ── Workflows — Templates ──────────────────────────

export interface WorkflowTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  requiredServers: string[];
  trigger: unknown;
  steps: unknown[];
}

export async function listWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  return request("/api/workflows/templates");
}

export async function getWorkflowTemplate(slug: string): Promise<WorkflowTemplate> {
  return request(`/api/workflows/templates/${slug}`);
}

export async function createWorkflowFromTemplate(
  slug: string,
  data?: { name?: string; variables?: Record<string, string> }
): Promise<Workflow> {
  return request(`/api/workflows/templates/${slug}/create`, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
}

// ── Vault ───────────────────────────────────────────

export async function listCredentials(): Promise<Credential[]> {
  return request("/api/vault");
}

export async function storeCredential(data: {
  name: string;
  value: string;
  serverSlug?: string;
}): Promise<Credential> {
  return request("/api/vault", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteCredential(id: string): Promise<void> {
  return request(`/api/vault/${id}`, { method: "DELETE" });
}

// ── Market ──────────────────────────────────────────

export async function searchMarketTools(params?: {
  q?: string;
  category?: string;
  sort?: string;
  limit?: number;
}): Promise<{ tools: MarketTool[]; total: number }> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.category) search.set("category", params.category);
  if (params?.sort) search.set("sort", params.sort);
  if (params?.limit) search.set("limit", String(params.limit));
  return request(`/api/market/tools?${search.toString()}`);
}

export async function getMarketTool(slug: string): Promise<MarketTool> {
  return request(`/api/market/tools/${slug}`);
}

export async function getMarketCategories(): Promise<MarketCategory[]> {
  return request("/api/market/categories");
}

// ── AI ──────────────────────────────────────────────

export async function getAiStatus(): Promise<{ configured: boolean; provider: string; model: string }> {
  return request("/api/ai/status");
}

export async function setAiApiKey(apiKey: string): Promise<{ success: boolean }> {
  return request("/api/ai/config", { method: "POST", body: JSON.stringify({ apiKey }) });
}

export async function removeAiApiKey(): Promise<{ success: boolean }> {
  return request("/api/ai/config", { method: "DELETE" });
}

export interface WorkflowPlan {
  name: string;
  description: string;
  trigger: unknown;
  steps: unknown[];
  requiredServers: Array<{ slug: string; name: string; installed: boolean }>;
  reasoning: string;
  qualityScore: number;
  auditSummary: string;
  iterationsUsed: number;
}

export async function planWorkflowAI(prompt: string): Promise<WorkflowPlan> {
  return request("/api/ai/plan-workflow", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export async function confirmWorkflowPlan(plan: WorkflowPlan): Promise<Workflow> {
  return request("/api/ai/confirm-workflow", {
    method: "POST",
    body: JSON.stringify(plan),
  });
}

export async function auditWorkflow(workflow: {
  name: string;
  description: string;
  trigger: unknown;
  steps: unknown[];
}): Promise<WorkflowAuditResult> {
  return request("/api/ai/audit-workflow", {
    method: "POST",
    body: JSON.stringify({ workflow }),
  });
}

export interface FixWorkflowResponse {
  name: string;
  description: string;
  trigger: unknown;
  steps: unknown[];
  changes: string[];
  warning?: string;
  newScore?: number;
  audit?: WorkflowAuditResult | null;
}

export async function fixWorkflow(
  workflow: { name: string; description: string; trigger: unknown; steps: unknown[] },
  issues: WorkflowAuditItem[],
  suggestions: WorkflowAuditItem[],
  originalScore?: number
): Promise<FixWorkflowResponse> {
  return request("/api/ai/fix-workflow", {
    method: "POST",
    body: JSON.stringify({ workflow, issues, suggestions, originalScore }),
  });
}

export async function modifyWorkflow(
  workflow: { name: string; description: string; trigger: unknown; steps: unknown[] },
  prompt: string
): Promise<{ name: string; description: string; trigger: unknown; steps: unknown[]; changes: string[] }> {
  return request("/api/ai/modify-workflow", {
    method: "POST",
    body: JSON.stringify({ workflow, prompt }),
  });
}

// ── Agent Plan (SSE) ─────────────────────────────────

export interface AgentPlanResult {
  name: string;
  description: string;
  trigger: unknown;
  steps: unknown[];
  reasoning: string;
  iterations: number;
  toolCallCount: number;
}

export async function agentPlanWorkflow(
  prompt: string,
  onEvent: (event: AgentPlanEvent) => void,
  signal?: AbortSignal
): Promise<AgentPlanResult | null> {
  const response = await fetch(`${RUNTIME_URL}/api/ai/agent-plan-workflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((body as Record<string, string>).error ?? `Request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AgentPlanResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as AgentPlanEvent;
          onEvent(event);

          // Capture the final result
          if (event.type === "agent:result" as string) {
            finalResult = event.data as unknown as AgentPlanResult;
          }
        } catch {
          // Skip malformed events
        }
      }
    }
  }

  return finalResult;
}
