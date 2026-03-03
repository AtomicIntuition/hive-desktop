import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRuntime } from "./use-runtime";
import { useAppStore } from "@/stores/app-store";

vi.mock("@/lib/runtime-client", () => ({
  checkHealth: vi.fn(),
}));

import { checkHealth } from "@/lib/runtime-client";
const mockCheckHealth = vi.mocked(checkHealth);

describe("useRuntime", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: false });
    mockCheckHealth.mockReset();
  });

  it("sets runtimeConnected to true when health check passes", async () => {
    mockCheckHealth.mockResolvedValue({ status: "ok", version: "0.1.0", uptime: 100, servers: { running: 0 } });
    renderHook(() => useRuntime());

    await waitFor(() => {
      expect(useAppStore.getState().runtimeConnected).toBe(true);
    });
  });

  it("sets runtimeConnected to false when health check fails", async () => {
    useAppStore.setState({ runtimeConnected: true });
    mockCheckHealth.mockRejectedValue(new Error("unreachable"));
    renderHook(() => useRuntime());

    await waitFor(() => {
      expect(useAppStore.getState().runtimeConnected).toBe(false);
    });
  });

  it("returns runtimeConnected state", () => {
    mockCheckHealth.mockResolvedValue({ status: "ok", version: "0.1.0", uptime: 100, servers: { running: 0 } });
    const { result } = renderHook(() => useRuntime());
    expect(typeof result.current.runtimeConnected).toBe("boolean");
  });
});
