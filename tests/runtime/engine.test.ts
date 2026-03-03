import { describe, it, expect, vi } from "vitest";
import { WorkflowContext } from "../../packages/runtime/src/workflow/context.js";
import { executeStep } from "../../packages/runtime/src/workflow/engine.js";
import type { WorkflowStep } from "../../packages/shared/src/types.js";

// Mock the MCP client and manager since engine imports them
vi.mock("../../packages/runtime/src/mcp/client.js", () => ({
  callTool: vi.fn(),
  connectToServer: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
}));

vi.mock("../../packages/runtime/src/mcp/manager.js", () => ({
  mcpManager: {
    get: vi.fn().mockReturnValue({ status: "running", process: {}, npmPackage: "test", installCommand: "npx", slug: "test" }),
    start: vi.fn(),
  },
}));

describe("executeStep", () => {
  describe("transform", () => {
    it("evaluates a JS expression and stores result", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "t1",
        name: "Compute",
        type: "transform",
        condition: "({ sum: 2 + 3, greeting: 'hello' })",
        outputVar: "result",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ sum: 5, greeting: "hello" });
      expect(ctx.get("result")).toEqual({ sum: 5, greeting: "hello" });
    });

    it("can reference context variables", async () => {
      const ctx = new WorkflowContext();
      ctx.set("items", [1, 2, 3, 4, 5]);

      const step: WorkflowStep = {
        id: "t2",
        name: "Filter",
        type: "transform",
        condition: "items.filter(x => x > 3)",
        outputVar: "filtered",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toEqual([4, 5]);
      expect(ctx.get("filtered")).toEqual([4, 5]);
    });

    it("fails on invalid expression", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "t3",
        name: "Bad",
        type: "transform",
        condition: "undefined_var.property",
        outputVar: "x",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Transform evaluation failed");
    });

    it("fails when no expression provided", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "t4",
        name: "Empty",
        type: "transform",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("requires");
    });
  });

  describe("condition", () => {
    it("returns skipped=false when condition is true", async () => {
      const ctx = new WorkflowContext();
      ctx.set("count", 10);

      const step: WorkflowStep = {
        id: "c1",
        name: "Check",
        type: "condition",
        condition: "count > 5",
        outputVar: "passed",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toBe(true);
      expect(result.skipped).toBe(false);
      expect(ctx.get("passed")).toBe(true);
    });

    it("returns skipped=true when condition is false", async () => {
      const ctx = new WorkflowContext();
      ctx.set("count", 2);

      const step: WorkflowStep = {
        id: "c2",
        name: "Check",
        type: "condition",
        condition: "count > 5",
        outputVar: "passed",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toBe(false);
      expect(result.skipped).toBe(true);
      expect(ctx.get("passed")).toBe(false);
    });

    it("handles array checks", async () => {
      const ctx = new WorkflowContext();
      ctx.set("items", [1, 2, 3]);

      const step: WorkflowStep = {
        id: "c3",
        name: "Has items",
        type: "condition",
        condition: "Array.isArray(items) && items.length > 0",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it("fails when no condition expression", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "c4",
        name: "Empty",
        type: "condition",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(false);
    });
  });

  describe("delay", () => {
    it("delays for the specified time", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "d1",
        name: "Wait",
        type: "delay",
        arguments: { seconds: 0.05 },
        onError: "continue",
      };

      const start = Date.now();
      const result = await executeStep(step, ctx);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it("defaults to 1 second when no args", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "d2",
        name: "Wait default",
        type: "delay",
        onError: "continue",
      };

      const start = Date.now();
      const result = await executeStep(step, ctx);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(900);
    }, 3000);
  });

  describe("notify", () => {
    it("creates a notification with resolved variables", async () => {
      const ctx = new WorkflowContext();
      ctx.set("count", 3);

      const step: WorkflowStep = {
        id: "n1",
        name: "Alert",
        type: "notify",
        arguments: {
          title: "Payment Alert",
          message: "Found {{count}} payments",
        },
        outputVar: "notification",
        onError: "continue",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toMatchObject({
        title: "Payment Alert",
        message: "Found 3 payments",
        channel: "log",
      });
      expect(ctx.get("notification")).toMatchObject({
        title: "Payment Alert",
        message: "Found 3 payments",
      });
    });

    it("uses step name as default title", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "n2",
        name: "My Alert",
        type: "notify",
        arguments: { message: "Hello" },
        onError: "continue",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect((result.output as Record<string, unknown>).title).toBe("My Alert");
    });
  });

  describe("mcp_call", () => {
    it("fails when server or tool not specified", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "m1",
        name: "Bad call",
        type: "mcp_call",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("requires");
    });
  });

  describe("unknown step type", () => {
    it("returns error for unknown type", async () => {
      const ctx = new WorkflowContext();
      const step = {
        id: "u1",
        name: "Unknown",
        type: "unknown_type" as WorkflowStep["type"],
        onError: "stop" as const,
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown step type");
    });
  });
});
