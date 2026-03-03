import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWebSocket } from "./use-websocket";
import { useAppStore } from "@/stores/app-store";
import { useServerStore } from "@/stores/server-store";
import { useWorkflowStore } from "@/stores/workflow-store";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();

  constructor(_url: string) {
    MockWebSocket.instances.push(this);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("useWebSocket", () => {
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    useAppStore.setState({ runtimeConnected: true });
    useServerStore.setState({ servers: [] });
    useWorkflowStore.setState({ workflows: [] });
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("creates WebSocket when runtime is connected", () => {
    renderHook(() => useWebSocket());
    expect(MockWebSocket.instances.length).toBe(1);
  });

  it("does not create WebSocket when runtime is disconnected", () => {
    useAppStore.setState({ runtimeConnected: false });
    renderHook(() => useWebSocket());
    expect(MockWebSocket.instances.length).toBe(0);
  });

  it("closes WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it("handles server:status messages", () => {
    useServerStore.setState({
      servers: [
        { id: "srv-1", slug: "test", name: "Test", description: "", installCommand: "npx", status: "stopped", installedAt: "" },
      ],
    });

    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({ type: "server:status", data: { id: "srv-1", status: "running" } });

    expect(useServerStore.getState().servers[0].status).toBe("running");
  });

  it("handles workflow:status messages", () => {
    useWorkflowStore.setState({
      workflows: [
        { id: "wf-1", name: "Test", description: "", status: "draft", trigger: { type: "manual" }, steps: [], createdAt: "", updatedAt: "", runCount: 0, errorCount: 0 },
      ],
    });

    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({ type: "workflow:status", data: { id: "wf-1", status: "active" } });

    expect(useWorkflowStore.getState().workflows[0].status).toBe("active");
  });

  it("ignores malformed messages", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    // Should not throw
    ws.onmessage?.({ data: "not-json" });
  });
});
