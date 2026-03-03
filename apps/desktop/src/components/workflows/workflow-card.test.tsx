import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowCard } from "./workflow-card";
import type { Workflow } from "@hive-desktop/shared";

// Mock runtime-client
vi.mock("@/lib/runtime-client", () => ({
  activateWorkflow: vi.fn().mockResolvedValue({}),
  pauseWorkflow: vi.fn().mockResolvedValue({}),
  deleteWorkflow: vi.fn().mockResolvedValue({}),
  runWorkflow: vi.fn().mockResolvedValue({}),
}));

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    name: "Payment Monitor",
    description: "Watch for payments",
    status: "draft",
    trigger: { type: "manual" },
    steps: [
      { id: "s1", name: "Step 1", type: "transform", onError: "stop" },
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    runCount: 10,
    errorCount: 2,
    ...overrides,
  };
}

describe("WorkflowCard", () => {
  it("renders workflow name", () => {
    render(<WorkflowCard workflow={makeWorkflow()} />);
    expect(screen.getByText("Payment Monitor")).toBeDefined();
  });

  it("renders description", () => {
    render(<WorkflowCard workflow={makeWorkflow()} />);
    expect(screen.getByText("Watch for payments")).toBeDefined();
  });

  it("shows trigger type", () => {
    render(<WorkflowCard workflow={makeWorkflow()} />);
    expect(screen.getByText("Manual")).toBeDefined();
  });

  it("shows step count", () => {
    render(<WorkflowCard workflow={makeWorkflow()} />);
    expect(screen.getByText("1 steps")).toBeDefined();
  });

  it("shows run count", () => {
    render(<WorkflowCard workflow={makeWorkflow()} />);
    expect(screen.getByText("10 runs")).toBeDefined();
  });

  it("shows plural steps", () => {
    render(
      <WorkflowCard
        workflow={makeWorkflow({
          steps: [
            { id: "s1", name: "A", type: "transform", onError: "stop" },
            { id: "s2", name: "B", type: "delay", onError: "stop" },
          ],
        })}
      />
    );
    expect(screen.getByText("2 steps")).toBeDefined();
  });
});
