import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActiveWorkflows } from "./active-workflows";
import type { Workflow } from "@hive-desktop/shared";

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    name: "Payment Monitor",
    description: "",
    status: "active",
    trigger: { type: "manual" },
    steps: [],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    runCount: 5,
    errorCount: 0,
    ...overrides,
  };
}

describe("ActiveWorkflows", () => {
  it("renders empty state when no workflows", () => {
    render(<ActiveWorkflows workflows={[]} />);
    expect(screen.getByText(/No workflows created/)).toBeDefined();
  });

  it("renders workflow names", () => {
    render(<ActiveWorkflows workflows={[makeWorkflow()]} />);
    expect(screen.getByText("Payment Monitor")).toBeDefined();
    expect(screen.getByText("5 runs")).toBeDefined();
  });

  it("shows trigger type", () => {
    render(<ActiveWorkflows workflows={[makeWorkflow()]} />);
    expect(screen.getByText("manual")).toBeDefined();
  });

  it("shows max 5 workflows", () => {
    const workflows = Array.from({ length: 8 }, (_, i) =>
      makeWorkflow({ id: `wf-${i}`, name: `WF ${i}` })
    );
    render(<ActiveWorkflows workflows={workflows} />);
    // Should only show first 5
    expect(screen.getByText("WF 0")).toBeDefined();
    expect(screen.getByText("WF 4")).toBeDefined();
    expect(screen.queryByText("WF 5")).toBeNull();
  });
});
