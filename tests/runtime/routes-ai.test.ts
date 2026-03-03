import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";

// Mock provider
const mockIsConfigured = vi.fn(() => false);
const mockSetApiKey = vi.fn();
const mockRemoveApiKey = vi.fn();
vi.mock("../../packages/runtime/src/ai/provider.js", () => ({
  isConfigured: () => mockIsConfigured(),
  setApiKey: (...args: unknown[]) => mockSetApiKey(...args),
  removeApiKey: () => mockRemoveApiKey(),
  getApiKey: () => null,
}));

// Mock planner
const mockPlanWorkflow = vi.fn();
vi.mock("../../packages/runtime/src/ai/planner.js", () => ({
  planWorkflow: (...args: unknown[]) => mockPlanWorkflow(...args),
}));

// Mock DB
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockDbRun, get: mockDbGet }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({ nanoid: () => "ai-wf-123" }));

import { aiRoutes } from "../../packages/runtime/src/routes/ai.js";

describe("AI routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(aiRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/ai/status", () => {
    it("returns configured status", async () => {
      mockIsConfigured.mockReturnValueOnce(true);
      const res = await app.inject({ method: "GET", url: "/api/ai/status" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.configured).toBe(true);
      expect(body.provider).toBe("claude");
    });
  });

  describe("POST /api/ai/config", () => {
    it("stores API key", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/ai/config",
        payload: { apiKey: "sk-ant-valid-key" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(mockSetApiKey).toHaveBeenCalledWith("sk-ant-valid-key");
    });

    it("rejects invalid key format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/ai/config",
        payload: { apiKey: "bad-key" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Invalid");
    });

    it("rejects empty key", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/ai/config",
        payload: { apiKey: "" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/ai/config", () => {
    it("removes API key", async () => {
      const res = await app.inject({ method: "DELETE", url: "/api/ai/config" });
      expect(res.statusCode).toBe(200);
      expect(res.json().configured).toBe(false);
      expect(mockRemoveApiKey).toHaveBeenCalled();
    });
  });

  describe("POST /api/ai/plan-workflow", () => {
    it("returns 400 when prompt is empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/ai/plan-workflow",
        payload: { prompt: "" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when not configured", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/ai/plan-workflow",
        payload: { prompt: "Watch Stripe payments" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("not configured");
    });

    it("returns plan on success", async () => {
      mockIsConfigured.mockReturnValue(true);
      mockPlanWorkflow.mockResolvedValueOnce({
        name: "Payment Monitor",
        description: "Watch payments",
        trigger: { type: "interval", seconds: 60 },
        steps: [],
        requiredServers: [],
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai/plan-workflow",
        payload: { prompt: "Watch Stripe payments" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("Payment Monitor");
    });

    it("returns 401 on authentication error", async () => {
      mockIsConfigured.mockReturnValue(true);
      mockPlanWorkflow.mockRejectedValueOnce(new Error("401 Unauthorized"));

      const res = await app.inject({
        method: "POST",
        url: "/api/ai/plan-workflow",
        payload: { prompt: "something" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 429 on rate limit", async () => {
      mockIsConfigured.mockReturnValue(true);
      mockPlanWorkflow.mockRejectedValueOnce(new Error("429 rate limit exceeded"));

      const res = await app.inject({
        method: "POST",
        url: "/api/ai/plan-workflow",
        payload: { prompt: "something" },
      });
      expect(res.statusCode).toBe(429);
    });
  });

  describe("POST /api/ai/confirm-workflow", () => {
    it("saves plan to DB and returns workflow", async () => {
      mockDbGet.mockReturnValueOnce({
        id: "ai-wf-123",
        name: "My Workflow",
        description: "Test",
        status: "draft",
        trigger: JSON.stringify({ type: "manual" }),
        steps: JSON.stringify([]),
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        run_count: 0,
        error_count: 0,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/ai/confirm-workflow",
        payload: {
          name: "My Workflow",
          description: "Test",
          trigger: { type: "manual" },
          steps: [],
          requiredServers: [],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe("ai-wf-123");
      expect(res.json().name).toBe("My Workflow");
    });
  });
});
