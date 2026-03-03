import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WorkflowCreator } from "./workflow-creator";

vi.mock("@/lib/runtime-client", () => ({
  planWorkflowAI: vi.fn(),
  confirmWorkflowPlan: vi.fn(),
  getAiStatus: vi.fn(),
  installServer: vi.fn(),
  listWorkflows: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/use-workflows", () => ({
  useWorkflows: vi.fn().mockReturnValue({ refresh: vi.fn() }),
}));

import { getAiStatus } from "@/lib/runtime-client";
const mockGetAiStatus = vi.mocked(getAiStatus);

describe("WorkflowCreator", () => {
  beforeEach(() => {
    mockGetAiStatus.mockReset();
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
});
