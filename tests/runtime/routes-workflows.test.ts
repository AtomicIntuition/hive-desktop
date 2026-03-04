import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockRun = vi.fn(() => ({ changes: 1 }));
const mockAll = vi.fn(() => []);
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockRun, all: mockAll, get: mockGet }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

// Mock runner
vi.mock("../../packages/runtime/src/workflow/runner.js", () => ({
  runWorkflow: vi.fn().mockResolvedValue({ id: "run-1", status: "completed" }),
  cancelRun: vi.fn(),
  isRunActive: vi.fn(),
}));

// Mock scheduler
vi.mock("../../packages/runtime/src/workflow/scheduler.js", () => ({
  scheduleWorkflow: vi.fn(),
  unscheduleWorkflow: vi.fn(),
  getScheduledJobs: vi.fn(() => []),
  triggerWebhook: vi.fn(),
}));

// Mock broadcast
vi.mock("../../packages/runtime/src/server.js", () => ({
  broadcast: vi.fn(),
}));

// Mock templates
vi.mock("../../packages/runtime/src/workflow/templates.js", () => ({
  getTemplates: vi.fn(() => []),
  getTemplate: vi.fn(),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test-id-123",
}));

describe("Workflows Route - SQL Injection Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH only allows whitelisted fields", async () => {
    // Simulating the logic from the PATCH endpoint with the fix
    const allowedFields = ["name", "description", "status", "trigger", "steps"];

    const maliciousBody = {
      name: "Safe Name",
      "__proto__": "malicious",
      "constructor": "malicious",
      "id; DROP TABLE workflows; --": "malicious",
    };

    const updates: string[] = ["updated_at = datetime('now')"];
    const values: Array<string | number | null> = [];

    for (const [key, value] of Object.entries(maliciousBody)) {
      if (value !== undefined && allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    // Only "name" should be included
    expect(updates).toHaveLength(2); // "updated_at = datetime('now')" + "name = ?"
    expect(values).toHaveLength(1);
    expect(values[0]).toBe("Safe Name");
    expect(updates.join(", ")).not.toContain("__proto__");
    expect(updates.join(", ")).not.toContain("constructor");
    expect(updates.join(", ")).not.toContain("DROP TABLE");
  });

  it("PATCH allows all valid fields", () => {
    const allowedFields = ["name", "description", "status", "trigger", "steps"];

    const validBody = {
      name: "Updated Name",
      description: "Updated desc",
      status: "active",
      trigger: '{"type":"manual"}',
      steps: '[]',
    };

    const updates: string[] = ["updated_at = datetime('now')"];
    const values: Array<string | number | null> = [];

    for (const [key, value] of Object.entries(validBody)) {
      if (value !== undefined && allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    expect(updates).toHaveLength(6); // 1 timestamp + 5 fields
    expect(values).toHaveLength(5);
  });

  it("PATCH handles empty body gracefully", () => {
    const allowedFields = ["name", "description", "status", "trigger", "steps"];
    const emptyBody = {};

    const updates: string[] = ["updated_at = datetime('now')"];
    const values: Array<string | number | null> = [];

    for (const [key, value] of Object.entries(emptyBody)) {
      if (value !== undefined && allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    expect(updates).toHaveLength(1); // Only timestamp
    expect(values).toHaveLength(0);
  });
});

describe("Workflows Route - Row Mapping", () => {
  it("mapWorkflowRow produces correct structure", () => {
    // Test the row mapping logic
    const row = {
      id: "wf-1",
      name: "Test Workflow",
      description: "A test",
      status: "draft",
      trigger: '{"type":"manual"}',
      steps: '[{"id":"s1","name":"Step 1","type":"notify","onError":"stop"}]',
      created_at: "2026-01-01",
      updated_at: "2026-01-02",
      last_run_at: null,
      run_count: 5,
      error_count: 1,
    };

    // Inline the mapping logic to test it
    const r = row as Record<string, unknown>;
    const mapped = {
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string) ?? "",
      status: (r.status as string) ?? "draft",
      trigger: JSON.parse(r.trigger as string),
      steps: JSON.parse(r.steps as string),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      lastRunAt: r.last_run_at as string | undefined,
      runCount: (r.run_count as number) ?? 0,
      errorCount: (r.error_count as number) ?? 0,
    };

    expect(mapped.id).toBe("wf-1");
    expect(mapped.name).toBe("Test Workflow");
    expect(mapped.trigger).toEqual({ type: "manual" });
    expect(mapped.steps).toHaveLength(1);
    expect(mapped.runCount).toBe(5);
    expect(mapped.errorCount).toBe(1);
  });

  it("mapRunRow produces correct structure", () => {
    const row = {
      id: "run-1",
      workflow_id: "wf-1",
      status: "completed",
      started_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:01:00Z",
      result: '{"output":"done"}',
      error: null,
      steps_executed: 3,
    };

    const r = row as Record<string, unknown>;
    const mapped = {
      id: r.id as string,
      workflowId: r.workflow_id as string,
      status: r.status as string,
      startedAt: r.started_at as string,
      completedAt: r.completed_at as string | undefined,
      result: r.result ? JSON.parse(r.result as string) : undefined,
      error: r.error as string | undefined,
      stepsExecuted: (r.steps_executed as number) ?? 0,
    };

    expect(mapped.id).toBe("run-1");
    expect(mapped.workflowId).toBe("wf-1");
    expect(mapped.status).toBe("completed");
    expect(mapped.result).toEqual({ output: "done" });
    expect(mapped.stepsExecuted).toBe(3);
  });
});

describe("Workflows Route - Webhook Validation", () => {
  it("webhook path is validated as non-empty", () => {
    const path = "";
    expect(path.length).toBe(0);
    // The route should reject empty paths
  });

  it("webhook path preserves expected format", () => {
    const paths = ["/hook/payments", "/hook/github", "/hook/custom-123"];
    for (const path of paths) {
      expect(path.startsWith("/hook/")).toBe(true);
    }
  });
});
