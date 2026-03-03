import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkflowsPage } from "./workflows";
import { useAppStore } from "@/stores/app-store";
import { useWorkflowStore } from "@/stores/workflow-store";

vi.mock("@/lib/runtime-client", () => ({
  listWorkflows: vi.fn().mockResolvedValue([]),
  planWorkflowAI: vi.fn(),
  confirmWorkflowPlan: vi.fn(),
  getAiStatus: vi.fn().mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" }),
  installServer: vi.fn(),
  listWorkflowTemplates: vi.fn().mockResolvedValue([]),
  createWorkflowFromTemplate: vi.fn(),
  activateWorkflow: vi.fn(),
  pauseWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  runWorkflow: vi.fn(),
}));

vi.mock("@/hooks/use-workflows", () => ({
  useWorkflows: vi.fn().mockReturnValue({ workflows: [], loading: false, refresh: vi.fn() }),
}));

describe("WorkflowsPage", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: true });
    useWorkflowStore.setState({ workflows: [], loading: false });
  });

  it("renders workflow creator", () => {
    render(<WorkflowsPage />);
    expect(screen.getByText("Create a Workflow")).toBeDefined();
  });

  it("renders My Workflows and Templates tabs", () => {
    render(<WorkflowsPage />);
    expect(screen.getByText("My Workflows")).toBeDefined();
    expect(screen.getByText("Templates")).toBeDefined();
  });

  it("shows empty workflow list by default", () => {
    render(<WorkflowsPage />);
    expect(screen.getByText("No workflows yet")).toBeDefined();
  });
});
