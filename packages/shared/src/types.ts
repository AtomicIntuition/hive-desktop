// ── MCP Server ──────────────────────────────────────────

export interface McpServer {
  id: string;
  slug: string;
  name: string;
  description: string;
  npmPackage?: string;
  installCommand: "npx" | "uvx";
  status: ServerStatus;
  pid?: number;
  port?: number;
  config?: Record<string, unknown>;
  envVars?: ServerEnvVar[];
  installedAt: string;
  lastStartedAt?: string;
}

export type ServerStatus = "stopped" | "running" | "error" | "installing";

export interface ServerEnvVar {
  name: string;
  description: string;
  required: boolean;
  placeholder?: string;
}

// ── Workflow ────────────────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
  errorCount: number;
}

export type WorkflowStatus = "active" | "paused" | "draft" | "error";

export type WorkflowTrigger =
  | { type: "schedule"; cron: string }
  | { type: "interval"; seconds: number }
  | { type: "webhook"; path: string }
  | { type: "manual" }
  | { type: "file_watch"; path: string; event: "create" | "modify" | "delete" };

export interface WorkflowStep {
  id: string;
  name: string;
  type: "mcp_call" | "condition" | "transform" | "delay" | "notify";
  server?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  condition?: string;
  outputVar?: string;
  onError: "stop" | "continue" | "retry";
  retryCount?: number;
  retryDelay?: number;
}

// ── Workflow Run ────────────────────────────────────────

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
  stepsExecuted: number;
}

// ── Vault / Credentials ────────────────────────────────

export interface Credential {
  id: string;
  name: string;
  serverSlug?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Hive Market Types ──────────────────────────────────

export interface MarketTool {
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  tags: string[];
  features: string[];
  version: string;
  npmPackage?: string;
  installCommand?: "npx" | "uvx";
  envVars?: ServerEnvVar[];
  pricing: {
    model: "free" | "per-call" | "monthly" | "tiered";
    price?: number;
    unit?: string;
  };
  rating?: number;
  reviewCount?: number;
  compatibility: string[];
  githubUrl?: string;
  docsUrl?: string;
}

export interface MarketCategory {
  slug: string;
  name: string;
  description: string;
  toolCount: number;
}

export interface MarketStack {
  slug: string;
  name: string;
  description: string;
  tools: string[];
}

// ── MCP Tool ───────────────────────────────────────────

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: McpToolContent[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

export type McpToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: { uri: string; text?: string } };

// ── Server Log ─────────────────────────────────────────

export interface ServerLog {
  id: string;
  serverId: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
}

// ── Dashboard Stats ────────────────────────────────────

export interface DashboardStats {
  activeWorkflows: number;
  runningServers: number;
  totalRuns: number;
  errorRate: number;
}

// ── Settings ───────────────────────────────────────────

export interface AppSettings {
  runtimePort: number;
  anthropicApiKey?: string;
  hiveMarketUrl: string;
  theme: "dark";
  autoStartRuntime: boolean;
  minimizeToTray: boolean;
}
