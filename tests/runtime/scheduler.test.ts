import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node-cron — default export with schedule + validate
const mockStop = vi.fn();
const mockCronSchedule = vi.fn(() => ({ stop: mockStop }));
const mockCronValidate = vi.fn(() => true);
vi.mock("node-cron", () => {
  const obj = {
    schedule: (...args: unknown[]) => mockCronSchedule(...args),
    validate: (...args: unknown[]) => mockCronValidate(...args),
  };
  return { default: obj, ...obj };
});

// Mock chokidar
const mockWatcherOn = vi.fn(function(this: unknown) { return this; });
const mockWatcherClose = vi.fn().mockResolvedValue(undefined);
vi.mock("chokidar", () => ({
  watch: () => {
    const watcher = { on: mockWatcherOn, close: mockWatcherClose };
    mockWatcherOn.mockImplementation(function() { return watcher; });
    return watcher;
  },
}));

// Mock DB
const mockAll = vi.fn(() => []);
const mockDbGet = vi.fn();
const mockDbPrepare = vi.fn(() => ({ all: mockAll, get: mockDbGet }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockDbPrepare }),
}));

// Mock runner
vi.mock("../../packages/runtime/src/workflow/runner.js", () => ({
  runWorkflow: vi.fn().mockResolvedValue({ id: "run-1", status: "completed" }),
}));

// Mock broadcast
vi.mock("../../packages/runtime/src/server.js", () => ({
  broadcast: vi.fn(),
}));

import {
  scheduleWorkflow,
  unscheduleWorkflow,
  getScheduledJobs,
  initializeScheduler,
  shutdownScheduler,
  triggerWebhook,
} from "../../packages/runtime/src/workflow/scheduler.js";
import type { Workflow } from "../../packages/shared/src/types.js";

function makeWorkflow(trigger: Workflow["trigger"], id = "wf-1"): Workflow {
  return {
    id,
    name: "Test",
    description: "",
    status: "active",
    trigger,
    steps: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    runCount: 0,
    errorCount: 0,
  };
}

describe("scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shutdownScheduler();
  });

  afterEach(() => {
    shutdownScheduler();
  });

  it("does not schedule manual triggers", () => {
    scheduleWorkflow(makeWorkflow({ type: "manual" }));
    expect(getScheduledJobs()).toHaveLength(0);
  });

  it("schedules a cron trigger and tracks it", () => {
    scheduleWorkflow(makeWorkflow({ type: "schedule", cron: "0 9 * * *" }));
    expect(getScheduledJobs()).toHaveLength(1);
    expect(getScheduledJobs()[0].trigger.type).toBe("schedule");
  });

  it("throws on invalid cron expression", () => {
    mockCronValidate.mockReturnValueOnce(false);
    expect(() =>
      scheduleWorkflow(makeWorkflow({ type: "schedule", cron: "bad" }))
    ).toThrow("Invalid cron expression");
  });

  it("schedules an interval trigger", () => {
    vi.useFakeTimers();
    scheduleWorkflow(makeWorkflow({ type: "interval", seconds: 30 }));
    expect(getScheduledJobs()).toHaveLength(1);
    expect(getScheduledJobs()[0].trigger.type).toBe("interval");
    vi.useRealTimers();
  });

  it("throws on interval < 1 second", () => {
    expect(() =>
      scheduleWorkflow(makeWorkflow({ type: "interval", seconds: 0 }))
    ).toThrow("at least 1 second");
  });

  it("schedules a file_watch trigger", () => {
    scheduleWorkflow(
      makeWorkflow({ type: "file_watch", path: "/tmp/test", event: "create" })
    );
    expect(getScheduledJobs()).toHaveLength(1);
    expect(getScheduledJobs()[0].trigger.type).toBe("file_watch");
  });

  it("registers webhook triggers", () => {
    scheduleWorkflow(makeWorkflow({ type: "webhook", path: "/hook/test" }));
    expect(getScheduledJobs()).toHaveLength(1);
  });

  it("unschedules a workflow", () => {
    scheduleWorkflow(makeWorkflow({ type: "webhook", path: "/hook" }));
    expect(getScheduledJobs()).toHaveLength(1);
    unscheduleWorkflow("wf-1");
    expect(getScheduledJobs()).toHaveLength(0);
  });

  it("replaces existing schedule when re-scheduling", () => {
    scheduleWorkflow(makeWorkflow({ type: "webhook", path: "/h1" }));
    scheduleWorkflow(makeWorkflow({ type: "webhook", path: "/h2" }));
    expect(getScheduledJobs()).toHaveLength(1);
  });

  it("initializeScheduler loads active workflows from DB", () => {
    mockAll.mockReturnValueOnce([
      {
        id: "wf-db-1",
        name: "DB Workflow",
        description: "",
        status: "active",
        trigger: JSON.stringify({ type: "manual" }),
        steps: JSON.stringify([]),
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        run_count: 0,
        error_count: 0,
      },
    ]);
    initializeScheduler();
    expect(getScheduledJobs()).toHaveLength(0); // manual = no schedule
  });

  it("shutdownScheduler clears all jobs", () => {
    scheduleWorkflow(makeWorkflow({ type: "webhook", path: "/h" }, "a"));
    scheduleWorkflow(makeWorkflow({ type: "webhook", path: "/h2" }, "b"));
    expect(getScheduledJobs()).toHaveLength(2);
    shutdownScheduler();
    expect(getScheduledJobs()).toHaveLength(0);
  });

  it("triggerWebhook finds matching workflow", async () => {
    mockAll.mockReturnValueOnce([
      {
        id: "wf-hook",
        name: "Hook WF",
        description: "",
        status: "active",
        trigger: JSON.stringify({ type: "webhook", path: "/hook/payments" }),
        steps: JSON.stringify([]),
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        run_count: 0,
        error_count: 0,
      },
    ]);
    const result = await triggerWebhook("/hook/payments");
    expect(result.triggered).toBe(true);
    expect(result.workflowId).toBe("wf-hook");
  });

  it("triggerWebhook returns false when no match", async () => {
    mockAll.mockReturnValueOnce([]);
    const result = await triggerWebhook("/hook/nonexistent");
    expect(result.triggered).toBe(false);
  });
});
