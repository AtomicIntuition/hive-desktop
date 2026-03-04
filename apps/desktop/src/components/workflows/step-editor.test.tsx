import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StepEditorPanel } from "./step-editor";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";

vi.mock("@/lib/runtime-client", () => ({
  listServers: vi.fn().mockResolvedValue([
    { id: "srv-1", slug: "brave-search-mcp", name: "Brave Search", status: "running" },
    { id: "srv-2", slug: "slack-mcp", name: "Slack", status: "stopped" },
  ]),
  listServerTools: vi.fn().mockResolvedValue({
    tools: [
      { name: "brave_web_search", description: "Search the web", inputSchema: { type: "object", properties: { query: { type: "string", description: "Search query" } }, required: ["query"] } },
    ],
  }),
}));

const testSteps = [
  { id: "s1", name: "Search Web", type: "mcp_call" as const, server: "brave-search-mcp", tool: "brave_web_search", arguments: { query: "test" }, outputVar: "results", onError: "stop" as const },
  { id: "s2", name: "Check Results", type: "condition" as const, condition: "results.length > 0", outputVar: "hasResults", onError: "stop" as const },
  { id: "s3", name: "Wait", type: "delay" as const, arguments: { seconds: 5 }, onError: "continue" as const },
  { id: "s4", name: "Alert", type: "notify" as const, arguments: { title: "Done", message: "Found {{results.length}} items" }, onError: "continue" as const },
];

describe("StepEditorPanel", () => {
  beforeEach(() => {
    useWorkflowEditorStore.getState().reset();
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: testSteps,
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
  });

  it("renders all step cards", () => {
    render(<StepEditorPanel />);
    expect(screen.getByText("Search Web")).toBeDefined();
    expect(screen.getByText("Check Results")).toBeDefined();
    expect(screen.getByText("Wait")).toBeDefined();
    expect(screen.getByText("Alert")).toBeDefined();
  });

  it("renders step numbers", () => {
    render(<StepEditorPanel />);
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
  });

  it("renders type badges", () => {
    render(<StepEditorPanel />);
    expect(screen.getByText("MCP")).toBeDefined();
    expect(screen.getByText("IF")).toBeDefined();
    expect(screen.getByText("WAIT")).toBeDefined();
    expect(screen.getByText("MSG")).toBeDefined();
  });

  it("shows output var for steps that have one", () => {
    render(<StepEditorPanel />);
    expect(screen.getByText("→ results")).toBeDefined();
    expect(screen.getByText("→ hasResults")).toBeDefined();
  });

  it("shows Add Step button", () => {
    render(<StepEditorPanel />);
    expect(screen.getByText("Add Step")).toBeDefined();
  });

  it("clicking Add Step shows type menu", () => {
    render(<StepEditorPanel />);
    fireEvent.click(screen.getByText("Add Step"));

    expect(screen.getByText("MCP Call")).toBeDefined();
    expect(screen.getByText("Condition")).toBeDefined();
    expect(screen.getByText("Transform")).toBeDefined();
    expect(screen.getByText("Delay")).toBeDefined();
    expect(screen.getByText("Notify")).toBeDefined();
  });

  it("adding a step increases the step count", () => {
    render(<StepEditorPanel />);
    fireEvent.click(screen.getByText("Add Step"));
    fireEvent.click(screen.getByText("Delay"));

    const steps = useWorkflowEditorStore.getState().steps;
    expect(steps).toHaveLength(5);
    expect(steps[4].type).toBe("delay");
  });

  it("clicking step card header expands it", () => {
    render(<StepEditorPanel />);
    // Click on the first step name to expand
    fireEvent.click(screen.getByText("Search Web"));

    // Should show the Name field in expanded view
    expect(useWorkflowEditorStore.getState().expandedSteps.has("s1")).toBe(true);
  });

  it("delete button removes a step", () => {
    render(<StepEditorPanel />);
    const deleteButtons = document.querySelectorAll('[title="Delete step"]');
    expect(deleteButtons.length).toBe(4);

    fireEvent.click(deleteButtons[0]);
    expect(useWorkflowEditorStore.getState().steps).toHaveLength(3);
    expect(useWorkflowEditorStore.getState().steps[0].id).toBe("s2");
  });

  it("move up button reorders steps", () => {
    render(<StepEditorPanel />);
    const moveUpButtons = document.querySelectorAll('[title="Move up"]');

    // Click move up on second step (index 1)
    fireEvent.click(moveUpButtons[1]);

    const steps = useWorkflowEditorStore.getState().steps;
    expect(steps[0].id).toBe("s2");
    expect(steps[1].id).toBe("s1");
  });

  it("move down button reorders steps", () => {
    render(<StepEditorPanel />);
    const moveDownButtons = document.querySelectorAll('[title="Move down"]');

    // Click move down on first step (index 0)
    fireEvent.click(moveDownButtons[0]);

    const steps = useWorkflowEditorStore.getState().steps;
    expect(steps[0].id).toBe("s2");
    expect(steps[1].id).toBe("s1");
  });

  it("shows hold toggle buttons on each step", () => {
    render(<StepEditorPanel />);
    const holdButtons = document.querySelectorAll('[title="Hold step"]');
    expect(holdButtons.length).toBe(4);
  });

  it("clicking hold toggle marks step as held", () => {
    render(<StepEditorPanel />);
    const holdButtons = document.querySelectorAll('[title="Hold step"]');
    fireEvent.click(holdButtons[0]);
    expect(useWorkflowEditorStore.getState().heldSteps.has("s1")).toBe(true);
  });

  it("held step shows unhold button", () => {
    useWorkflowEditorStore.getState().toggleHeld("s1");
    render(<StepEditorPanel />);
    const unholdButtons = document.querySelectorAll('[title="Unhold step"]');
    expect(unholdButtons.length).toBe(1);
  });

  it("first step has move up disabled", () => {
    render(<StepEditorPanel />);
    const moveUpButtons = document.querySelectorAll('[title="Move up"]');
    expect((moveUpButtons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("last step has move down disabled", () => {
    render(<StepEditorPanel />);
    const moveDownButtons = document.querySelectorAll('[title="Move down"]');
    expect((moveDownButtons[3] as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("StepCard expanded editors", () => {
  beforeEach(() => {
    useWorkflowEditorStore.getState().reset();
  });

  it("MCP call editor shows Server and Tool fields when expanded", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Call", type: "mcp_call", server: "", tool: "", onError: "stop" }],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
    useWorkflowEditorStore.getState().toggleStepExpanded("s1");

    render(<StepEditorPanel />);

    expect(screen.getByText("Server")).toBeDefined();
    expect(screen.getByText("Tool")).toBeDefined();
    expect(screen.getByText("On Error")).toBeDefined();
  });

  it("Condition editor shows Expression field when expanded", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Check", type: "condition", condition: "x > 0", onError: "stop" }],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
    useWorkflowEditorStore.getState().toggleStepExpanded("s1");

    render(<StepEditorPanel />);

    expect(screen.getByText("Expression")).toBeDefined();
    expect(screen.getByDisplayValue("x > 0")).toBeDefined();
  });

  it("Delay editor shows Seconds field when expanded", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Wait", type: "delay", arguments: { seconds: 10 }, onError: "continue" }],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
    useWorkflowEditorStore.getState().toggleStepExpanded("s1");

    render(<StepEditorPanel />);

    expect(screen.getByText("Seconds")).toBeDefined();
    expect(screen.getByDisplayValue("10")).toBeDefined();
  });

  it("Notify editor shows Title and Message fields when expanded", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Alert", type: "notify", arguments: { title: "Test Title", message: "Test Msg" }, onError: "continue" }],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
    useWorkflowEditorStore.getState().toggleStepExpanded("s1");

    render(<StepEditorPanel />);

    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("Message")).toBeDefined();
    expect(screen.getByDisplayValue("Test Title")).toBeDefined();
    expect(screen.getByDisplayValue("Test Msg")).toBeDefined();
  });

  it("Error handling selector shows retry options when retry is selected", () => {
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test",
      description: "",
      status: "draft",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Call", type: "mcp_call", server: "", tool: "", onError: "retry", retryCount: 3, retryDelay: 3000 }],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
    useWorkflowEditorStore.getState().toggleStepExpanded("s1");

    render(<StepEditorPanel />);

    expect(screen.getByText("times, delay")).toBeDefined();
    expect(screen.getByText("ms")).toBeDefined();
  });
});
