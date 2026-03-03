import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServerCard } from "./server-card";
import type { McpServer } from "@hive-desktop/shared";

// Mock runtime-client
vi.mock("@/lib/runtime-client", () => ({
  startServer: vi.fn().mockResolvedValue({}),
  stopServer: vi.fn().mockResolvedValue({}),
  restartServer: vi.fn().mockResolvedValue({}),
  removeServer: vi.fn().mockResolvedValue({}),
}));

function makeServer(overrides: Partial<McpServer & { connected?: boolean }> = {}): McpServer & { connected?: boolean } {
  return {
    id: "srv-1",
    slug: "stripe-mcp",
    name: "Stripe MCP",
    description: "Stripe integration for payments",
    installCommand: "npx",
    npmPackage: "@stripe/mcp",
    status: "stopped",
    installedAt: "2026-01-01",
    ...overrides,
  };
}

describe("ServerCard", () => {
  it("renders server name", () => {
    render(<ServerCard server={makeServer()} />);
    expect(screen.getByText("Stripe MCP")).toBeDefined();
  });

  it("renders description", () => {
    render(<ServerCard server={makeServer()} />);
    expect(screen.getByText("Stripe integration for payments")).toBeDefined();
  });

  it("shows npm package name", () => {
    render(<ServerCard server={makeServer()} />);
    expect(screen.getByText("@stripe/mcp")).toBeDefined();
  });

  it("shows Start button when stopped", () => {
    render(<ServerCard server={makeServer({ status: "stopped" })} />);
    expect(screen.getByText("Start")).toBeDefined();
  });

  it("shows Stop and Restart when running", () => {
    render(<ServerCard server={makeServer({ status: "running" })} />);
    expect(screen.getByText("Stop")).toBeDefined();
    expect(screen.getByText("Restart")).toBeDefined();
  });

  it("shows Retry button when error", () => {
    render(<ServerCard server={makeServer({ status: "error" })} />);
    expect(screen.getByText("Retry")).toBeDefined();
  });

  it("shows Stopped status label", () => {
    render(<ServerCard server={makeServer({ status: "stopped" })} />);
    expect(screen.getByText("Stopped")).toBeDefined();
  });

  it("shows Running status label", () => {
    render(<ServerCard server={makeServer({ status: "running" })} />);
    expect(screen.getByText("Running")).toBeDefined();
  });

  it("shows PID when server has pid", () => {
    render(<ServerCard server={makeServer({ status: "running", pid: 12345 })} />);
    expect(screen.getByText("PID 12345")).toBeDefined();
  });
});
