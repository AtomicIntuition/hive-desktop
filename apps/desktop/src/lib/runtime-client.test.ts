import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Need to import after mocking fetch
const { checkHealth, listServers, listWorkflows, getAiStatus } = await import("./runtime-client");

describe("runtime-client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("checkHealth", () => {
    it("returns health data on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok", version: "0.3.1", uptime: 100, servers: { running: 2 } }),
      });

      const result = await checkHealth();
      expect(result.status).toBe("ok");
      expect(result.servers.running).toBe(2);
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ error: "Server down" }),
      });

      await expect(checkHealth()).rejects.toThrow("Server down");
    });
  });

  describe("listServers", () => {
    it("returns server list", async () => {
      const servers = [
        { id: "1", slug: "test-mcp", name: "Test", status: "stopped" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(servers),
      });

      const result = await listServers();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("test-mcp");
    });
  });

  describe("listWorkflows", () => {
    it("returns workflow list", async () => {
      const workflows = [
        { id: "1", name: "Test Workflow", status: "draft", steps: [], trigger: { type: "manual" } },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(workflows),
      });

      const result = await listWorkflows();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test Workflow");
    });
  });

  describe("getAiStatus", () => {
    it("returns AI configuration status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ configured: false, provider: "claude", model: "claude-sonnet-4-20250514" }),
      });

      const result = await getAiStatus();
      expect(result.configured).toBe(false);
      expect(result.provider).toBe("claude");
    });
  });
});
