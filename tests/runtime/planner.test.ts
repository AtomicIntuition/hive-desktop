import { describe, it, expect, vi } from "vitest";

// We test the parsePlanResponse logic by importing the module and calling planWorkflow
// with mocked Anthropic client. However, parsePlanResponse is private, so we test
// through the public interface by mocking the AI provider.

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

import { planWorkflow } from "../../packages/runtime/src/ai/planner.js";
import { getClient } from "../../packages/runtime/src/ai/provider.js";

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

    const plan = await planWorkflow("Watch GitHub issues");

    expect(plan.name).toBe("Issue Watcher");
    expect(plan.description).toBe("Watches GitHub issues");
    expect(plan.trigger).toEqual({ type: "interval", seconds: 300 });
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].type).toBe("mcp_call");
    expect(plan.requiredServers).toHaveLength(1);
    expect(plan.requiredServers[0].slug).toBe("github-mcp");
    expect(plan.requiredServers[0].installed).toBe(true); // github-mcp is in mock installed list
    expect(plan.reasoning).toBe("Simple issue watcher");

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

    const plan = await planWorkflow("Test");
    expect(plan.name).toBe("Test");
    expect(plan.steps).toHaveLength(1);
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

    const plan = await planWorkflow("Stripe alert");

    // stripe-mcp is NOT in mock installed list, slack-mcp IS
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
});
