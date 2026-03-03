import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process exec
vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));
vi.mock("node:util", () => ({
  promisify: () => vi.fn().mockResolvedValue({ stdout: "1.0.0" }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({ nanoid: () => "install-123" }));

// Mock registry
const mockIsInstalled = vi.fn(() => false);
vi.mock("../../packages/runtime/src/mcp/registry.js", () => ({
  isInstalled: (...args: unknown[]) => mockIsInstalled(...args),
}));

// Mock DB
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn(() => []);
const mockPrepare = vi.fn(() => ({ run: mockDbRun, get: mockDbGet, all: mockDbAll }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

import { installServer, uninstallServer } from "../../packages/runtime/src/mcp/installer.js";

describe("installer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInstalled.mockReturnValue(false);
    mockDbGet.mockReturnValue({
      id: "install-123",
      slug: "test-mcp",
      name: "Test MCP",
      description: "",
      npm_package: "@test/mcp",
      install_command: "npx",
      status: "stopped",
      pid: null,
      port: null,
      config: null,
      env_vars: null,
      installed_at: "2026-01-01T00:00:00Z",
      last_started_at: null,
    });
  });

  describe("installServer", () => {
    it("installs a server and returns it", async () => {
      const server = await installServer({
        slug: "test-mcp",
        name: "Test MCP",
        npmPackage: "@test/mcp",
      });

      expect(server.id).toBe("install-123");
      expect(server.slug).toBe("test-mcp");
      expect(mockDbRun).toHaveBeenCalled();
    });

    it("throws when server is already installed", async () => {
      mockIsInstalled.mockReturnValueOnce(true);
      await expect(
        installServer({ slug: "test-mcp", name: "Test", npmPackage: "@test/mcp" })
      ).rejects.toThrow("already installed");
    });

    it("stores env vars when provided", async () => {
      await installServer({
        slug: "test-mcp",
        name: "Test",
        npmPackage: "@test/mcp",
        envVars: [{ name: "API_KEY", description: "The key", required: true }],
      });

      expect(mockDbRun).toHaveBeenCalled();
      // Check that env_vars JSON was passed
      const runArgs = mockDbRun.mock.calls[0];
      expect(runArgs).toBeDefined();
    });

    it("accepts uvx install command", async () => {
      const server = await installServer({
        slug: "python-mcp",
        name: "Python MCP",
        npmPackage: "python-mcp-tool",
        installCommand: "uvx",
      });

      expect(server).toBeDefined();
    });

    it("accepts description", async () => {
      await installServer({
        slug: "test-mcp",
        name: "Test",
        description: "A test server",
        npmPackage: "@test/mcp",
      });

      expect(mockDbRun).toHaveBeenCalled();
    });
  });

  describe("uninstallServer", () => {
    it("returns true when server is deleted", () => {
      mockDbRun.mockReturnValueOnce({ changes: 1 });
      expect(uninstallServer("srv-1")).toBe(true);
    });

    it("returns false when server not found", () => {
      mockDbRun.mockReturnValueOnce({ changes: 0 });
      expect(uninstallServer("bad-id")).toBe(false);
    });
  });
});
