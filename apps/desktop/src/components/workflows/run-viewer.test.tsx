import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { RunsTab, LiveRunOverlay } from "./run-viewer";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";

vi.mock("@/lib/runtime-client", () => ({
  listWorkflowRuns: vi.fn(),
  getWorkflowRun: vi.fn(),
}));

import { listWorkflowRuns, getWorkflowRun } from "@/lib/runtime-client";
const mockListRuns = vi.mocked(listWorkflowRuns);
const mockGetRun = vi.mocked(getWorkflowRun);

const testWorkflow = {
  id: "wf-1",
  name: "Test",
  description: "",
  status: "draft" as const,
  trigger: { type: "manual" as const },
  steps: [
    { id: "s1", name: "Step 1", type: "mcp_call" as const, server: "test", tool: "test", onError: "stop" as const },
    { id: "s2", name: "Step 2", type: "transform" as const, condition: "true", onError: "stop" as const },
  ],
  createdAt: "",
  updatedAt: "",
  runCount: 0,
  errorCount: 0,
};

describe("RunsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkflowEditorStore.getState().reset();
    useWorkflowEditorStore.getState().load(testWorkflow);
  });

  it("shows loading spinner initially", () => {
    mockListRuns.mockReturnValue(new Promise(() => {}));
    render(<RunsTab />);
    expect(document.querySelector(".animate-spin")).toBeDefined();
  });

  it("shows empty state when no runs", async () => {
    mockListRuns.mockResolvedValue([]);
    render(<RunsTab />);

    await waitFor(() => {
      expect(screen.getByText("No runs yet")).toBeDefined();
    });
  });

  it("renders run list", async () => {
    mockListRuns.mockResolvedValue([
      {
        id: "run-1",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-01-01T10:00:00Z",
        completedAt: "2026-01-01T10:00:05Z",
        stepsExecuted: 2,
      },
      {
        id: "run-2",
        workflowId: "wf-1",
        status: "failed",
        startedAt: "2026-01-01T09:00:00Z",
        completedAt: "2026-01-01T09:00:03Z",
        error: "Step failed",
        stepsExecuted: 1,
      },
    ]);

    render(<RunsTab />);

    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeDefined();
      expect(screen.getByText("Failed")).toBeDefined();
      expect(screen.getByText("2 steps")).toBeDefined();
      expect(screen.getByText("1 steps")).toBeDefined();
    });
  });

  it("shows error message for failed runs", async () => {
    mockListRuns.mockResolvedValue([
      {
        id: "run-1",
        workflowId: "wf-1",
        status: "failed",
        startedAt: "2026-01-01T09:00:00Z",
        error: "Connection timeout",
        stepsExecuted: 1,
      },
    ]);

    render(<RunsTab />);

    await waitFor(() => {
      expect(screen.getByText("Connection timeout")).toBeDefined();
    });
  });

  it("clicking a run shows detail panel", async () => {
    mockListRuns.mockResolvedValue([
      {
        id: "run-1",
        workflowId: "wf-1",
        status: "completed",
        startedAt: "2026-01-01T10:00:00Z",
        completedAt: "2026-01-01T10:00:05Z",
        stepsExecuted: 2,
        result: { results: [1, 2, 3] },
      },
    ]);
    mockGetRun.mockResolvedValue({
      id: "run-1",
      workflowId: "wf-1",
      status: "completed",
      startedAt: "2026-01-01T10:00:00Z",
      completedAt: "2026-01-01T10:00:05Z",
      stepsExecuted: 2,
      result: { results: [1, 2, 3] },
    });

    render(<RunsTab />);

    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Completed").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("Back to runs")).toBeDefined();
      expect(screen.getByText("Step Outputs")).toBeDefined();
    });
  });
});

describe("LiveRunOverlay", () => {
  beforeEach(() => {
    useWorkflowEditorStore.getState().reset();
    useWorkflowEditorStore.getState().load(testWorkflow);
  });

  it("renders nothing when no active run", () => {
    const { container } = render(<LiveRunOverlay />);
    expect(container.innerHTML).toBe("");
  });

  it("shows Running status with step names", () => {
    useWorkflowEditorStore.getState().setActiveRun("run-1");
    render(<LiveRunOverlay />);

    expect(screen.getByText("Running...")).toBeDefined();
    expect(screen.getByText("Step 1")).toBeDefined();
    expect(screen.getByText("Step 2")).toBeDefined();
  });

  it("shows step status icons", () => {
    useWorkflowEditorStore.getState().setActiveRun("run-1");
    useWorkflowEditorStore.getState().updateStepStatus({
      runId: "run-1",
      stepIndex: 0,
      stepId: "s1",
      status: "completed",
      durationMs: 500,
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T00:00:00Z",
    });

    render(<LiveRunOverlay />);
    expect(screen.getByText("500ms")).toBeDefined();
  });

  it("shows duration in seconds for longer steps", () => {
    useWorkflowEditorStore.getState().setActiveRun("run-1");
    useWorkflowEditorStore.getState().updateStepStatus({
      runId: "run-1",
      stepIndex: 0,
      stepId: "s1",
      status: "completed",
      durationMs: 2500,
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T00:00:00Z",
    });

    render(<LiveRunOverlay />);
    expect(screen.getByText("2.5s")).toBeDefined();
  });

  it("shows Run Complete when finished", () => {
    useWorkflowEditorStore.getState().setActiveRun("run-1");
    useWorkflowEditorStore.getState().completeActiveRun("completed");

    render(<LiveRunOverlay />);
    expect(screen.getByText("Run Complete")).toBeDefined();
  });

  it("shows Run Failed on failure", () => {
    useWorkflowEditorStore.getState().setActiveRun("run-1");
    useWorkflowEditorStore.getState().completeActiveRun("failed");

    render(<LiveRunOverlay />);
    expect(screen.getByText("Run Failed")).toBeDefined();
  });

  it("shows Dismiss button when complete", () => {
    useWorkflowEditorStore.getState().setActiveRun("run-1");
    useWorkflowEditorStore.getState().completeActiveRun("completed");

    render(<LiveRunOverlay />);
    expect(screen.getByText("Dismiss")).toBeDefined();
  });

  it("dismiss clears active run", () => {
    useWorkflowEditorStore.getState().setActiveRun("run-1");
    useWorkflowEditorStore.getState().completeActiveRun("completed");

    render(<LiveRunOverlay />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(useWorkflowEditorStore.getState().activeRun).toBeNull();
  });
});
