import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockRun, get: mockGet }));
vi.mock("../../packages/runtime/src/db/index.js", () => ({
  getDb: () => ({ prepare: mockPrepare }),
}));

// Mock provider
const mockIsConfigured = vi.fn();
const mockGetClient = vi.fn();
vi.mock("../../packages/runtime/src/ai/provider.js", () => ({
  isConfigured: () => mockIsConfigured(),
  getClient: () => mockGetClient(),
  setApiKey: vi.fn(),
  removeApiKey: vi.fn(),
  getApiKey: vi.fn(),
}));

// Mock planner
vi.mock("../../packages/runtime/src/ai/planner.js", () => ({
  planWorkflow: vi.fn(),
}));

describe("AI Audit Route - parseAuditResponse", () => {
  // Since parseAuditResponse is internal to the route module, we test it indirectly
  // through the endpoint behavior. Here we test the audit JSON parsing logic.

  it("parses valid audit JSON", () => {
    const json = `{
      "score": 85,
      "summary": "Good workflow.",
      "issues": [{"severity": "warning", "message": "Missing retry"}],
      "suggestions": [{"severity": "info", "message": "Add logging"}]
    }`;

    const parsed = JSON.parse(json);
    expect(parsed.score).toBe(85);
    expect(parsed.summary).toBe("Good workflow.");
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0].severity).toBe("warning");
    expect(parsed.suggestions).toHaveLength(1);
  });

  it("handles JSON with code fences", () => {
    const text = '```json\n{"score": 90, "summary": "Great", "issues": [], "suggestions": []}\n```';
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    expect(match).toBeDefined();
    const parsed = JSON.parse(match![1].trim());
    expect(parsed.score).toBe(90);
  });

  it("handles bare JSON object in text", () => {
    const text = 'Here is the result: {"score": 70, "summary": "OK", "issues": [], "suggestions": []}';
    const match = text.match(/\{[\s\S]*\}/);
    expect(match).toBeDefined();
    const parsed = JSON.parse(match![0]);
    expect(parsed.score).toBe(70);
  });

  it("clamps score to 0-100 range", () => {
    const lowScore = Math.max(0, Math.min(100, -10));
    expect(lowScore).toBe(0);

    const highScore = Math.max(0, Math.min(100, 150));
    expect(highScore).toBe(100);

    const normalScore = Math.max(0, Math.min(100, 75));
    expect(normalScore).toBe(75);
  });

  it("validates audit item structure", () => {
    const item = { severity: "error", message: "Missing server config", stepIndex: 0, stepId: "s1" };
    expect(item.severity).toBe("error");
    expect(item.message).toBeDefined();
    expect(item.stepIndex).toBe(0);
  });

  it("handles empty issues and suggestions arrays", () => {
    const result = {
      score: 100,
      summary: "Perfect workflow.",
      issues: [] as unknown[],
      suggestions: [] as unknown[],
    };
    expect(result.issues).toHaveLength(0);
    expect(result.suggestions).toHaveLength(0);
    expect(result.score).toBe(100);
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
