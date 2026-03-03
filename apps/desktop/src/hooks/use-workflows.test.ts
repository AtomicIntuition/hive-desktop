import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWorkflows } from "./use-workflows";
import { useAppStore } from "@/stores/app-store";
import { useWorkflowStore } from "@/stores/workflow-store";

vi.mock("@/lib/runtime-client", () => ({
  listWorkflows: vi.fn(),
}));

import { listWorkflows } from "@/lib/runtime-client";
const mockListWorkflows = vi.mocked(listWorkflows);

describe("useWorkflows", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: true });
    useWorkflowStore.setState({ workflows: [], loading: false });
    mockListWorkflows.mockReset();
  });

  it("fetches workflows when runtime is connected", async () => {
    const mockData = [
      { id: "wf-1", name: "Test", description: "", status: "active" as const, trigger: { type: "manual" as const }, steps: [], createdAt: "", updatedAt: "", runCount: 0, errorCount: 0 },
    ];
    mockListWorkflows.mockResolvedValue(mockData);

    renderHook(() => useWorkflows());

    await waitFor(() => {
      expect(useWorkflowStore.getState().workflows).toEqual(mockData);
    });
  });

  it("does not fetch when runtime is disconnected", () => {
    useAppStore.setState({ runtimeConnected: false });
    renderHook(() => useWorkflows());
    expect(mockListWorkflows).not.toHaveBeenCalled();
  });

  it("returns workflows, loading, and refresh", () => {
    mockListWorkflows.mockResolvedValue([]);
    const { result } = renderHook(() => useWorkflows());
    expect(Array.isArray(result.current.workflows)).toBe(true);
    expect(typeof result.current.loading).toBe("boolean");
    expect(typeof result.current.refresh).toBe("function");
  });

  it("sets loading false after fetch error", async () => {
    mockListWorkflows.mockRejectedValue(new Error("fail"));
    renderHook(() => useWorkflows());

    await waitFor(() => {
      expect(useWorkflowStore.getState().loading).toBe(false);
    });
  });
});
