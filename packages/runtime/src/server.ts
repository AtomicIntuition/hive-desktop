import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { serverRoutes } from "./routes/servers.js";
import { workflowRoutes } from "./routes/workflows.js";
import { vaultRoutes } from "./routes/vault.js";
import { marketRoutes } from "./routes/market.js";
import { aiRoutes } from "./routes/ai.js";
import type { ServerEvent } from "@hive-desktop/shared";
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

  // WebSocket endpoint
  app.get("/ws", { websocket: true }, (socket) => {
    connectedClients.add(socket);

    socket.on("close", () => {
      connectedClients.delete(socket);
    });

    socket.on("error", () => {
      connectedClients.delete(socket);
    });

    // Send ready event
    socket.send(JSON.stringify({ type: "runtime:ready", data: { port } }));
  });

  // Health check
  app.get("/api/health", async () => ({
    status: "ok",
    version: "0.1.0",
    uptime: process.uptime(),
  }));

  // Register route modules
  await app.register(serverRoutes);
  await app.register(workflowRoutes);
  await app.register(vaultRoutes);
  await app.register(marketRoutes);
  await app.register(aiRoutes);

  return { app, port };
}
