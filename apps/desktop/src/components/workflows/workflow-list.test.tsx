import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowList } from "./workflow-list";

const mockRefresh = vi.fn();

vi.mock("@/hooks/use-workflows", () => ({
  useWorkflows: vi.fn(),
}));

vi.mock("@/lib/runtime-client", () => ({
  activateWorkflow: vi.fn().mockResolvedValue({}),
  pauseWorkflow: vi.fn().mockResolvedValue({}),
  deleteWorkflow: vi.fn().mockResolvedValue({}),
  runWorkflow: vi.fn().mockResolvedValue({}),
}));

import { useWorkflows } from "@/hooks/use-workflows";
const mockUseWorkflows = vi.mocked(useWorkflows);

describe("WorkflowList", () => {
  it("shows empty state when no workflows", () => {
    mockUseWorkflows.mockReturnValue({ workflows: [], loading: false, refresh: mockRefresh });
    render(<WorkflowList />);
    expect(screen.getByText("No workflows yet")).toBeDefined();
  });

  it("renders workflow cards when workflows exist", () => {
    mockUseWorkflows.mockReturnValue({
      workflows: [
        {
          id: "wf-1",
          name: "Payment Monitor",
          description: "Watch payments",
          status: "active",
          trigger: { type: "manual" },
          steps: [],
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
          runCount: 5,
          errorCount: 0,
        },
      ],
      loading: false,
      refresh: mockRefresh,
    });
    render(<WorkflowList />);
    expect(screen.getByText("Payment Monitor")).toBeDefined();
  });

  it("shows loading spinner when loading", () => {
    mockUseWorkflows.mockReturnValue({ workflows: [], loading: true, refresh: mockRefresh });
    render(<WorkflowList />);
    expect(document.querySelector(".animate-spin")).toBeDefined();
  });
});
