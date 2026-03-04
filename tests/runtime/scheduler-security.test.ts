import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { homedir } from "node:os";
import { resolve } from "node:path";

// Mock node-cron
const mockStop = vi.fn();
vi.mock("node-cron", () => {
  const obj = {
    schedule: vi.fn(() => ({ stop: mockStop })),
    validate: vi.fn(() => true),
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
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: vi.fn(() => ({ all: vi.fn(() => []), get: vi.fn() })) }),
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
  shutdownScheduler,
} from "../../packages/runtime/src/workflow/scheduler.js";
import type { Workflow } from "../../packages/shared/src/types.js";

function makeWorkflow(trigger: Workflow["trigger"], id = "wf-sec"): Workflow {
  return {
    id,
    name: "Security Test",
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

describe("Scheduler Security - Path Traversal Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shutdownScheduler();
  });

  afterEach(() => {
    shutdownScheduler();
  });

  it("allows file watch within home directory", () => {
    const home = homedir();
    expect(() =>
      scheduleWorkflow(
        makeWorkflow({ type: "file_watch", path: `${home}/Documents/test.txt`, event: "create" })
      )
    ).not.toThrow();
  });

  it("allows file watch within /tmp", () => {
    expect(() =>
      scheduleWorkflow(
        makeWorkflow({ type: "file_watch", path: "/tmp/watch-dir", event: "modify" })
      )
    ).not.toThrow();
  });

  it("allows file watch within working directory", () => {
    const cwd = resolve(".");
    expect(() =>
      scheduleWorkflow(
        makeWorkflow({ type: "file_watch", path: `${cwd}/data/output`, event: "create" })
      )
    ).not.toThrow();
  });

  it("blocks file watch on /etc/passwd", () => {
    expect(() =>
      scheduleWorkflow(
        makeWorkflow({ type: "file_watch", path: "/etc/passwd", event: "modify" })
      )
    ).toThrow("File watch path must be within");
  });

  it("blocks file watch on /var/log", () => {
    expect(() =>
      scheduleWorkflow(
        makeWorkflow({ type: "file_watch", path: "/var/log/system.log", event: "modify" })
      )
    ).toThrow("File watch path must be within");
  });

  it("blocks path traversal attempts", () => {
    const home = homedir();
    expect(() =>
      scheduleWorkflow(
        makeWorkflow({ type: "file_watch", path: `${home}/../../etc/shadow`, event: "modify" })
      )
    ).toThrow("File watch path must be within");
  });

  it("blocks absolute paths outside allowed directories", () => {
    expect(() =>
      scheduleWorkflow(
        makeWorkflow({ type: "file_watch", path: "/usr/local/bin/malicious", event: "create" })
      )
    ).toThrow("File watch path must be within");
  });
});
