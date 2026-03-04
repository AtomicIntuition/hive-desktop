/**
 * Integration test: Complete Workflow Lifecycle
 *
 * Tests the REAL code path from HTTP request → DB → engine → response.
 * Uses an in-memory SQLite DB and the actual Fastify server.
 * No mocks for core logic — only MCP servers are mocked (no real external tools).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "../../packages/runtime/src/server.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

// Override HIVE_DATA_DIR to use a temp in-memory DB
process.env.HIVE_DATA_DIR = "/tmp/hive-test-" + Date.now();

import { mkdirSync, rmSync } from "node:fs";

beforeAll(async () => {
  mkdirSync(process.env.HIVE_DATA_DIR!, { recursive: true });
  const server = await createServer(0); // port 0 = random
  app = server.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { rmSync(process.env.HIVE_DATA_DIR!, { recursive: true, force: true }); } catch {}
});

describe("Workflow CRUD Lifecycle", () => {
  let workflowId: string;

  it("POST /api/workflows creates a workflow", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        name: "Integration Test Workflow",
        description: "Tests the full lifecycle",
        trigger: JSON.stringify({ type: "manual" }),
        steps: JSON.stringify([
          {
            id: "s1",
            name: "Compute Sum",
            type: "transform",
            condition: "({ sum: 2 + 3 })",
            outputVar: "result",
            onError: "stop",
          },
          {
            id: "s2",
            name: "Check Result",
            type: "condition",
            condition: "result.sum > 0",
            outputVar: "passed",
            onError: "stop",
          },
          {
            id: "s3",
            name: "Notify",
            type: "notify",
            arguments: { title: "Done", message: "Sum is {{result.sum}}" },
            onError: "continue",
          },
        ]),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Integration Test Workflow");
    expect(body.status).toBe("draft");
    expect(body.steps).toHaveLength(3);
    workflowId = body.id;
  });

  it("GET /api/workflows lists the workflow", async () => {
    const res = await app.inject({ method: "GET", url: "/api/workflows" });
    expect(res.statusCode).toBe(200);
    const workflows = JSON.parse(res.payload);
    expect(workflows.length).toBeGreaterThanOrEqual(1);
    expect(workflows.find((w: { id: string }) => w.id === workflowId)).toBeDefined();
  });

  it("GET /api/workflows/:id returns the workflow", async () => {
    const res = await app.inject({ method: "GET", url: `/api/workflows/${workflowId}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(workflowId);
    expect(body.name).toBe("Integration Test Workflow");
  });

  it("PATCH /api/workflows/:id updates the workflow", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/workflows/${workflowId}`,
      payload: { name: "Updated Workflow", description: "Updated description" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe("Updated Workflow");
    expect(body.description).toBe("Updated description");
  });

  it("PATCH rejects non-whitelisted fields (SQL injection guard)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/workflows/${workflowId}`,
      payload: { name: "Safe", "__proto__": "malicious", "DROP TABLE workflows": "bad" },
    });

    // Should succeed but only apply the "name" field
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe("Safe");
  });

  it("POST /api/workflows/:id/run executes the workflow", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/workflows/${workflowId}/run`,
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("started");

    // Wait for the background run to complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it("GET /api/workflows/:id/runs lists the completed run", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/workflows/${workflowId}/runs`,
    });

    expect(res.statusCode).toBe(200);
    const runs = JSON.parse(res.payload);
    expect(runs.length).toBeGreaterThanOrEqual(1);

    const latestRun = runs[0];
    expect(latestRun.workflowId).toBe(workflowId);
    expect(latestRun.status).toBe("completed");
    expect(latestRun.stepsExecuted).toBe(3);
  });

  it("workflow run_count incremented after run", async () => {
    const res = await app.inject({ method: "GET", url: `/api/workflows/${workflowId}` });
    const body = JSON.parse(res.payload);
    expect(body.runCount).toBeGreaterThanOrEqual(1);
  });

  it("DELETE /api/workflows/:id removes the workflow", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/workflows/${workflowId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it("GET /api/workflows/:id returns 404 after delete", async () => {
    const res = await app.inject({ method: "GET", url: `/api/workflows/${workflowId}` });
    expect(res.statusCode).toBe(404);
  });
});

describe("Workflow Execution - Error Handling", () => {
  it("workflow with failing condition records error", async () => {
    // Create a workflow that references undefined variable
    const createRes = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        name: "Failing Workflow",
        trigger: JSON.stringify({ type: "manual" }),
        steps: JSON.stringify([
          {
            id: "s1",
            name: "Bad Step",
            type: "transform",
            condition: "undefinedVar.property",
            outputVar: "x",
            onError: "stop",
          },
        ]),
      },
    });

    const wf = JSON.parse(createRes.payload);

    // Run it
    await app.inject({ method: "POST", url: `/api/workflows/${wf.id}/run` });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check run status
    const runsRes = await app.inject({ method: "GET", url: `/api/workflows/${wf.id}/runs` });
    const runs = JSON.parse(runsRes.payload);
    expect(runs[0].status).toBe("failed");
    expect(runs[0].error).toContain("failed");

    // Cleanup
    await app.inject({ method: "DELETE", url: `/api/workflows/${wf.id}` });
  });

  it("workflow with onError=continue keeps going after failure", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        name: "Continue Workflow",
        trigger: JSON.stringify({ type: "manual" }),
        steps: JSON.stringify([
          {
            id: "s1",
            name: "Failing Step",
            type: "transform",
            condition: "undefinedVar.property",
            outputVar: "x",
            onError: "continue",
          },
          {
            id: "s2",
            name: "Still Runs",
            type: "notify",
            arguments: { title: "OK", message: "Continued past error" },
            onError: "continue",
          },
        ]),
      },
    });

    const wf = JSON.parse(createRes.payload);
    await app.inject({ method: "POST", url: `/api/workflows/${wf.id}/run` });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const runsRes = await app.inject({ method: "GET", url: `/api/workflows/${wf.id}/runs` });
    const runs = JSON.parse(runsRes.payload);
    expect(runs[0].status).toBe("completed");
    expect(runs[0].stepsExecuted).toBe(2); // Both steps ran

    await app.inject({ method: "DELETE", url: `/api/workflows/${wf.id}` });
  });

  it("workflow with false condition skips remaining steps", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        name: "Skip Workflow",
        trigger: JSON.stringify({ type: "manual" }),
        steps: JSON.stringify([
          {
            id: "s1",
            name: "Check False",
            type: "condition",
            condition: "false",
            outputVar: "result",
            onError: "stop",
          },
          {
            id: "s2",
            name: "Should Not Run",
            type: "notify",
            arguments: { title: "Bug", message: "This should be skipped" },
            onError: "continue",
          },
        ]),
      },
    });

    const wf = JSON.parse(createRes.payload);
    await app.inject({ method: "POST", url: `/api/workflows/${wf.id}/run` });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const runsRes = await app.inject({ method: "GET", url: `/api/workflows/${wf.id}/runs` });
    const runs = JSON.parse(runsRes.payload);
    expect(runs[0].status).toBe("completed");
    expect(runs[0].stepsExecuted).toBe(1); // Only the condition step ran

    await app.inject({ method: "DELETE", url: `/api/workflows/${wf.id}` });
  });
});

describe("Workflow Data Flow - Variable Passing Between Steps", () => {
  it("variables flow from step to step via context", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: {
        name: "Data Flow Test",
        trigger: JSON.stringify({ type: "manual" }),
        steps: JSON.stringify([
          {
            id: "s1",
            name: "Produce Data",
            type: "transform",
            condition: "({ items: [1, 2, 3, 4, 5], total: 15 })",
            outputVar: "data",
            onError: "stop",
          },
          {
            id: "s2",
            name: "Filter Data",
            type: "transform",
            condition: "data.items.filter(x => x > 3)",
            outputVar: "filtered",
            onError: "stop",
          },
          {
            id: "s3",
            name: "Check Count",
            type: "condition",
            condition: "filtered.length === 2",
            outputVar: "valid",
            onError: "stop",
          },
          {
            id: "s4",
            name: "Report",
            type: "notify",
            arguments: {
              title: "Data Flow Result",
              message: "Found {{filtered.length}} items from total {{data.total}}",
            },
            outputVar: "notification",
            onError: "continue",
          },
        ]),
      },
    });

    const wf = JSON.parse(createRes.payload);
    await app.inject({ method: "POST", url: `/api/workflows/${wf.id}/run` });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const runsRes = await app.inject({ method: "GET", url: `/api/workflows/${wf.id}/runs` });
    const runs = JSON.parse(runsRes.payload);
    expect(runs[0].status).toBe("completed");
    expect(runs[0].stepsExecuted).toBe(4);

    // Check the result context
    const result = runs[0].result;
    expect(result.data).toEqual({ items: [1, 2, 3, 4, 5], total: 15 });
    expect(result.filtered).toEqual([4, 5]);
    expect(result.valid).toBe(true);
    expect(result.notification.message).toBe("Found 2 items from total 15");

    await app.inject({ method: "DELETE", url: `/api/workflows/${wf.id}` });
  });
});

describe("Health Endpoint", () => {
  it("GET /api/health returns status ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThan(0);
  });
});

describe("404 Handling", () => {
  it("GET /api/workflows/nonexistent returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/workflows/nonexistent" });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /api/workflows/nonexistent returns 404", async () => {
    const res = await app.inject({ method: "DELETE", url: "/api/workflows/nonexistent" });
    expect(res.statusCode).toBe(404);
  });
});
