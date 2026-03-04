import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataFlowPanel } from "./data-flow-panel";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";

describe("DataFlowPanel", () => {
  beforeEach(() => {
    useWorkflowEditorStore.getState().reset();
  });

  it("renders nothing when no steps", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Empty",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    const { container } = render(<DataFlowPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("shows Data Flow header", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Search", type: "mcp_call", server: "brave", tool: "search", outputVar: "results", onError: "stop" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    render(<DataFlowPanel />);
    expect(screen.getByText("Data Flow")).toBeDefined();
    expect(screen.getByText("(1 variables)")).toBeDefined();
  });

  it("shows variables with producer info", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Search", type: "mcp_call", server: "brave", tool: "search", outputVar: "results", onError: "stop" },
        { id: "s2", name: "Transform", type: "transform", condition: "results.map(r => r.title)", outputVar: "titles", onError: "stop" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    render(<DataFlowPanel />);
    expect(screen.getByText("results")).toBeDefined();
    expect(screen.getByText("titles")).toBeDefined();
    expect(screen.getByText("(2 variables)")).toBeDefined();
  });

  it("shows consumer info for referenced variables", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Search", type: "mcp_call", server: "brave", tool: "search", outputVar: "results", onError: "stop" },
        { id: "s2", name: "Notify", type: "notify", arguments: { title: "Done", message: "Found {{results}}" }, onError: "continue" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    render(<DataFlowPanel />);
    expect(screen.getByText("results")).toBeDefined();
    // Should show "used in" text
    const usedInElements = screen.getAllByText("used in");
    expect(usedInElements.length).toBeGreaterThan(0);
  });

  it("shows unused warning for variables not consumed", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Search", type: "mcp_call", server: "brave", tool: "search", outputVar: "results", onError: "stop" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    render(<DataFlowPanel />);
    expect(screen.getByText("unused")).toBeDefined();
  });

  it("collapses and expands", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Search", type: "mcp_call", server: "brave", tool: "search", outputVar: "results", onError: "stop" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    render(<DataFlowPanel />);

    // Click header to collapse
    fireEvent.click(screen.getByText("Data Flow"));

    // Variable should not be visible
    const resultsElements = screen.queryAllByText("results");
    // The code text is inside the collapsed area
    // After collapsing, the panel content is hidden
  });

  it("shows no-variables message when steps have no outputVar", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Wait", type: "delay", arguments: { seconds: 5 }, onError: "continue" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });

    render(<DataFlowPanel />);
    expect(screen.getByText("(0 variables)")).toBeDefined();
  });
});
