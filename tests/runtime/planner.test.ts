import { describe, it, expect, vi } from "vitest";

vi.mock("../../packages/runtime/src/ai/provider.js", () => ({
  getClient: vi.fn().mockReturnValue({
    messages: {
      create: vi.fn(),
    },
  }),
  isConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("../../packages/runtime/src/mcp/registry.js", () => ({
  getAll: vi.fn().mockReturnValue([
    { slug: "github-mcp", name: "GitHub MCP" },
    { slug: "slack-mcp", name: "Slack MCP" },
  ]),
}));

vi.mock("../../packages/runtime/src/workflow/templates.js", () => ({
  getTemplates: vi.fn().mockReturnValue([]),
}));

// Mock auditor and fixer for the self-validation loop
vi.mock("../../packages/runtime/src/ai/auditor.js", () => ({
  auditWorkflowPlan: vi.fn(),
}));

vi.mock("../../packages/runtime/src/ai/fixer.js", () => ({
  fixWorkflowPlan: vi.fn(),
}));

import { planWorkflow } from "../../packages/runtime/src/ai/planner.js";
import { getClient } from "../../packages/runtime/src/ai/provider.js";
import { auditWorkflowPlan } from "../../packages/runtime/src/ai/auditor.js";
import { fixWorkflowPlan } from "../../packages/runtime/src/ai/fixer.js";

describe("AI Planner", () => {
  it("sends prompt to Claude and parses valid JSON response", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Issue Watcher",
            description: "Watches GitHub issues",
            trigger: { type: "interval", seconds: 300 },
            steps: [
              {
                id: "fetch",
                name: "Fetch issues",
                type: "mcp_call",
                server: "github-mcp",
                tool: "list_issues",
                arguments: { state: "open" },
                outputVar: "issues",
                onError: "stop",
              },
              {
                id: "notify",
                name: "Log",
                type: "notify",
                arguments: { message: "Found issues" },
                onError: "continue",
              },
            ],
            requiredServers: ["github-mcp"],
            reasoning: "Simple issue watcher",
          }),
        },
      ],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    // Mock audit to return high score (no fix needed)
    vi.mocked(auditWorkflowPlan).mockResolvedValue({
      score: 95,
      summary: "Excellent workflow.",
      issues: [],
      suggestions: [],
    });

    const plan = await planWorkflow("Watch GitHub issues");

    expect(plan.name).toBe("Issue Watcher");
    expect(plan.description).toBe("Watches GitHub issues");
    expect(plan.trigger).toEqual({ type: "interval", seconds: 300 });
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].type).toBe("mcp_call");
    expect(plan.requiredServers).toHaveLength(1);
    expect(plan.requiredServers[0].slug).toBe("github-mcp");
    expect(plan.requiredServers[0].installed).toBe(true);
    expect(plan.reasoning).toBe("Simple issue watcher");

    // New fields from self-validation
    expect(plan.qualityScore).toBe(95);
    expect(plan.auditSummary).toBe("Excellent workflow.");
    expect(plan.iterationsUsed).toBe(0);

    // Verify Claude was called with correct model
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
      })
    );
  });

  it("handles JSON wrapped in code blocks", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: '```json\n{"name":"Test","trigger":{"type":"manual"},"steps":[{"id":"s1","name":"Step","type":"notify","onError":"stop"}],"requiredServers":[]}\n```',
        },
      ],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    vi.mocked(auditWorkflowPlan).mockResolvedValue({
      score: 90,
      summary: "Good.",
      issues: [],
      suggestions: [],
    });

    const plan = await planWorkflow("Test");
    expect(plan.name).toBe("Test");
    expect(plan.steps).toHaveLength(1);
    expect(plan.qualityScore).toBe(90);
  });

  it("marks uninstalled servers as not installed", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Stripe Alert",
            trigger: { type: "interval", seconds: 60 },
            steps: [{ id: "s1", name: "Step", type: "notify", onError: "stop" }],
            requiredServers: ["stripe-mcp", "slack-mcp"],
          }),
        },
      ],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    vi.mocked(auditWorkflowPlan).mockResolvedValue({
      score: 80,
      summary: "OK.",
      issues: [],
      suggestions: [],
    });

    const plan = await planWorkflow("Stripe alert");

    const stripe = plan.requiredServers.find((s) => s.slug === "stripe-mcp");
    const slack = plan.requiredServers.find((s) => s.slug === "slack-mcp");
    expect(stripe?.installed).toBe(false);
    expect(slack?.installed).toBe(true);
  });

  it("throws on unparseable response", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "I cannot create a workflow for that." }],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    await expect(planWorkflow("invalid")).rejects.toThrow("Could not parse workflow plan");
  });

  it("throws on invalid JSON", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "{ invalid json }" }],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    await expect(planWorkflow("bad json")).rejects.toThrow("Invalid JSON");
  });

  it("runs fix loop when audit score is below threshold", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Low Score Workflow",
            trigger: { type: "manual" },
            steps: [{ id: "s1", name: "Step", type: "mcp_call", server: "test", tool: "test", onError: "stop" }],
            requiredServers: [],
            reasoning: "test",
          }),
        },
      ],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    // First audit: low score
    vi.mocked(auditWorkflowPlan)
      .mockResolvedValueOnce({
        score: 60,
        summary: "Missing retry.",
        issues: [{ severity: "warning", message: "Missing error handling" }],
        suggestions: [],
      })
      // Second audit (after fix): better score
      .mockResolvedValueOnce({
        score: 88,
        summary: "Much better.",
        issues: [],
        suggestions: [],
      });

    vi.mocked(fixWorkflowPlan).mockResolvedValueOnce({
      name: "Low Score Workflow",
      description: "",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Step", type: "mcp_call", server: "test", tool: "test", onError: "retry", retryCount: 3, retryDelay: 3000 }],
      changes: ["Added retry"],
    });

    const plan = await planWorkflow("test workflow");

    expect(plan.qualityScore).toBe(88);
    expect(plan.iterationsUsed).toBe(1);
    expect(fixWorkflowPlan).toHaveBeenCalled();
  });

  it("keeps original when fix makes score worse and retry also fails", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Stable Workflow",
            trigger: { type: "manual" },
            steps: [{ id: "s1", name: "Step", type: "notify", onError: "continue" }],
            requiredServers: [],
          }),
        },
      ],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    // Initial audit: moderate score
    vi.mocked(auditWorkflowPlan)
      .mockResolvedValueOnce({
        score: 75,
        summary: "Decent.",
        issues: [{ severity: "warning", message: "Some issue" }],
        suggestions: [],
      })
      // Fix audit: worse
      .mockResolvedValueOnce({
        score: 50,
        summary: "Worse.",
        issues: [{ severity: "error", message: "New problem" }],
        suggestions: [],
      })
      // Retry audit: still worse
      .mockResolvedValueOnce({
        score: 60,
        summary: "Still not great.",
        issues: [{ severity: "warning", message: "Remaining" }],
        suggestions: [],
      });

    vi.mocked(fixWorkflowPlan)
      .mockResolvedValueOnce({
        name: "Stable Workflow",
        description: "",
        trigger: { type: "manual" },
        steps: [{ id: "s1", name: "Bad Fix", type: "notify", onError: "continue" }],
        changes: ["Made it worse"],
      })
      .mockResolvedValueOnce({
        name: "Stable Workflow",
        description: "",
        trigger: { type: "manual" },
        steps: [{ id: "s1", name: "Still Bad", type: "notify", onError: "continue" }],
        changes: ["Still worse"],
      });

    const plan = await planWorkflow("test");

    // Should keep original since both fixes scored below 75
    expect(plan.qualityScore).toBe(75);
    expect(plan.iterationsUsed).toBe(2);
  });

  it("returns plan without quality score when audit fails", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            name: "Audit Fail",
            trigger: { type: "manual" },
            steps: [{ id: "s1", name: "Step", type: "notify", onError: "continue" }],
            requiredServers: [],
          }),
        },
      ],
    });

    (getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: { create: mockCreate },
    });

    vi.mocked(auditWorkflowPlan).mockRejectedValue(new Error("API error"));

    const plan = await planWorkflow("test");

    expect(plan.qualityScore).toBe(0);
    expect(plan.auditSummary).toBe("Audit unavailable");
    expect(plan.iterationsUsed).toBe(0);
  });
});
