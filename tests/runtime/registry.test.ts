import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

import { isInstalled, getBySlug, getById, getAll, getByStatus } from "../../packages/runtime/src/mcp/registry.js";

const sampleRow = {
  id: "srv-1",
  slug: "stripe-mcp",
  name: "Stripe MCP",
  description: "Stripe integration",
  npm_package: "@stripe/mcp",
  install_command: "npx",
  status: "stopped",
  pid: null,
  port: null,
  config: null,
  env_vars: JSON.stringify([{ name: "STRIPE_API_KEY", description: "Key", required: true }]),
  installed_at: "2026-01-01T00:00:00Z",
  last_started_at: null,
};

describe("registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isInstalled", () => {
    it("returns true when server exists by slug", () => {
      mockGet.mockReturnValueOnce({ id: "srv-1" });
      expect(isInstalled("stripe-mcp")).toBe(true);
    });

    it("returns false when server does not exist", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(isInstalled("nonexistent")).toBe(false);
    });
  });

  describe("getBySlug", () => {
    it("returns mapped server when found", () => {
      mockGet.mockReturnValueOnce(sampleRow);
      const server = getBySlug("stripe-mcp");
      expect(server).not.toBeNull();
      expect(server!.id).toBe("srv-1");
      expect(server!.slug).toBe("stripe-mcp");
      expect(server!.npmPackage).toBe("@stripe/mcp");
      expect(server!.envVars).toHaveLength(1);
    });

    it("returns null when not found", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(getBySlug("nonexistent")).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns server when found", () => {
      mockGet.mockReturnValueOnce(sampleRow);
      const server = getById("srv-1");
      expect(server).not.toBeNull();
      expect(server!.name).toBe("Stripe MCP");
    });

    it("returns null when not found", () => {
      mockGet.mockReturnValueOnce(undefined);
      expect(getById("bad-id")).toBeNull();
    });
  });

  describe("getAll", () => {
    it("returns all servers", () => {
      mockAll.mockReturnValueOnce([sampleRow]);
      const servers = getAll();
      expect(servers).toHaveLength(1);
      expect(servers[0].slug).toBe("stripe-mcp");
    });

    it("returns empty array when none installed", () => {
      mockAll.mockReturnValueOnce([]);
      expect(getAll()).toHaveLength(0);
    });
  });

  describe("getByStatus", () => {
    it("returns servers matching status", () => {
      mockAll.mockReturnValueOnce([{ ...sampleRow, status: "running" }]);
      const servers = getByStatus("running");
      expect(servers).toHaveLength(1);
      expect(servers[0].status).toBe("running");
    });
  });

  it("parses JSON env_vars and config", () => {
    mockGet.mockReturnValueOnce({
      ...sampleRow,
      config: JSON.stringify({ port: 3000 }),
    });
    const server = getBySlug("stripe-mcp");
    expect(server!.config).toEqual({ port: 3000 });
  });

  it("handles null env_vars and config gracefully", () => {
    mockGet.mockReturnValueOnce({ ...sampleRow, env_vars: null, config: null });
    const server = getBySlug("stripe-mcp");
    expect(server!.envVars).toBeUndefined();
    expect(server!.config).toBeUndefined();
  });
});
