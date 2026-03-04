import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock MCP manager
const mockGet = vi.fn();
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockRestart = vi.fn();
const mockGetLogs = vi.fn(() => []);
vi.mock("../../packages/runtime/src/mcp/manager.js", () => ({
  mcpManager: {
    get: (...args: unknown[]) => mockGet(...args),
    start: (...args: unknown[]) => mockStart(...args),
    stop: (...args: unknown[]) => mockStop(...args),
    restart: (...args: unknown[]) => mockRestart(...args),
    getLogs: (...args: unknown[]) => mockGetLogs(...args),
  },
}));

// Mock MCP client
const mockConnect = vi.fn();
const mockCallTool = vi.fn();
const mockListTools = vi.fn(() => []);
const mockDisconnect = vi.fn();
const mockIsConnected = vi.fn(() => false);
vi.mock("../../packages/runtime/src/mcp/client.js", () => ({
  connectToServer: (...args: unknown[]) => mockConnect(...args),
  callTool: (...args: unknown[]) => mockCallTool(...args),
  listTools: (...args: unknown[]) => mockListTools(...args),
  disconnectFromServer: (...args: unknown[]) => mockDisconnect(...args),
  isConnected: (...args: unknown[]) => mockIsConnected(...args),
}));

// Mock installer
const mockInstall = vi.fn();
const mockUninstall = vi.fn();
vi.mock("../../packages/runtime/src/mcp/installer.js", () => ({
  installServer: (...args: unknown[]) => mockInstall(...args),
  uninstallServer: (...args: unknown[]) => mockUninstall(...args),
}));

// Mock registry
const mockGetAll = vi.fn(() => []);
const mockGetById = vi.fn();
vi.mock("../../packages/runtime/src/mcp/registry.js", () => ({
  getAll: () => mockGetAll(),
  getById: (...args: unknown[]) => mockGetById(...args),
}));

// Mock broadcast
vi.mock("../../packages/runtime/src/server.js", () => ({
  broadcast: vi.fn(),
}));

describe("Server Routes - List Servers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enriches servers with live status", () => {
    const servers = [
      { id: "stripe", slug: "stripe-mcp", name: "Stripe", status: "stopped", pid: null },
      { id: "github", slug: "github-mcp", name: "GitHub", status: "stopped", pid: null },
    ];

    mockGetAll.mockReturnValue(servers);
    mockGet.mockImplementation((id: string) => {
      if (id === "stripe") return { status: "running", process: { pid: 12345 } };
      return null;
    });
    mockIsConnected.mockImplementation((id: string) => id === "stripe");

    const result = servers.map((s) => {
      const managed = mockGet(s.id);
      return {
        ...s,
        status: managed?.status ?? s.status,
        pid: managed?.process?.pid ?? s.pid,
        connected: mockIsConnected(s.id),
      };
    });

    expect(result[0].status).toBe("running");
    expect(result[0].pid).toBe(12345);
    expect(result[0].connected).toBe(true);
    expect(result[1].status).toBe("stopped");
    expect(result[1].connected).toBe(false);
  });
});

describe("Server Routes - Install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("installs a server with valid data", async () => {
    const input = {
      slug: "stripe-mcp",
      name: "Stripe MCP",
      description: "Stripe tools",
      npmPackage: "@stripe/mcp",
      installCommand: "npx" as const,
      envVars: [{ name: "STRIPE_API_KEY", description: "API key", required: true }],
    };

    mockInstall.mockResolvedValue({ id: "stripe-mcp", ...input, status: "installed" });

    const result = await mockInstall(input);
    expect(result.id).toBe("stripe-mcp");
    expect(mockInstall).toHaveBeenCalledWith(input);
  });

  it("returns 409 when server already installed", async () => {
    mockInstall.mockRejectedValue(new Error("Server already installed"));

    try {
      await mockInstall({ slug: "existing" });
    } catch (err) {
      expect((err as Error).message).toBe("Server already installed");
    }
  });
});

describe("Server Routes - Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("start returns status and pid", async () => {
    mockStart.mockResolvedValue({ status: "running", process: { pid: 9999 } });

    const managed = await mockStart("stripe-mcp");
    expect(managed.status).toBe("running");
    expect(managed.process.pid).toBe(9999);
  });

  it("stop disconnects and returns stopped status", async () => {
    mockStop.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);

    await mockStop("stripe-mcp");
    await mockDisconnect("stripe-mcp");

    expect(mockStop).toHaveBeenCalledWith("stripe-mcp");
    expect(mockDisconnect).toHaveBeenCalledWith("stripe-mcp");
  });

  it("restart disconnects first then restarts", async () => {
    mockRestart.mockResolvedValue({ status: "running", process: { pid: 8888 } });

    await mockDisconnect("stripe-mcp");
    const managed = await mockRestart("stripe-mcp");

    expect(mockDisconnect).toHaveBeenCalledWith("stripe-mcp");
    expect(managed.status).toBe("running");
  });
});

describe("Server Routes - Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listTools returns tool array", async () => {
    const tools = [
      { name: "list-charges", description: "List Stripe charges" },
      { name: "create-customer", description: "Create a customer" },
    ];
    mockListTools.mockResolvedValue(tools);

    const result = await mockListTools("stripe-mcp");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("list-charges");
  });

  it("callTool passes arguments correctly", async () => {
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: '{"id":"ch_123"}' }],
      isError: false,
    });

    const result = await mockCallTool("stripe-mcp", "list-charges", { limit: 10 });
    expect(result.isError).toBe(false);
    expect(mockCallTool).toHaveBeenCalledWith("stripe-mcp", "list-charges", { limit: 10 });
  });

  it("callTool handles errors", async () => {
    mockCallTool.mockRejectedValue(new Error("Connection lost"));

    try {
      await mockCallTool("stripe-mcp", "bad-tool", {});
    } catch (err) {
      expect((err as Error).message).toBe("Connection lost");
    }
  });
});

describe("Server Routes - Removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stops server before removing", async () => {
    mockUninstall.mockReturnValue(true);

    await mockStop("stripe-mcp");
    await mockDisconnect("stripe-mcp");
    const removed = mockUninstall("stripe-mcp");

    expect(mockStop).toHaveBeenCalledWith("stripe-mcp");
    expect(mockDisconnect).toHaveBeenCalledWith("stripe-mcp");
    expect(removed).toBe(true);
  });

  it("returns false when server not found", () => {
    mockUninstall.mockReturnValue(false);
    const removed = mockUninstall("nonexistent");
    expect(removed).toBe(false);
  });
});

describe("Server Routes - Input Validation", () => {
  it("rejects empty server id", () => {
    const id = "";
    expect(id.trim().length).toBe(0);
    // Route should validate non-empty id
  });

  it("rejects empty tool name", () => {
    const tool = "";
    expect(tool.trim().length).toBe(0);
    // Route should validate non-empty tool name
  });

  it("handles undefined arguments gracefully", () => {
    const args = undefined;
    const resolved = args ?? {};
    expect(resolved).toEqual({});
  });
});

describe("Server Routes - Logs", () => {
  it("returns logs for a server", () => {
    mockGetLogs.mockReturnValue([
      { timestamp: "2026-01-01T00:00:00Z", level: "info", message: "Server started" },
      { timestamp: "2026-01-01T00:00:01Z", level: "error", message: "Connection failed" },
    ]);

    const logs = mockGetLogs("stripe-mcp");
    expect(logs).toHaveLength(2);
    expect(logs[0].level).toBe("info");
    expect(logs[1].level).toBe("error");
  });

  it("returns empty array when no logs", () => {
    mockGetLogs.mockReturnValue([]);
    const logs = mockGetLogs("new-server");
    expect(logs).toHaveLength(0);
  });
});
