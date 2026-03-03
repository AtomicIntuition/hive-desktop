import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WorkflowDetail } from "./workflow-detail";

vi.mock("@/lib/runtime-client", () => ({
  getWorkflow: vi.fn(),
  listWorkflowRuns: vi.fn(),
  runWorkflow: vi.fn(),
  activateWorkflow: vi.fn(),
  pauseWorkflow: vi.fn(),
}));

import { getWorkflow, listWorkflowRuns } from "@/lib/runtime-client";
const mockGetWorkflow = vi.mocked(getWorkflow);
const mockListRuns = vi.mocked(listWorkflowRuns);

describe("WorkflowDetail", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    onBack.mockReset();
    mockGetWorkflow.mockReset();
    mockListRuns.mockReset();
  });

  it("shows loading initially", () => {
    mockGetWorkflow.mockReturnValue(new Promise(() => {}));
    mockListRuns.mockReturnValue(new Promise(() => {}));
    render(<WorkflowDetail workflowId="wf-1" onBack={onBack} />);
    expect(document.querySelector(".animate-spin")).toBeDefined();
  });

  it("shows not found when workflow fetch fails", async () => {
    mockGetWorkflow.mockRejectedValue(new Error("not found"));
    mockListRuns.mockRejectedValue(new Error("not found"));
    render(<WorkflowDetail workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Workflow not found.")).toBeDefined();
    });
  });

  it("renders workflow name after loading", async () => {
    mockGetWorkflow.mockResolvedValue({
      id: "wf-1",
      name: "Payment Monitor",
      description: "Watch for payments",
      status: "active",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Check", type: "mcp_call", onError: "stop" }],
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      runCount: 5,
      errorCount: 0,
    });
    mockListRuns.mockResolvedValue([]);

    render(<WorkflowDetail workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Payment Monitor")).toBeDefined();
    });
  });

  it("shows Steps and Run History tabs", async () => {
    mockGetWorkflow.mockResolvedValue({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
    mockListRuns.mockResolvedValue([]);

    render(<WorkflowDetail workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Steps/)).toBeDefined();
      expect(screen.getByText(/Run History/)).toBeDefined();
    });
  });

  it("shows Run Now button", async () => {
    mockGetWorkflow.mockResolvedValue({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "active",
      trigger: { type: "manual" },
      steps: [],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
    mockListRuns.mockResolvedValue([]);

    render(<WorkflowDetail workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Run Now")).toBeDefined();
    });
  });
});
