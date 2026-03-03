import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { serverRoutes } from "./routes/servers.js";
import { workflowRoutes } from "./routes/workflows.js";
import { vaultRoutes } from "./routes/vault.js";
import { marketRoutes } from "./routes/market.js";
import { aiRoutes } from "./routes/ai.js";
import { mcpManager } from "./mcp/manager.js";
import type { ServerEvent } from "@hive-desktop/shared";
import type { ServerStatus } from "@hive-desktop/shared";
import type { WebSocket } from "ws";

const connectedClients = new Set<WebSocket>();

export function broadcast(event: ServerEvent): void {
  const message = JSON.stringify(event);
  for (const client of connectedClients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

export async function createServer(port: number = 45678) {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // ── WebSocket ─────────────────────────────────────────

  app.get("/ws", { websocket: true }, (socket) => {
    connectedClients.add(socket);

    socket.on("close", () => {
      connectedClients.delete(socket);
    });

    socket.on("error", () => {
      connectedClients.delete(socket);
    });

    socket.send(JSON.stringify({ type: "runtime:ready", data: { port } }));
  });

  // ── MCP Manager Events → WebSocket broadcast ─────────

  mcpManager.on("status", (data: { id: string; status: ServerStatus; pid?: number }) => {
    broadcast({ type: "server:status", data });
  });

  mcpManager.on("log", (data: { id: string; level: "info" | "warn" | "error"; message: string; timestamp: string }) => {
    broadcast({ type: "server:log", data });
  });

  // ── Health ────────────────────────────────────────────

  app.get("/api/health", async () => {
    const running = mcpManager.getAll().filter((s) => s.status === "running").length;
    return {
      status: "ok",
      version: "0.1.0",
      uptime: process.uptime(),
      servers: { running },
    };
  });

  // ── Routes ────────────────────────────────────────────

  await app.register(serverRoutes);
  await app.register(workflowRoutes);
  await app.register(vaultRoutes);
  await app.register(marketRoutes);
  await app.register(aiRoutes);

  return { app, port };
}
