import type { McpServer, McpTool, Workflow, WorkflowRun } from "./types.js";

// ── WebSocket Events ───────────────────────────────────

export type ServerEvent =
  | { type: "server:status"; data: { id: string; status: McpServer["status"]; pid?: number } }
  | { type: "server:log"; data: { id: string; level: "info" | "warn" | "error"; message: string; timestamp: string } }
  | { type: "server:installed"; data: { server: McpServer } }
  | { type: "server:removed"; data: { id: string } }
  | { type: "server:tools"; data: { id: string; tools: McpTool[] } }
  | { type: "workflow:status"; data: { id: string; status: Workflow["status"] } }
  | { type: "workflow:run:start"; data: { run: WorkflowRun } }
  | { type: "workflow:run:step"; data: { runId: string; stepIndex: number; status: "running" | "completed" | "failed" } }
  | { type: "workflow:run:complete"; data: { run: WorkflowRun } }
  | { type: "runtime:ready"; data: { port: number } }
  | { type: "runtime:error"; data: { message: string } };

export type ClientEvent =
  | { type: "subscribe"; data: { channels: string[] } }
  | { type: "unsubscribe"; data: { channels: string[] } };
