import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuditModal } from "./audit-modal";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";

vi.mock("@/lib/runtime-client", () => ({
  fixWorkflow: vi.fn(),
  auditWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
}));

describe("AuditModal", () => {
  beforeEach(() => {
    useWorkflowEditorStore.getState().reset();
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Step 1", type: "mcp_call", server: "test", tool: "test", onError: "stop" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
  });

  it("renders nothing when no audit result and not auditing", () => {
    const { container } = render(<AuditModal />);
    expect(container.innerHTML).toBe("");
  });

  it("shows loading spinner when auditing", () => {
    useWorkflowEditorStore.getState().setAuditing(true);
    render(<AuditModal />);
    expect(screen.getByText("Analyzing workflow...")).toBeDefined();
  });

  it("shows score when audit result is present", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 85,
      summary: "Workflow looks good overall.",
      issues: [],
      suggestions: [],
    });

    render(<AuditModal />);
    expect(screen.getByText("85")).toBeDefined();
    expect(screen.getByText("Good")).toBeDefined();
    expect(screen.getByText("Workflow looks good overall.")).toBeDefined();
  });

  it("shows Needs Work for medium scores", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 60,
      summary: "Some issues found.",
      issues: [{ severity: "warning", message: "Missing error handling" }],
      suggestions: [],
    });

    render(<AuditModal />);
    expect(screen.getByText("60")).toBeDefined();
    expect(screen.getByText("Needs Work")).toBeDefined();
  });

  it("shows Critical Issues for low scores", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 30,
      summary: "Critical problems.",
      issues: [{ severity: "error", message: "Missing server configuration", stepIndex: 0, stepId: "s1" }],
      suggestions: [],
    });

    render(<AuditModal />);
    expect(screen.getByText("30")).toBeDefined();
    expect(screen.getByText("Critical Issues")).toBeDefined();
  });

  it("renders issues with correct severity icons", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 50,
      summary: "Issues found.",
      issues: [
        { severity: "error", message: "Critical error found" },
        { severity: "warning", message: "Potential problem" },
        { severity: "info", message: "Just a note" },
      ],
      suggestions: [],
    });

    render(<AuditModal />);
    expect(screen.getByText("Critical error found")).toBeDefined();
    expect(screen.getByText("Potential problem")).toBeDefined();
    expect(screen.getByText("Just a note")).toBeDefined();
    expect(screen.getByText("Issues (3)")).toBeDefined();
  });

  it("renders suggestions section", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 75,
      summary: "Good with suggestions.",
      issues: [],
      suggestions: [
        { severity: "info", message: "Consider adding retry logic" },
        { severity: "info", message: "Add error notifications" },
      ],
    });

    render(<AuditModal />);
    expect(screen.getByText("Suggestions (2)")).toBeDefined();
    expect(screen.getByText("Consider adding retry logic")).toBeDefined();
    expect(screen.getByText("Add error notifications")).toBeDefined();
  });

  it("shows Go to step link for issues with stepIndex", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 50,
      summary: "Issues found.",
      issues: [{ severity: "warning", message: "Missing args", stepIndex: 0, stepId: "s1" }],
      suggestions: [],
    });

    render(<AuditModal />);
    expect(screen.getByText("Go to step 1")).toBeDefined();
  });

  it("shows Fix Issues button when there are issues", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 50,
      summary: "Issues found.",
      issues: [{ severity: "warning", message: "Missing error handling" }],
      suggestions: [],
    });

    render(<AuditModal />);
    expect(screen.getByText("Fix Issues")).toBeDefined();
  });

  it("does not show Fix Issues button when score is perfect", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 100,
      summary: "Perfect.",
      issues: [],
      suggestions: [],
    });

    render(<AuditModal />);
    expect(screen.queryByText("Fix Issues")).toBeNull();
  });

  it("fix calls updateWorkflow to auto-save", async () => {
    const { fixWorkflow, updateWorkflow } = await import("@/lib/runtime-client");
    const mockFix = vi.mocked(fixWorkflow);
    const mockUpdate = vi.mocked(updateWorkflow);

    mockFix.mockResolvedValue({
      name: "Test",
      description: "",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Fixed Step", type: "mcp_call", server: "test", tool: "test", onError: "stop" }],
      changes: ["Fixed step"],
      newScore: 90,
      audit: {
        score: 90,
        summary: "Better now.",
        issues: [],
        suggestions: [],
      },
    });
    mockUpdate.mockResolvedValue({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Fixed Step", type: "mcp_call", server: "test", tool: "test", onError: "stop" }],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    useWorkflowEditorStore.getState().setAuditResult({
      score: 50,
      summary: "Issues found.",
      issues: [{ severity: "warning", message: "Missing error handling" }],
      suggestions: [],
    });

    render(<AuditModal />);
    fireEvent.click(screen.getByText("Fix Issues"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("wf-1", expect.objectContaining({
        name: "Test",
      }));
    });
  });

  it("shows warning when fix would regress score", async () => {
    const { fixWorkflow } = await import("@/lib/runtime-client");
    const mockFix = vi.mocked(fixWorkflow);

    mockFix.mockResolvedValue({
      name: "Test",
      description: "",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Step 1", type: "mcp_call", server: "test", tool: "test", onError: "stop" }],
      changes: [],
      warning: "Fix could not improve the workflow (score dropped from 75 to 60). Original preserved.",
      newScore: 75,
      audit: null,
    });

    useWorkflowEditorStore.getState().setAuditResult({
      score: 75,
      summary: "Decent.",
      issues: [{ severity: "warning", message: "Some issue" }],
      suggestions: [],
    });

    render(<AuditModal />);
    fireEvent.click(screen.getByText("Fix Issues"));

    await waitFor(() => {
      expect(screen.getByText("Fix could not improve workflow")).toBeDefined();
    });
  });

  it("uses inline audit result instead of re-auditing", async () => {
    const { fixWorkflow, auditWorkflow } = await import("@/lib/runtime-client");
    const mockFix = vi.mocked(fixWorkflow);
    const mockAudit = vi.mocked(auditWorkflow);

    mockFix.mockResolvedValue({
      name: "Test",
      description: "",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Fixed Step", type: "mcp_call", server: "test", tool: "test", onError: "retry" }],
      changes: ["Added retry"],
      newScore: 95,
      audit: {
        score: 95,
        summary: "Excellent.",
        issues: [],
        suggestions: [],
      },
    });

    const { updateWorkflow } = await import("@/lib/runtime-client");
    vi.mocked(updateWorkflow).mockResolvedValue({
      id: "wf-1", name: "Test", description: "", status: "draft",
      trigger: { type: "manual" }, steps: [], createdAt: "", updatedAt: "",
      runCount: 0, errorCount: 0,
    });

    useWorkflowEditorStore.getState().setAuditResult({
      score: 70,
      summary: "Needs work.",
      issues: [{ severity: "warning", message: "Missing retry" }],
      suggestions: [],
    });

    render(<AuditModal />);
    fireEvent.click(screen.getByText("Fix Issues"));

    await waitFor(() => {
      // Should show the inline audit score
      expect(screen.getByText("95")).toBeDefined();
    });

    // auditWorkflow should NOT have been called (inline audit was used)
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("close button clears audit result", () => {
    useWorkflowEditorStore.getState().setAuditResult({
      score: 90,
      summary: "Great.",
      issues: [],
      suggestions: [],
    });

    render(<AuditModal />);
    fireEvent.click(screen.getByText("Close"));
    expect(useWorkflowEditorStore.getState().auditResult).toBeNull();
  });
});
