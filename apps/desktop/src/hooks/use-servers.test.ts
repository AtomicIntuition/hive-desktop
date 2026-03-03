import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useServers } from "./use-servers";
import { useAppStore } from "@/stores/app-store";
import { useServerStore } from "@/stores/server-store";

vi.mock("@/lib/runtime-client", () => ({
  listServers: vi.fn(),
}));

import { listServers } from "@/lib/runtime-client";
const mockListServers = vi.mocked(listServers);

describe("useServers", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: true });
    useServerStore.setState({ servers: [], loading: false });
    mockListServers.mockReset();
  });

  it("fetches servers when runtime is connected", async () => {
    const mockServers = [
      { id: "1", slug: "stripe", name: "Stripe", description: "", installCommand: "npx" as const, status: "running" as const, installedAt: "" },
    ];
    mockListServers.mockResolvedValue(mockServers);

    renderHook(() => useServers());

    await waitFor(() => {
      expect(useServerStore.getState().servers).toEqual(mockServers);
    });
  });

  it("does not fetch when runtime is disconnected", () => {
    useAppStore.setState({ runtimeConnected: false });
    renderHook(() => useServers());
    expect(mockListServers).not.toHaveBeenCalled();
  });

  it("returns servers, loading, and refresh", () => {
    mockListServers.mockResolvedValue([]);
    const { result } = renderHook(() => useServers());
    expect(Array.isArray(result.current.servers)).toBe(true);
    expect(typeof result.current.loading).toBe("boolean");
    expect(typeof result.current.refresh).toBe("function");
  });

  it("sets loading false after fetch error", async () => {
    mockListServers.mockRejectedValue(new Error("fail"));
    renderHook(() => useServers());

    await waitFor(() => {
      expect(useServerStore.getState().loading).toBe(false);
    });
  });
});
