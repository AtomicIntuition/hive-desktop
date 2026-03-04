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

  it("renders NL input textarea", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    render(<WorkflowCreator />);
    expect(screen.getByPlaceholderText(/Watch my Stripe/)).toBeDefined();
  });

  it("renders Plan Workflow button", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    render(<WorkflowCreator />);
    expect(screen.getByText("Plan Workflow")).toBeDefined();
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

    // Type a prompt and trigger plan
    const textarea = screen.getByPlaceholderText(/Watch my Stripe/);
    fireEvent.change(textarea, { target: { value: "Test workflow" } });
    fireEvent.click(screen.getByText("Plan Workflow"));

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

    const textarea = screen.getByPlaceholderText(/Watch my Stripe/);
    fireEvent.change(textarea, { target: { value: "Test workflow" } });
    fireEvent.click(screen.getByText("Plan Workflow"));

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

    const textarea = screen.getByPlaceholderText(/Watch my Stripe/);
    fireEvent.change(textarea, { target: { value: "Test workflow" } });
    fireEvent.click(screen.getByText("Plan Workflow"));

    await waitFor(() => {
      expect(screen.getByText("Score: 65")).toBeDefined();
      expect(screen.getByText("2 fix passes")).toBeDefined();
    });
  });
});
