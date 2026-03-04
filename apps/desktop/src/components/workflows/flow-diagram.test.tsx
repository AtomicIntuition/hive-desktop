import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlowDiagram } from "./flow-diagram";
import type { WorkflowStep } from "@hive-desktop/shared";

const mockSteps: WorkflowStep[] = [
  {
    id: "fetch",
    name: "Fetch Issues",
    type: "mcp_call",
    server: "github-mcp",
    tool: "list_issues",
    arguments: { state: "open" },
    outputVar: "issues",
    onError: "retry",
    retryCount: 3,
    retryDelay: 3000,
  },
  {
    id: "check",
    name: "Check Count",
    type: "condition",
    condition: "{{issues}}.length > 0",
    outputVar: "hasIssues",
    onError: "stop",
  },
  {
    id: "notify",
    name: "Send Alert",
    type: "notify",
    arguments: { title: "Issues Found", message: "Found {{issues.length}} issues" },
    onError: "continue",
  },
];

describe("FlowDiagram", () => {
  const defaultProps = {
    steps: mockSteps,
    activeRun: null,
    heldSteps: new Set<string>(),
    expandedSteps: new Set<string>(),
    onStepClick: vi.fn(),
  };

  it("renders nothing when no steps", () => {
    const { container } = render(
      <FlowDiagram {...defaultProps} steps={[]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders SVG with correct number of nodes", () => {
    const { container } = render(<FlowDiagram {...defaultProps} />);
    const rects = container.querySelectorAll("rect");
    // Each node has 2 rects (body + type badge), so 3 nodes = 6 rects
    expect(rects.length).toBe(6);
  });

  it("renders Flow header", () => {
    render(<FlowDiagram {...defaultProps} />);
    expect(screen.getByText("Flow")).toBeDefined();
  });

  it("renders step names in nodes", () => {
    render(<FlowDiagram {...defaultProps} />);
    expect(screen.getByText("Fetch Issues")).toBeDefined();
    expect(screen.getByText("Check Count")).toBeDefined();
    expect(screen.getByText("Send Alert")).toBeDefined();
  });

  it("renders type badges", () => {
    render(<FlowDiagram {...defaultProps} />);
    expect(screen.getByText("MCP")).toBeDefined();
    expect(screen.getByText("IF")).toBeDefined();
    expect(screen.getByText("MSG")).toBeDefined();
  });

  it("renders connector lines between nodes", () => {
    const { container } = render(<FlowDiagram {...defaultProps} />);
    const lines = container.querySelectorAll("line");
    // 3 nodes = 2 connectors
    expect(lines.length).toBe(2);
  });

  it("calls onStepClick when node is clicked", () => {
    const onStepClick = vi.fn();
    const { container } = render(
      <FlowDiagram {...defaultProps} onStepClick={onStepClick} />
    );

    // Click the first node group
    const groups = container.querySelectorAll("g[role='button']");
    expect(groups.length).toBe(3);
    fireEvent.click(groups[0]);
    expect(onStepClick).toHaveBeenCalledWith("fetch");

    fireEvent.click(groups[2]);
    expect(onStepClick).toHaveBeenCalledWith("notify");
  });

  it("applies held step styling", () => {
    const heldSteps = new Set(["check"]);
    const { container } = render(
      <FlowDiagram {...defaultProps} heldSteps={heldSteps} />
    );

    // The held step node should have amber stroke
    const nodeRects = container.querySelectorAll("g[role='button'] > rect:first-child");
    // Second node (index 1) is the held "check" step
    expect(nodeRects[1].getAttribute("stroke")).toBe("#f59e0b");
  });

  it("applies running step styling when active run", () => {
    const activeRun = {
      runId: "run-1",
      status: "running" as const,
      stepStatuses: new Map([
        [0, { runId: "run-1", stepIndex: 0, stepId: "fetch", status: "completed" as const, startedAt: "", completedAt: "" }],
        [1, { runId: "run-1", stepIndex: 1, stepId: "check", status: "running" as const, startedAt: "" }],
      ]),
    };

    const { container } = render(
      <FlowDiagram {...defaultProps} activeRun={activeRun} />
    );

    const nodeRects = container.querySelectorAll("g[role='button'] > rect:first-child");
    // First node = completed (emerald), second = running (violet)
    expect(nodeRects[0].getAttribute("stroke")).toBe("#10b981");
    expect(nodeRects[1].getAttribute("stroke")).toBe("#8b5cf6");
  });

  it("renders outputVar labels on nodes", () => {
    render(<FlowDiagram {...defaultProps} />);
    // Should show outputVar labels
    expect(screen.getByText("→ issues")).toBeDefined();
    expect(screen.getByText("→ hasIssues")).toBeDefined();
  });

  it("truncates long step names", () => {
    const longSteps: WorkflowStep[] = [
      {
        id: "long",
        name: "This Is A Very Long Step Name That Should Be Truncated",
        type: "notify",
        onError: "continue",
      },
    ];

    render(<FlowDiagram {...defaultProps} steps={longSteps} />);
    expect(screen.getByText("This Is A Very Long St...")).toBeDefined();
  });
});
