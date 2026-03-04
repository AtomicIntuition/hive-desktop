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

  it("handles runtime:ready event without crash", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({ type: "runtime:ready", data: { port: 45678 } });
    expect(consoleSpy).toHaveBeenCalledWith("[ws] Runtime ready on port", 45678);
    consoleSpy.mockRestore();
  });

  it("handles server:log event without crash", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({ type: "server:log", data: { id: "test", message: "started" } });
    // Should not throw
  });

  it("handles server:installed event without crash", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({ type: "server:installed", data: { server: { id: "new", name: "New" } } });
    // Should not throw
  });

  it("handles server:removed event without crash", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({ type: "server:removed", data: { id: "old" } });
    // Should not throw
  });

  it("handles workflow run events without crash", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    ws.simulateMessage({ type: "workflow:run:start", data: { runId: "run-1", workflowId: "wf-1" } });
    ws.simulateMessage({ type: "workflow:run:step", data: { runId: "run-1", stepIndex: 0, status: "running" } });
    ws.simulateMessage({ type: "workflow:run:step:detail", data: { runId: "run-1", stepIndex: 0, output: {} } });
    ws.simulateMessage({ type: "workflow:run:complete", data: { runId: "run-1", status: "completed" } });
    // Should not throw
  });

  it("handles unknown event types without crash", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.simulateMessage({ type: "completely:unknown:event", data: {} });
    // Should not throw
  });

  it("handles message with empty data", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: "{}" });
    // Should not throw
  });

  it("handles onerror callback", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.onerror?.();
    expect(warnSpy).toHaveBeenCalledWith("[ws] Connection error");
    warnSpy.mockRestore();
  });

  it("sets ref to null on close", () => {
    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];
    ws.onclose?.();
    // Internal ref should be null — we verify by the hook not crashing
  });

  it("handles multiple status updates on same server", () => {
    useServerStore.setState({
      servers: [
        { id: "srv-1", slug: "test", name: "Test", description: "", installCommand: "npx", status: "stopped", installedAt: "" },
      ],
    });

    renderHook(() => useWebSocket());
    const ws = MockWebSocket.instances[0];

    ws.simulateMessage({ type: "server:status", data: { id: "srv-1", status: "starting" } });
    expect(useServerStore.getState().servers[0].status).toBe("starting");

    ws.simulateMessage({ type: "server:status", data: { id: "srv-1", status: "running" } });
    expect(useServerStore.getState().servers[0].status).toBe("running");

    ws.simulateMessage({ type: "server:status", data: { id: "srv-1", status: "stopped" } });
    expect(useServerStore.getState().servers[0].status).toBe("stopped");
  });
});
