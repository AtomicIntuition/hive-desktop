import { describe, it, expect } from "vitest";
import { WorkflowContext } from "../../packages/runtime/src/workflow/context.js";

describe("WorkflowContext", () => {
  describe("set/get", () => {
    it("stores and retrieves simple values", () => {
      const ctx = new WorkflowContext();
      ctx.set("name", "test");
      ctx.set("count", 42);
      ctx.set("flag", true);

      expect(ctx.get("name")).toBe("test");
      expect(ctx.get("count")).toBe(42);
      expect(ctx.get("flag")).toBe(true);
    });

    it("stores and retrieves objects", () => {
      const ctx = new WorkflowContext();
      ctx.set("data", { foo: "bar", nested: { deep: 1 } });

      expect(ctx.get("data")).toEqual({ foo: "bar", nested: { deep: 1 } });
    });

    it("returns undefined for missing keys", () => {
      const ctx = new WorkflowContext();
      expect(ctx.get("missing")).toBeUndefined();
    });

    it("overwrites existing values", () => {
      const ctx = new WorkflowContext();
      ctx.set("key", "first");
      ctx.set("key", "second");
      expect(ctx.get("key")).toBe("second");
    });
  });

  describe("dot-notation access", () => {
    it("accesses nested properties", () => {
      const ctx = new WorkflowContext();
      ctx.set("data", { name: "test", info: { count: 5 } });

      expect(ctx.get("data.name")).toBe("test");
      expect(ctx.get("data.info")).toEqual({ count: 5 });
      expect(ctx.get("data.info.count")).toBe(5);
    });

    it("returns undefined for invalid paths", () => {
      const ctx = new WorkflowContext();
      ctx.set("data", { name: "test" });

      expect(ctx.get("data.missing")).toBeUndefined();
      expect(ctx.get("data.name.nope")).toBeUndefined();
      expect(ctx.get("nothing.at.all")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("returns true for existing keys", () => {
      const ctx = new WorkflowContext();
      ctx.set("key", "value");
      expect(ctx.has("key")).toBe(true);
    });

    it("returns false for missing keys", () => {
      const ctx = new WorkflowContext();
      expect(ctx.has("missing")).toBe(false);
    });

    it("works with dot-notation", () => {
      const ctx = new WorkflowContext();
      ctx.set("obj", { a: 1 });
      expect(ctx.has("obj.a")).toBe(true);
      expect(ctx.has("obj.b")).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("returns all variables as a plain object", () => {
      const ctx = new WorkflowContext();
      ctx.set("a", 1);
      ctx.set("b", "two");
      ctx.set("c", [3]);

      expect(ctx.toJSON()).toEqual({ a: 1, b: "two", c: [3] });
    });

    it("returns empty object when no variables set", () => {
      const ctx = new WorkflowContext();
      expect(ctx.toJSON()).toEqual({});
    });
  });

  describe("recordStep / getStepResults", () => {
    it("records step results in order", () => {
      const ctx = new WorkflowContext();
      ctx.recordStep("s1", { data: "ok" });
      ctx.recordStep("s2", null, "failed");

      const results = ctx.getStepResults();
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ stepId: "s1", result: { data: "ok" }, error: undefined });
      expect(results[1]).toEqual({ stepId: "s2", result: null, error: "failed" });
    });

    it("returns a copy (not a reference)", () => {
      const ctx = new WorkflowContext();
      ctx.recordStep("s1", "x");
      const results = ctx.getStepResults();
      results.push({ stepId: "fake", result: null });
      expect(ctx.getStepResults()).toHaveLength(1);
    });
  });

  describe("resolve — template strings", () => {
    it("resolves simple variable references in strings", () => {
      const ctx = new WorkflowContext();
      ctx.set("name", "World");
      expect(ctx.resolve("Hello {{name}}!")).toBe("Hello World!");
    });

    it("resolves dot-notation variables", () => {
      const ctx = new WorkflowContext();
      ctx.set("user", { name: "Alice", age: 30 });
      expect(ctx.resolve("{{user.name}} is {{user.age}}")).toBe("Alice is 30");
    });

    it("preserves type for full-string references", () => {
      const ctx = new WorkflowContext();
      ctx.set("count", 42);
      ctx.set("items", [1, 2, 3]);
      ctx.set("obj", { a: 1 });

      // Full-string reference returns raw value
      expect(ctx.resolve("{{count}}")).toBe(42);
      expect(ctx.resolve("{{items}}")).toEqual([1, 2, 3]);
      expect(ctx.resolve("{{obj}}")).toEqual({ a: 1 });
    });

    it("coerces to string when mixed with text", () => {
      const ctx = new WorkflowContext();
      ctx.set("count", 42);
      expect(ctx.resolve("Count: {{count}}")).toBe("Count: 42");
    });

    it("serializes objects in mixed strings", () => {
      const ctx = new WorkflowContext();
      ctx.set("data", { x: 1 });
      expect(ctx.resolve("Data: {{data}}")).toBe('Data: {"x":1}');
    });

    it("preserves unresolved templates", () => {
      const ctx = new WorkflowContext();
      expect(ctx.resolve("{{missing}}")).toBe("{{missing}}");
      expect(ctx.resolve("Hi {{missing}}")).toBe("Hi {{missing}}");
    });

    it("resolves variables in objects recursively", () => {
      const ctx = new WorkflowContext();
      ctx.set("channel", "#alerts");
      ctx.set("msg", "test");

      const input = { channel: "{{channel}}", text: "Message: {{msg}}" };
      expect(ctx.resolve(input)).toEqual({ channel: "#alerts", text: "Message: test" });
    });

    it("resolves variables in arrays", () => {
      const ctx = new WorkflowContext();
      ctx.set("a", "one");
      ctx.set("b", "two");
      expect(ctx.resolve(["{{a}}", "{{b}}"])).toEqual(["one", "two"]);
    });

    it("handles non-string/non-object values", () => {
      const ctx = new WorkflowContext();
      expect(ctx.resolve(42)).toBe(42);
      expect(ctx.resolve(true)).toBe(true);
      expect(ctx.resolve(null)).toBe(null);
    });

    it("trims whitespace in variable names", () => {
      const ctx = new WorkflowContext();
      ctx.set("name", "test");
      expect(ctx.resolve("{{ name }}")).toBe("test");
    });
  });
});
