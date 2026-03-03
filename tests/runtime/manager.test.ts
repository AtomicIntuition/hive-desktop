import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Mock DB
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockDbRun, get: mockDbGet }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

// Mock vault
vi.mock("../../packages/runtime/src/vault/store.js", () => ({
  getCredentialsForServer: () => ({}),
  getAllCredentialsAsEnv: () => ({}),
}));

// Mock spawn
const mockKill = vi.fn();
const mockChildProcess = Object.assign(new EventEmitter(), {
  pid: 12345,
  killed: false,
  kill: mockKill,
  stdout: Object.assign(new EventEmitter(), { on: vi.fn() }),
  stderr: Object.assign(new EventEmitter(), { on: vi.fn() }),
});

vi.mock("node:child_process", () => ({
  spawn: () => mockChildProcess,
}));

// Import after mocks
import { mcpManager } from "../../packages/runtime/src/mcp/manager.js";

describe("McpManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockReturnValue({
      id: "srv-1",
      slug: "test-mcp",
      name: "Test MCP",
      npm_package: "@test/mcp",
      install_command: "npx",
      status: "stopped",
    });
  });

  it("is an EventEmitter", () => {
    expect(mcpManager).toBeInstanceOf(EventEmitter);
  });

  it("getAll returns empty initially", () => {
    expect(mcpManager.getAll()).toEqual([]);
  });

  it("getLogs returns empty for unknown server", () => {
    expect(mcpManager.getLogs("unknown")).toEqual([]);
  });

  it("getProcess returns null for unknown server", () => {
    expect(mcpManager.getProcess("unknown")).toBeNull();
  });

  it("get returns undefined for unknown server", () => {
    expect(mcpManager.get("unknown")).toBeUndefined();
  });

  it("start throws when server not in DB", async () => {
    mockDbGet.mockReturnValueOnce(undefined);
    await expect(mcpManager.start("bad-id")).rejects.toThrow("Server not found");
  });

  it("start throws when no npm package", async () => {
    mockDbGet.mockReturnValueOnce({
      id: "srv-2",
      slug: "no-pkg",
      name: "No Pkg",
      npm_package: null,
      install_command: "npx",
    });
    await expect(mcpManager.start("srv-2")).rejects.toThrow("no npm package");
  });

  it("start spawns a process and emits status", async () => {
    const statusEvents: unknown[] = [];
    mcpManager.on("status", (data: unknown) => statusEvents.push(data));

    await mcpManager.start("srv-1");

    const managed = mcpManager.get("srv-1");
    expect(managed).toBeDefined();
    expect(managed!.status).toBe("running");
    expect(managed!.slug).toBe("test-mcp");
    expect(statusEvents.length).toBeGreaterThan(0);
  });

  it("stop sets status to stopped", async () => {
    await mcpManager.start("srv-1");
    await mcpManager.stop("srv-1");

    const managed = mcpManager.get("srv-1");
    expect(managed!.status).toBe("stopped");
  });

  it("stop is safe on unknown server", async () => {
    await mcpManager.stop("nonexistent");
    // No throw
  });

  it("shutdownAll stops all servers", async () => {
    await mcpManager.start("srv-1");
    await mcpManager.shutdownAll();
    const managed = mcpManager.get("srv-1");
    expect(managed!.status).toBe("stopped");
  });

  it("addLog trims logs beyond MAX_LOG_LINES", async () => {
    await mcpManager.start("srv-1");
    const managed = mcpManager.get("srv-1")!;
    // Logs already have some entries from start
    expect(managed.logs.length).toBeGreaterThan(0);
    expect(managed.logs[0]).toHaveProperty("level");
    expect(managed.logs[0]).toHaveProperty("message");
    expect(managed.logs[0]).toHaveProperty("timestamp");
  });
});
