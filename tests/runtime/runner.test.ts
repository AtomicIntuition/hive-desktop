import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockRun, get: mockGet }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

// Mock broadcast
const mockBroadcast = vi.fn();
vi.mock("../../packages/runtime/src/server.js", () => ({
  broadcast: (...args: unknown[]) => mockBroadcast(...args),
}));

// Mock engine
const mockExecuteStep = vi.fn();
vi.mock("../../packages/runtime/src/workflow/engine.js", () => ({
  executeStep: (...args: unknown[]) => mockExecuteStep(...args),
}));

// Mock nanoid
vi.mock("nanoid", () => ({ nanoid: () => "run-123" }));

import { runWorkflow, cancelRun, isRunActive } from "../../packages/runtime/src/workflow/runner.js";
import type { Workflow } from "../../packages/shared/src/types.js";

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    name: "Test Workflow",
    description: "A test",
    status: "active",
    trigger: { type: "manual" },
    steps: [
      { id: "s1", name: "Step 1", type: "transform", arguments: { expression: "'hello'" }, onError: "stop" },
      { id: "s2", name: "Step 2", type: "transform", arguments: { expression: "'world'" }, onError: "stop" },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    runCount: 0,
    errorCount: 0,
    ...overrides,
  };
}

describe("runWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteStep.mockResolvedValue({ success: true, output: "ok" });
  });

  it("creates a run record and executes all steps", async () => {
    const wf = makeWorkflow();
    const result = await runWorkflow(wf);

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("string");
    expect(result.workflowId).toBe("wf-1");
    expect(result.status).toBe("completed");
    expect(result.stepsExecuted).toBe(2);
    expect(result.error).toBeUndefined();
    expect(mockExecuteStep).toHaveBeenCalledTimes(2);
  });

  it("broadcasts run start and complete events", async () => {
    await runWorkflow(makeWorkflow());

    const events = mockBroadcast.mock.calls.map((c) => c[0].type);
    expect(events).toContain("workflow:run:start");
    expect(events).toContain("workflow:run:complete");
    expect(events).toContain("workflow:run:step");
  });

  it("stops on error when onError is 'stop'", async () => {
    mockExecuteStep
      .mockResolvedValueOnce({ success: true, output: "ok" })
      .mockResolvedValueOnce({ success: false, error: "boom" });

    const wf = makeWorkflow();
    const result = await runWorkflow(wf);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("Step \"Step 2\" failed");
    expect(result.stepsExecuted).toBe(2);
  });

  it("continues on error when onError is 'continue'", async () => {
    mockExecuteStep
      .mockResolvedValueOnce({ success: false, error: "oops" })
      .mockResolvedValueOnce({ success: true, output: "fine" });

    const wf = makeWorkflow({
      steps: [
        { id: "s1", name: "Step 1", type: "transform", arguments: { expression: "'x'" }, onError: "continue" },
        { id: "s2", name: "Step 2", type: "transform", arguments: { expression: "'y'" }, onError: "stop" },
      ],
    });

    const result = await runWorkflow(wf);
    expect(result.status).toBe("completed");
    expect(result.stepsExecuted).toBe(2);
  });

  it("skips remaining steps when condition returns skipped", async () => {
    mockExecuteStep.mockResolvedValue({ success: true, skipped: true, output: false });

    const wf = makeWorkflow({
      steps: [
        { id: "s1", name: "Cond", type: "condition", condition: "false", onError: "stop" },
        { id: "s2", name: "Never", type: "transform", arguments: { expression: "'x'" }, onError: "stop" },
      ],
    });

    const result = await runWorkflow(wf);
    expect(result.stepsExecuted).toBe(1);
    expect(result.status).toBe("completed");
  });

  it("handles step throwing an exception", async () => {
    mockExecuteStep.mockRejectedValueOnce(new Error("crash"));

    const wf = makeWorkflow({
      steps: [{ id: "s1", name: "Crasher", type: "transform", arguments: {}, onError: "stop" }],
    });

    const result = await runWorkflow(wf);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("Crasher");
  });

  it("updates workflow counters in DB on completion", async () => {
    await runWorkflow(makeWorkflow());
    // Should call prepare multiple times for INSERT run, UPDATE run, UPDATE workflow
    expect(mockPrepare).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
  });
});

describe("cancelRun", () => {
  it("returns false for non-existent run", () => {
    expect(cancelRun("nonexistent")).toBe(false);
  });
});

describe("isRunActive", () => {
  it("returns false for non-existent run", () => {
    expect(isRunActive("nonexistent")).toBe(false);
  });
});
