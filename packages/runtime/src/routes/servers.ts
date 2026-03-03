import type { FastifyInstance } from "fastify";
import { mcpManager } from "../mcp/manager.js";
import { connectToServer, callTool, listTools, disconnectFromServer, isConnected } from "../mcp/client.js";
import { installServer, uninstallServer } from "../mcp/installer.js";
import * as registry from "../mcp/registry.js";
import { broadcast } from "../server.js";
import type { ServerEnvVar } from "@hive-desktop/shared";

export async function serverRoutes(app: FastifyInstance): Promise<void> {
  // ── CRUD ──────────────────────────────────────────────

  // List all installed servers (enriched with live status)
  app.get("/api/servers", async () => {
    const servers = registry.getAll();
    return servers.map((s) => {
      const managed = mcpManager.get(s.id);
      return {
        ...s,
        status: managed?.status ?? s.status,
        pid: managed?.process?.pid ?? s.pid,
        connected: isConnected(s.id),
      };
    });
  });

  // Get a single server with live status
  app.get<{ Params: { id: string } }>("/api/servers/:id", async (request, reply) => {
    const server = registry.getById(request.params.id);
    if (!server) return reply.status(404).send({ error: "Server not found" });
    const managed = mcpManager.get(server.id);
    return {
      ...server,
      status: managed?.status ?? server.status,
      pid: managed?.process?.pid ?? server.pid,
      connected: isConnected(server.id),
    };
  });

  // Install a new server from marketplace data
  app.post<{
    Body: {
      slug: string;
      name: string;
      description?: string;
      npmPackage: string;
      installCommand?: "npx" | "uvx";
      envVars?: ServerEnvVar[];
    };
  }>("/api/servers", async (request, reply) => {
    try {
      const server = await installServer(request.body);
      broadcast({ type: "server:installed", data: { server } });
      return server;
    } catch (err) {
      return reply.status(409).send({ error: (err as Error).message });
    }
  });

  // Remove a server
  app.delete<{ Params: { id: string } }>("/api/servers/:id", async (request, reply) => {
    const { id } = request.params;
    // Stop first if running
    await mcpManager.stop(id);
    await disconnectFromServer(id);
    const removed = uninstallServer(id);
    if (!removed) return reply.status(404).send({ error: "Server not found" });
    broadcast({ type: "server:removed", data: { id } });
    return { success: true };
  });

  // ── Lifecycle ─────────────────────────────────────────

  // Start a server
  app.post<{ Params: { id: string } }>("/api/servers/:id/start", async (request, reply) => {
    try {
      const managed = await mcpManager.start(request.params.id);
      return { status: managed.status, pid: managed.process?.pid };
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Stop a server
  app.post<{ Params: { id: string } }>("/api/servers/:id/stop", async (request, reply) => {
    try {
      await mcpManager.stop(request.params.id);
      await disconnectFromServer(request.params.id);
      return { status: "stopped" };
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Restart a server
  app.post<{ Params: { id: string } }>("/api/servers/:id/restart", async (request, reply) => {
    try {
      await disconnectFromServer(request.params.id);
      const managed = await mcpManager.restart(request.params.id);
      return { status: managed.status, pid: managed.process?.pid };
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // ── Tools ─────────────────────────────────────────────

  // List tools available on a running server
  app.get<{ Params: { id: string } }>("/api/servers/:id/tools", async (request, reply) => {
    try {
      const tools = await listTools(request.params.id);
      return { tools };
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Call a tool on a running server
  app.post<{
    Params: { id: string; tool: string };
    Body: { arguments?: Record<string, unknown> };
  }>("/api/servers/:id/tools/:tool/call", async (request, reply) => {
    try {
      const result = await callTool(
        request.params.id,
        request.params.tool,
        request.body.arguments ?? {}
      );
      return result;
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Connect to a server (for tool discovery without calling)
  app.post<{ Params: { id: string } }>("/api/servers/:id/connect", async (request, reply) => {
    try {
      const tools = await connectToServer(request.params.id);
      broadcast({ type: "server:tools", data: { id: request.params.id, tools } });
      return { tools, connected: true };
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Disconnect SDK client from a server
  app.post<{ Params: { id: string } }>("/api/servers/:id/disconnect", async (request) => {
    await disconnectFromServer(request.params.id);
    return { connected: false };
  });

  // ── Logs ──────────────────────────────────────────────

  // Get server logs
  app.get<{ Params: { id: string } }>("/api/servers/:id/logs", async (request) => {
    const logs = mcpManager.getLogs(request.params.id);
    return { logs };
  });
}
