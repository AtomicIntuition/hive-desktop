import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./app-store";

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState({
      runtimeConnected: false,
      runtimePort: 45678,
      appVersion: "0.1.0",
      sidebarCollapsed: false,
    });
  });

  it("has correct initial state", () => {
    const state = useAppStore.getState();
    expect(state.runtimeConnected).toBe(false);
    expect(state.runtimePort).toBe(45678);
    expect(state.appVersion).toBe("0.1.0");
    expect(state.sidebarCollapsed).toBe(false);
  });

  it("setRuntimeConnected updates connected state", () => {
    useAppStore.getState().setRuntimeConnected(true);
    expect(useAppStore.getState().runtimeConnected).toBe(true);
  });

  it("setRuntimePort updates port", () => {
    useAppStore.getState().setRuntimePort(9999);
    expect(useAppStore.getState().runtimePort).toBe(9999);
  });

  it("setAppVersion updates version", () => {
    useAppStore.getState().setAppVersion("1.2.3");
    expect(useAppStore.getState().appVersion).toBe("1.2.3");
  });

  it("toggleSidebar toggles collapsed state", () => {
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });
});
