import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { useAppStore } from "@/stores/app-store";

describe("Sidebar", () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarCollapsed: false, runtimeConnected: true });
  });

  it("renders all nav items", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Workflows")).toBeDefined();
    expect(screen.getByText("Servers")).toBeDefined();
    expect(screen.getByText("Vault")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders Hive Desktop brand", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText("Hive")).toBeDefined();
    expect(screen.getByText("Desktop")).toBeDefined();
  });

  it("shows runtime connected status", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText("Runtime connected")).toBeDefined();
  });

  it("shows runtime disconnected status", () => {
    useAppStore.setState({ runtimeConnected: false });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText("Runtime disconnected")).toBeDefined();
  });

  it("hides labels when collapsed", () => {
    useAppStore.setState({ sidebarCollapsed: true });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.queryByText("Dashboard")).toBeNull();
  });
});
