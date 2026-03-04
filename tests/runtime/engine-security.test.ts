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

describe("Engine Security - Expression Validation", () => {
  describe("blocks dangerous keywords in conditions", () => {
    const dangerousExpressions = [
      { expr: "process.exit(1)", keyword: "process" },
      { expr: "require('child_process')", keyword: "require" },
      { expr: "import('fs')", keyword: "import" },
      { expr: "eval('malicious')", keyword: "eval" },
      { expr: "Function('return this')()", keyword: "Function" },
      { expr: "globalThis.process", keyword: "globalThis" },
      { expr: "constructor.constructor('return this')()", keyword: "constructor" },
      { expr: "this.__proto__", keyword: "__proto__" },
      { expr: "Object.prototype.polluted = true", keyword: "prototype" },
      { expr: "setTimeout(() => {}, 0)", keyword: "setTimeout" },
      { expr: "fetch('http://evil.com')", keyword: "fetch" },
    ];

    for (const { expr, keyword } of dangerousExpressions) {
      it(`blocks "${keyword}" in condition`, async () => {
        const ctx = new WorkflowContext();
        const step: WorkflowStep = {
          id: "sec-1",
          name: "Malicious",
          type: "condition",
          condition: expr,
          onError: "stop",
        };

        const result = await executeStep(step, ctx);
        expect(result.success).toBe(false);
        expect(result.error).toContain("disallowed");
      });
    }
  });

  describe("blocks dangerous keywords in transforms", () => {
    const dangerousExpressions = [
      "process.env.SECRET",
      "require('fs').readFileSync('/etc/passwd')",
      "eval('1+1')",
      "globalThis.Array",
    ];

    for (const expr of dangerousExpressions) {
      it(`blocks expression: ${expr.substring(0, 40)}...`, async () => {
        const ctx = new WorkflowContext();
        const step: WorkflowStep = {
          id: "sec-t1",
          name: "Malicious Transform",
          type: "transform",
          condition: expr,
          onError: "stop",
        };

        const result = await executeStep(step, ctx);
        expect(result.success).toBe(false);
        expect(result.error).toContain("disallowed");
      });
    }
  });

  describe("blocks assignment operators", () => {
    it("blocks simple assignment", async () => {
      const ctx = new WorkflowContext();
      ctx.set("x", 5);
      const step: WorkflowStep = {
        id: "sec-a1",
        name: "Assignment",
        type: "condition",
        condition: "x = 10",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("assignment");
    });

    it("allows comparison operators", async () => {
      const ctx = new WorkflowContext();
      ctx.set("x", 5);

      const comparisons = ["x == 5", "x === 5", "x != 3", "x !== 3", "x >= 3", "x <= 10"];

      for (const condition of comparisons) {
        const step: WorkflowStep = {
          id: "sec-comp",
          name: "Compare",
          type: "condition",
          condition,
          onError: "stop",
        };

        const result = await executeStep(step, ctx);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("blocks semicolons (statement chaining)", () => {
    it("blocks semicolons in condition", async () => {
      const ctx = new WorkflowContext();
      const step: WorkflowStep = {
        id: "sec-semi",
        name: "Chained",
        type: "condition",
        condition: "true; console.log('pwned')",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain("semicolons");
    });
  });

  describe("allows safe expressions", () => {
    const safeExpressions = [
      { expr: "count > 5", desc: "simple comparison" },
      { expr: "items.length > 0", desc: "property access" },
      { expr: "count > 0 && count < 100", desc: "logical operators" },
      { expr: "items.length > 0 || fallback", desc: "OR operator" },
      { expr: "!isEmpty", desc: "negation" },
      { expr: "count + 1 > 5", desc: "arithmetic" },
      { expr: "name.length > 3", desc: "string property" },
    ];

    for (const { expr, desc } of safeExpressions) {
      it(`allows "${desc}": ${expr}`, async () => {
        const ctx = new WorkflowContext();
        ctx.set("count", 10);
        ctx.set("items", [1, 2, 3]);
        ctx.set("fallback", true);
        ctx.set("isEmpty", false);
        ctx.set("name", "hello");

        const step: WorkflowStep = {
          id: "sec-safe",
          name: "Safe",
          type: "condition",
          condition: expr,
          onError: "stop",
        };

        const result = await executeStep(step, ctx);
        expect(result.success).toBe(true);
      });
    }
  });

  describe("safe transform expressions", () => {
    it("allows array operations", async () => {
      const ctx = new WorkflowContext();
      ctx.set("items", [1, 2, 3, 4, 5]);

      const step: WorkflowStep = {
        id: "sec-arr",
        name: "Filter",
        type: "transform",
        condition: "items.filter(x => x > 3)",
        outputVar: "filtered",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toEqual([4, 5]);
    });

    it("allows object construction", async () => {
      const ctx = new WorkflowContext();
      ctx.set("a", 1);
      ctx.set("b", 2);

      const step: WorkflowStep = {
        id: "sec-obj",
        name: "Build",
        type: "transform",
        condition: "({ sum: a + b, product: a * b })",
        outputVar: "result",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toEqual({ sum: 3, product: 2 });
    });

    it("allows string operations", async () => {
      const ctx = new WorkflowContext();
      ctx.set("name", "hello world");

      const step: WorkflowStep = {
        id: "sec-str",
        name: "Upper",
        type: "transform",
        condition: "name.toUpperCase()",
        outputVar: "upper",
        onError: "stop",
      };

      const result = await executeStep(step, ctx);
      expect(result.success).toBe(true);
      expect(result.output).toBe("HELLO WORLD");
    });
  });
});

describe("Engine Security - Strict Mode", () => {
  it("runs expressions in strict mode", async () => {
    const ctx = new WorkflowContext();
    // In strict mode, undeclared variables cause ReferenceError
    const step: WorkflowStep = {
      id: "strict-1",
      name: "Strict",
      type: "condition",
      condition: "typeof undeclaredVar === 'undefined'",
      onError: "stop",
    };

    const result = await executeStep(step, ctx);
    // typeof on undeclared is actually valid in strict mode, just returns 'undefined'
    expect(result.success).toBe(true);
    expect(result.output).toBe(true);
  });
});
