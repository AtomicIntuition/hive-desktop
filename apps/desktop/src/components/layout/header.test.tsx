import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./header";
import { useAppStore } from "@/stores/app-store";

describe("Header", () => {
  beforeEach(() => {
    useAppStore.setState({ appVersion: "0.2.1", runtimeConnected: true });
  });

  it("renders page title for dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText("Dashboard")).toBeDefined();
  });

  it("renders page title for workflows", () => {
    render(
      <MemoryRouter initialEntries={["/workflows"]}>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText("Workflows")).toBeDefined();
  });

  it("shows version number", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText("v0.2.1")).toBeDefined();
  });

  it("shows runtime connected indicator", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText("Runtime")).toBeDefined();
  });

  it("shows disconnected indicator when runtime is down", () => {
    useAppStore.setState({ runtimeConnected: false });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByText("Disconnected")).toBeDefined();
  });
});
