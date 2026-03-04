import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { WorkflowEditor } from "./workflow-editor";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";

vi.mock("@/lib/runtime-client", () => ({
  getWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  runWorkflow: vi.fn(),
  auditWorkflow: vi.fn(),
  fixWorkflow: vi.fn(),
  modifyWorkflow: vi.fn(),
  listWorkflowRuns: vi.fn(),
  getWorkflowRun: vi.fn(),
  listServers: vi.fn().mockResolvedValue([]),
  listServerTools: vi.fn().mockResolvedValue({ tools: [] }),
  getMarketTool: vi.fn().mockRejectedValue(new Error("not found")),
}));

vi.mock("@/hooks/use-websocket-editor", () => ({
  useWebSocketEditor: vi.fn(),
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: vi.fn((selector) => {
    const state = { runtimeConnected: true, runtimePort: 45678, appVersion: "0.3.1", sidebarCollapsed: false };
    return selector ? selector(state) : state;
  }),
}));

import {
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
  auditWorkflow,
  modifyWorkflow,
  listWorkflowRuns,
} from "@/lib/runtime-client";

const mockGetWorkflow = vi.mocked(getWorkflow);
const mockUpdateWorkflow = vi.mocked(updateWorkflow);
const mockDeleteWorkflow = vi.mocked(deleteWorkflow);
const mockRunWorkflow = vi.mocked(runWorkflow);
const mockAuditWorkflow = vi.mocked(auditWorkflow);
const mockModifyWorkflow = vi.mocked(modifyWorkflow);
const mockListRuns = vi.mocked(listWorkflowRuns);

const testWorkflow = {
  id: "wf-1",
  name: "Payment Monitor",
  description: "Watch for large payments",
  status: "draft" as const,
  trigger: { type: "manual" as const },
  steps: [
    { id: "s1", name: "Search Payments", type: "mcp_call" as const, server: "stripe-mcp", tool: "list-charges", arguments: { limit: 10 }, outputVar: "payments", onError: "stop" as const },
    { id: "s2", name: "Check Amount", type: "condition" as const, condition: "payments.length > 0", outputVar: "hasPayments", onError: "stop" as const },
  ],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  runCount: 3,
  errorCount: 0,
};

describe("WorkflowEditor", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useWorkflowEditorStore.getState().reset();
    mockListRuns.mockResolvedValue([]);
  });

  it("shows loading spinner initially", () => {
    mockGetWorkflow.mockReturnValue(new Promise(() => {}));
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);
    expect(document.querySelector(".animate-spin")).toBeDefined();
  });

  it("shows not-found when workflow fails to load", async () => {
    mockGetWorkflow.mockRejectedValue(new Error("not found"));
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Workflow not found.")).toBeDefined();
    });
  });

  it("renders workflow name in editable input after loading", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue("Payment Monitor");
      expect(nameInput).toBeDefined();
    });
  });

  it("renders all three tabs", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Editor (2)")).toBeDefined();
      expect(screen.getByText("Runs")).toBeDefined();
      expect(screen.getByText("JSON")).toBeDefined();
    });
  });

  it("renders step cards in editor tab", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      // Step names may appear in both step cards and data flow panel
      expect(screen.getAllByText("Search Payments").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Check Amount").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows trigger type selector", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Trigger")).toBeDefined();
    });
  });

  it("shows Save button disabled when not dirty", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      const saveBtn = screen.getByText("Save");
      expect(saveBtn.closest("button")?.disabled).toBe(true);
    });
  });

  it("shows Run button", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Run")).toBeDefined();
    });
  });

  it("shows Audit button", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Audit")).toBeDefined();
    });
  });

  it("shows status and metadata", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeDefined();
      expect(screen.getByText("Manual trigger")).toBeDefined();
      expect(screen.getByText("2 steps")).toBeDefined();
    });
  });

  it("shows Add Step button", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Add Step")).toBeDefined();
    });
  });

  it("shows description textarea", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      const desc = screen.getByDisplayValue("Watch for large payments");
      expect(desc).toBeDefined();
    });
  });

  it("switching to JSON tab shows JSON content", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("JSON")).toBeDefined();
    });

    fireEvent.click(screen.getByText("JSON"));

    await waitFor(() => {
      expect(screen.getByText("Workflow JSON")).toBeDefined();
    });
  });

  it("shows delete confirmation dialog", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    // Wait for the editor to load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Payment Monitor")).toBeDefined();
    });

    // Click delete button
    const deleteBtn = document.querySelector('[title="Delete workflow"]') as HTMLElement;
    expect(deleteBtn).not.toBeNull();
    fireEvent.click(deleteBtn);

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/Delete Workflow/)).toBeDefined();
      expect(screen.getByText(/cannot be undone/)).toBeDefined();
    });
  });

  it("calls onBack after successful delete", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    mockDeleteWorkflow.mockResolvedValue(undefined);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    // Wait for load
    await waitFor(() => {
      expect(screen.getByDisplayValue("Payment Monitor")).toBeDefined();
    });

    // Click delete button
    const deleteTrigger = document.querySelector('[title="Delete workflow"]') as HTMLElement;
    fireEvent.click(deleteTrigger);

    // Wait for dialog to appear, then click the confirm "Delete" button
    await waitFor(() => {
      expect(screen.getByText(/Delete Workflow/)).toBeDefined();
    });

    // Find the confirm button (red colored one)
    const allButtons = Array.from(document.querySelectorAll("button"));
    const confirmBtn = allButtons.find(
      (b) => b.textContent === "Delete" && b.className.includes("bg-red-600")
    );
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteWorkflow).toHaveBeenCalledWith("wf-1");
      expect(onBack).toHaveBeenCalled();
    });
  });

  it("shows AI modify prompt input", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ask AI to modify this workflow...")).toBeDefined();
    });
  });

  it("shows Dice reimagine button", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Dice")).toBeDefined();
    });
  });

  it("Dice button shows held count badge when steps are held", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Dice")).toBeDefined();
    });

    // Hold a step
    useWorkflowEditorStore.getState().toggleHeld("s1");

    // Re-render to pick up state change
    await waitFor(() => {
      expect(screen.getByText("1")).toBeDefined();
    });
  });

  it("calls modifyWorkflow when submitting AI prompt", async () => {
    mockGetWorkflow.mockResolvedValue(testWorkflow);
    mockModifyWorkflow.mockResolvedValue({
      name: "Updated Monitor",
      description: "Updated desc",
      trigger: { type: "manual" },
      steps: testWorkflow.steps,
      changes: ["Renamed workflow"],
    });
    render(<WorkflowEditor workflowId="wf-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ask AI to modify this workflow...")).toBeDefined();
    });

    const input = screen.getByPlaceholderText("Ask AI to modify this workflow...");
    fireEvent.change(input, { target: { value: "Rename this workflow" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockModifyWorkflow).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("Changes applied")).toBeDefined();
      expect(screen.getByText("Renamed workflow")).toBeDefined();
    });
  });
});
