import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuditModal } from "./audit-modal";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";

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
