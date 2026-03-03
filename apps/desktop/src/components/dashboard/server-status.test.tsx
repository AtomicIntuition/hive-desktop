import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServerStatus } from "./server-status";
import type { McpServer } from "@hive-desktop/shared";

function makeServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: "srv-1",
    slug: "stripe-mcp",
    name: "Stripe MCP",
    description: "",
    installCommand: "npx",
    status: "running",
    installedAt: "2026-01-01",
    ...overrides,
  };
}

describe("ServerStatus", () => {
  it("renders empty state when no servers", () => {
    render(<ServerStatus servers={[]} />);
    expect(screen.getByText(/No servers installed/)).toBeDefined();
  });

  it("renders server name and status", () => {
    render(<ServerStatus servers={[makeServer()]} />);
    expect(screen.getByText("Stripe MCP")).toBeDefined();
    expect(screen.getByText("Running")).toBeDefined();
  });

  it("shows correct status labels", () => {
    render(
      <ServerStatus
        servers={[
          makeServer({ id: "1", name: "Stripe MCP", status: "running" }),
          makeServer({ id: "2", name: "GitHub MCP", status: "stopped" }),
          makeServer({ id: "3", name: "Sentry MCP", status: "error" }),
        ]}
      />
    );
    expect(screen.getByText("Running")).toBeDefined();
    expect(screen.getByText("Stopped")).toBeDefined();
    expect(screen.getByText("Error")).toBeDefined();
  });
});
