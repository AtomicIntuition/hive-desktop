/**
 * Integration test: Server Management
 *
 * Tests the server CRUD and lifecycle routes with the real Fastify server.
 * MCP server installation/starting is mocked (we can't install real npm packages in tests),
 * but the HTTP layer, routing, and DB operations are real.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock the MCP manager and installer since we can't actually spawn MCP server processes
vi.mock("../../packages/runtime/src/mcp/manager.js", () => {
  const servers = new Map<string, { status: string; process: { pid: number } | null }>();
  return {
    mcpManager: {
      get: (id: string) => servers.get(id) ?? null,
      getAll: () => Array.from(servers.values()),
      start: async (id: string) => {
        const s = { status: "running", process: { pid: Math.floor(Math.random() * 99999) } };
        servers.set(id, s);
        return s;
      },
      stop: async (id: string) => {
        const s = servers.get(id);
        if (s) { s.status = "stopped"; s.process = null; }
      },
      restart: async (id: string) => {
        const s = { status: "running", process: { pid: Math.floor(Math.random() * 99999) } };
        servers.set(id, s);
        return s;
      },
      getLogs: () => [],
      on: vi.fn(),
    },
  };
});

vi.mock("../../packages/runtime/src/mcp/installer.js", () => ({
  installServer: async (data: Record<string, unknown>) => ({
    id: data.slug,
    ...data,
    status: "installed",
    installedAt: new Date().toISOString(),
  }),
  uninstallServer: (id: string) => {
    // Simulate removal from registry
    return true;
  },
}));

vi.mock("../../packages/runtime/src/mcp/client.js", () => ({
  connectToServer: async () => [{ name: "test-tool", description: "A test tool" }],
  callTool: async (_serverId: string, tool: string, args: Record<string, unknown>) => ({
    content: [{ type: "text", text: JSON.stringify({ tool, args, result: "ok" }) }],
    isError: false,
  }),
  listTools: async () => [
    { name: "test-tool", description: "A test tool", inputSchema: {} },
  ],
  disconnectFromServer: async () => {},
  isConnected: () => false,
}));

vi.mock("../../packages/runtime/src/mcp/registry.js", () => {
  const servers: Array<Record<string, unknown>> = [];
  return {
    getAll: () => servers,
    getById: (id: string) => servers.find((s) => s.id === id) ?? null,
    add: (server: Record<string, unknown>) => { servers.push(server); },
    remove: (id: string) => {
      const idx = servers.findIndex((s) => s.id === id);
      if (idx >= 0) { servers.splice(idx, 1); return true; }
      return false;
    },
  };
});

import { createServer } from "../../packages/runtime/src/server.js";
import type { FastifyInstance } from "fastify";
import { mkdirSync, rmSync } from "node:fs";

let app: FastifyInstance;
const testDataDir = "/tmp/hive-test-servers-" + Date.now();

beforeAll(async () => {
  process.env.HIVE_DATA_DIR = testDataDir;
  mkdirSync(testDataDir, { recursive: true });
  const server = await createServer(0);
  app = server.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { rmSync(testDataDir, { recursive: true, force: true }); } catch {}
});

describe("Server Routes - Integration", () => {
  it("GET /api/servers returns empty array initially", async () => {
    const res = await app.inject({ method: "GET", url: "/api/servers" });
    expect(res.statusCode).toBe(200);
    const servers = JSON.parse(res.payload);
    expect(Array.isArray(servers)).toBe(true);
  });

  it("POST /api/servers installs a server", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/servers",
      payload: {
        slug: "test-mcp",
        name: "Test MCP Server",
        description: "A test server for integration tests",
        npmPackage: "@test/mcp-server",
        installCommand: "npx",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.slug).toBe("test-mcp");
    expect(body.name).toBe("Test MCP Server");
  });

  it("GET /api/servers/:id/tools lists available tools", async () => {
    const res = await app.inject({ method: "GET", url: "/api/servers/test-mcp/tools" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe("test-tool");
  });

  it("POST /api/servers/:id/tools/:tool/call calls a tool", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/servers/test-mcp/tools/test-tool/call",
      payload: {
        arguments: { query: "test" },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.isError).toBe(false);
    expect(body.content[0].type).toBe("text");
    const result = JSON.parse(body.content[0].text);
    expect(result.tool).toBe("test-tool");
    expect(result.args).toEqual({ query: "test" });
  });

  it("POST /api/servers/:id/start starts the server", async () => {
    const res = await app.inject({ method: "POST", url: "/api/servers/test-mcp/start" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("running");
    expect(body.pid).toBeGreaterThan(0);
  });

  it("POST /api/servers/:id/stop stops the server", async () => {
    const res = await app.inject({ method: "POST", url: "/api/servers/test-mcp/stop" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("stopped");
  });

  it("POST /api/servers/:id/restart restarts the server", async () => {
    const res = await app.inject({ method: "POST", url: "/api/servers/test-mcp/restart" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("running");
    expect(body.pid).toBeGreaterThan(0);
  });

  it("GET /api/servers/:id/logs returns logs", async () => {
    const res = await app.inject({ method: "GET", url: "/api/servers/test-mcp/logs" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it("POST /api/servers/:id/connect connects to server", async () => {
    const res = await app.inject({ method: "POST", url: "/api/servers/test-mcp/connect" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.connected).toBe(true);
    expect(body.tools).toHaveLength(1);
  });

  it("POST /api/servers/:id/disconnect disconnects", async () => {
    const res = await app.inject({ method: "POST", url: "/api/servers/test-mcp/disconnect" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.connected).toBe(false);
  });
});
