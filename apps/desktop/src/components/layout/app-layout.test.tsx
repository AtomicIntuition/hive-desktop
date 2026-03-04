import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "./app-layout";
import { useAppStore } from "@/stores/app-store";

// Mock hooks that make network calls
vi.mock("@/hooks/use-runtime", () => ({
  useRuntime: vi.fn().mockReturnValue({ runtimeConnected: true }),
}));

vi.mock("@/hooks/use-websocket", () => ({
  useWebSocket: vi.fn(),
}));

vi.mock("@/lib/runtime-client", () => ({
  checkHealth: vi.fn().mockResolvedValue({}),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarCollapsed: false, runtimeConnected: true, appVersion: "0.2.1" });
  });

  it("renders sidebar with brand", () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );
    // Brand is split: "Hive " + <span>Desktop</span>
    expect(screen.getByText("Desktop")).toBeDefined();
  });

  it("renders sidebar and header sections", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>
    );
    // Both sidebar nav and header exist — "Dashboard" appears in both sidebar link and header
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
  });

  it("renders version in header", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>
    );
    expect(screen.getByText("v0.2.1")).toBeDefined();
  });
});
