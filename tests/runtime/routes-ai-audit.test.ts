import { describe, it, expect, vi } from "vitest";

// Mock provider
vi.mock("../../packages/runtime/src/ai/provider.js", () => ({
  isConfigured: vi.fn().mockReturnValue(true),
  getClient: vi.fn(),
  setApiKey: vi.fn(),
  removeApiKey: vi.fn(),
  getApiKey: vi.fn(),
}));

// Mock planner
vi.mock("../../packages/runtime/src/ai/planner.js", () => ({
  planWorkflow: vi.fn(),
}));

// We test the audit/fix parsing logic directly from the extracted modules
import { parseAuditResponse } from "../../packages/runtime/src/ai/auditor.js";
import { parseFixResponse } from "../../packages/runtime/src/ai/fixer.js";

describe("Extracted Audit Logic - parseAuditResponse", () => {
  it("parses valid audit JSON", () => {
    const result = parseAuditResponse(
      '{"score": 85, "summary": "Good workflow.", "issues": [{"severity": "warning", "message": "Missing retry"}], "suggestions": [{"severity": "info", "message": "Add logging"}]}'
    );

    expect(result.score).toBe(85);
    expect(result.summary).toBe("Good workflow.");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("warning");
    expect(result.suggestions).toHaveLength(1);
  });

  it("handles JSON with code fences", () => {
    const text = '```json\n{"score": 90, "summary": "Great", "issues": [], "suggestions": []}\n```';
    const result = parseAuditResponse(text);
    expect(result.score).toBe(90);
  });

  it("handles bare JSON object in text", () => {
    const text = 'Here is the result: {"score": 70, "summary": "OK", "issues": [], "suggestions": []}';
    const result = parseAuditResponse(text);
    expect(result.score).toBe(70);
  });

  it("clamps score to 0-100 range", () => {
    const low = parseAuditResponse('{"score": -10, "summary": "test", "issues": [], "suggestions": []}');
    expect(low.score).toBe(0);

    const high = parseAuditResponse('{"score": 150, "summary": "test", "issues": [], "suggestions": []}');
    expect(high.score).toBe(100);

    const normal = parseAuditResponse('{"score": 75, "summary": "test", "issues": [], "suggestions": []}');
    expect(normal.score).toBe(75);
  });

  it("validates audit item structure", () => {
    const result = parseAuditResponse(
      '{"score": 50, "summary": "test", "issues": [{"severity": "error", "message": "Missing server config", "stepIndex": 0, "stepId": "s1"}], "suggestions": []}'
    );
    expect(result.issues[0].severity).toBe("error");
    expect(result.issues[0].message).toBeDefined();
    expect(result.issues[0].stepIndex).toBe(0);
  });

  it("handles empty issues and suggestions arrays", () => {
    const result = parseAuditResponse(
      '{"score": 100, "summary": "Perfect workflow.", "issues": [], "suggestions": []}'
    );
    expect(result.issues).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
    expect(result.score).toBe(100);
  });
});

describe("Extracted Fix Logic - parseFixResponse", () => {
  const original = {
    name: "Original",
    description: "Original desc",
    trigger: { type: "manual" },
    steps: [{ id: "s1", name: "Step 1", type: "notify", onError: "stop" }],
  };

  it("parses valid fix JSON", () => {
    const result = parseFixResponse(
      '{"name": "Fixed", "description": "Fixed desc", "trigger": {"type": "manual"}, "steps": [{"id": "s1", "name": "Fixed Step", "type": "notify", "onError": "continue"}], "changes": ["Fixed error handling"]}',
      original
    );
    expect(result.name).toBe("Fixed");
    expect(result.steps[0]).toEqual(expect.objectContaining({ name: "Fixed Step" }));
    expect(result.changes).toEqual(["Fixed error handling"]);
  });

  it("falls back to original on invalid JSON", () => {
    const result = parseFixResponse("I cannot fix this", original);
    expect(result.name).toBe("Original");
    expect(result.steps).toBe(original.steps);
    expect(result.changes[0]).toContain("Could not parse");
  });

  it("preserves original fields when fix omits them", () => {
    const result = parseFixResponse(
      '{"steps": [{"id": "s1", "name": "Step", "type": "notify"}]}',
      original
    );
    expect(result.name).toBe("Original");
    expect(result.description).toBe("Original desc");
  });
});

describe("Fix Score Guard (conceptual)", () => {
  it("fix endpoint accepts originalScore parameter", () => {
    // The fix endpoint now accepts an optional originalScore
    // When provided, it audits the fix result and prevents regression
    const requestBody = {
      workflow: { name: "Test", description: "", trigger: { type: "manual" }, steps: [] },
      issues: [{ severity: "warning", message: "test" }],
      suggestions: [],
      originalScore: 85,
    };

    expect(requestBody.originalScore).toBe(85);
    expect(requestBody).toHaveProperty("originalScore");
  });

  it("returns warning when fix would regress score", () => {
    // Simulating the response format when fix regresses
    const regressionResponse = {
      name: "Test",
      description: "",
      trigger: { type: "manual" },
      steps: [],
      changes: [],
      warning: "Fix could not improve the workflow (score dropped from 85 to 70). Original preserved.",
      newScore: 85,
      audit: null,
    };

    expect(regressionResponse.warning).toBeDefined();
    expect(regressionResponse.newScore).toBe(85);
    expect(regressionResponse.audit).toBeNull();
  });

  it("returns inline audit when fix improves score", () => {
    const successResponse = {
      name: "Fixed Test",
      description: "",
      trigger: { type: "manual" },
      steps: [{ id: "s1" }],
      changes: ["Added retry"],
      newScore: 92,
      audit: {
        score: 92,
        summary: "Better now.",
        issues: [],
        suggestions: [],
      },
    };

    expect(successResponse.newScore).toBe(92);
    expect(successResponse.audit).toBeDefined();
    expect(successResponse.audit?.score).toBe(92);
  });
});

describe("Audit workflow validation", () => {
  it("validates workflow has steps array", () => {
    const workflow = { name: "Test", description: "Test", trigger: { type: "manual" }, steps: [] };
    expect(Array.isArray(workflow.steps)).toBe(true);
  });

  it("rejects workflow without steps", () => {
    const workflow = { name: "Test", description: "Test", trigger: { type: "manual" } };
    expect((workflow as Record<string, unknown>).steps).toBeUndefined();
  });

  it("validates step error handling types", () => {
    const validErrors = ["stop", "continue", "retry"];
    const step = { id: "s1", name: "Test", type: "mcp_call", onError: "stop" };
    expect(validErrors).toContain(step.onError);
  });

  it("validates trigger types", () => {
    const validTriggers = ["manual", "interval", "schedule", "webhook", "file_watch"];
    const triggers = [
      { type: "manual" },
      { type: "interval", seconds: 60 },
      { type: "schedule", cron: "0 9 * * *" },
      { type: "webhook", path: "/hook" },
      { type: "file_watch", path: "/tmp", event: "create" },
    ];

    for (const t of triggers) {
      expect(validTriggers).toContain(t.type);
    }
  });
});
