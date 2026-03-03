import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "./dashboard";
import { useAppStore } from "@/stores/app-store";
import { useServerStore } from "@/stores/server-store";
import { useWorkflowStore } from "@/stores/workflow-store";

vi.mock("@/lib/runtime-client", () => ({
  listServers: vi.fn().mockResolvedValue([]),
  listWorkflows: vi.fn().mockResolvedValue([]),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: false });
    useServerStore.setState({ servers: [], loading: false });
    useWorkflowStore.setState({ workflows: [], loading: false });
  });

  it("renders stats cards section", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Active Workflows")).toBeDefined();
    expect(screen.getByText("Running Servers")).toBeDefined();
  });

  it("renders server status section", () => {
    render(<DashboardPage />);
    expect(screen.getByText("MCP Servers")).toBeDefined();
  });

  it("renders activity feed", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Activity")).toBeDefined();
  });

  it("renders total runs stat", () => {
    useWorkflowStore.setState({
      workflows: [
        { id: "1", name: "W1", description: "", status: "active", trigger: { type: "manual" }, steps: [], createdAt: "", updatedAt: "", runCount: 10, errorCount: 2 },
        { id: "2", name: "W2", description: "", status: "paused", trigger: { type: "manual" }, steps: [], createdAt: "", updatedAt: "", runCount: 5, errorCount: 0 },
      ],
    });

    render(<DashboardPage />);
    // Total Runs should show 15
    expect(screen.getByText("15")).toBeDefined();
    expect(screen.getByText("Total Runs")).toBeDefined();
  });
});
