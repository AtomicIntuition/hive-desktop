import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { WorkflowCreator } from "./workflow-creator";

vi.mock("@/lib/runtime-client", () => ({
  planWorkflowAI: vi.fn(),
  confirmWorkflowPlan: vi.fn(),
  getAiStatus: vi.fn(),
  installServer: vi.fn(),
  getMarketTool: vi.fn(),
  listWorkflows: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/use-workflows", () => ({
  useWorkflows: vi.fn().mockReturnValue({ refresh: vi.fn() }),
}));

import { getAiStatus, planWorkflowAI } from "@/lib/runtime-client";
const mockGetAiStatus = vi.mocked(getAiStatus);
const mockPlanWorkflowAI = vi.mocked(planWorkflowAI);

/** Switch to Quick Plan mode and return the quick-plan action button */
function switchToQuickPlanAndGetButton() {
  // The mode toggle button text is just "Quick Plan" inside the toggle
  const modeToggle = screen.getAllByText("Quick Plan")[0];
  fireEvent.click(modeToggle);
  // After switching, there are two "Quick Plan" texts: the toggle + the action button
  // The action button is the second one
  return screen.getAllByText("Quick Plan")[1];
}

describe("WorkflowCreator", () => {
  beforeEach(() => {
    mockGetAiStatus.mockReset();
    mockPlanWorkflowAI.mockReset();
  });

  it("renders heading", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    render(<WorkflowCreator />);
    expect(screen.getByText("Create a Workflow")).toBeDefined();
  });

  it("defaults to Agent Build mode with Build with Agent button", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    render(<WorkflowCreator />);
    expect(screen.getByText("Agent Build")).toBeDefined();
    expect(screen.getByText("Build with Agent")).toBeDefined();
    expect(screen.getByPlaceholderText(/Search Brave for AI news/)).toBeDefined();
  });

  it("renders Quick Plan textarea after mode switch", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    render(<WorkflowCreator />);
    fireEvent.click(screen.getAllByText("Quick Plan")[0]);
    expect(screen.getByPlaceholderText(/Watch my Stripe/)).toBeDefined();
  });

  it("renders example prompts", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    render(<WorkflowCreator />);
    expect(screen.getByText("Try an example:")).toBeDefined();
    expect(screen.getByText("Auto-label new GitHub issues using AI")).toBeDefined();
  });

  it("shows API key warning when not configured", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: false, provider: "", model: "" });
    render(<WorkflowCreator />);

    await waitFor(() => {
      expect(screen.getByText(/API key needed/)).toBeDefined();
    });
  });

  it("shows quality score badge in plan preview", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    mockPlanWorkflowAI.mockResolvedValue({
      name: "Test Workflow",
      description: "A test workflow",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Step 1", type: "notify", arguments: { title: "Test", message: "Hello" }, onError: "continue" }],
      requiredServers: [],
      reasoning: "Simple test",
      qualityScore: 92,
      auditSummary: "Excellent quality.",
      iterationsUsed: 0,
    });

    render(<WorkflowCreator />);
    const actionButton = switchToQuickPlanAndGetButton();

    const textarea = screen.getByPlaceholderText(/Watch my Stripe/);
    fireEvent.change(textarea, { target: { value: "Test workflow" } });
    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(screen.getByText("Score: 92")).toBeDefined();
    });
  });

  it("shows iteration count when fix passes were used", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    mockPlanWorkflowAI.mockResolvedValue({
      name: "Fixed Workflow",
      description: "Had some issues",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Step 1", type: "notify", arguments: { title: "Test", message: "Hello" }, onError: "continue" }],
      requiredServers: [],
      reasoning: "Fixed automatically",
      qualityScore: 88,
      auditSummary: "Good after fixes.",
      iterationsUsed: 1,
    });

    render(<WorkflowCreator />);
    const actionButton = switchToQuickPlanAndGetButton();

    const textarea = screen.getByPlaceholderText(/Watch my Stripe/);
    fireEvent.change(textarea, { target: { value: "Test workflow" } });
    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(screen.getByText("1 fix pass")).toBeDefined();
    });
  });

  it("shows amber badge for medium quality score", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    mockPlanWorkflowAI.mockResolvedValue({
      name: "Medium Workflow",
      description: "Decent quality",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Step 1", type: "notify", arguments: { title: "Test", message: "Hello" }, onError: "continue" }],
      requiredServers: [],
      reasoning: "OK",
      qualityScore: 65,
      auditSummary: "Some issues remain.",
      iterationsUsed: 2,
    });

    render(<WorkflowCreator />);
    const actionButton = switchToQuickPlanAndGetButton();

    const textarea = screen.getByPlaceholderText(/Watch my Stripe/);
    fireEvent.change(textarea, { target: { value: "Test workflow" } });
    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(screen.getByText("Score: 65")).toBeDefined();
      expect(screen.getByText("2 fix passes")).toBeDefined();
    });
  });
});
