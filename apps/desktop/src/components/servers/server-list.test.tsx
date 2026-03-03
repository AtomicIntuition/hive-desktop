import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServerList } from "./server-list";
import { useServerStore } from "@/stores/server-store";
import { useAppStore } from "@/stores/app-store";

// Mock runtime-client (needed by ServerCard and useServers)
vi.mock("@/lib/runtime-client", () => ({
  startServer: vi.fn().mockResolvedValue({}),
  stopServer: vi.fn().mockResolvedValue({}),
  restartServer: vi.fn().mockResolvedValue({}),
  removeServer: vi.fn().mockResolvedValue({}),
  listServers: vi.fn().mockResolvedValue([]),
}));

describe("ServerList", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: false });
    useServerStore.setState({ servers: [], loading: false });
  });

  it("renders empty state when no servers", () => {
    render(<ServerList />);
    expect(screen.getByText(/No MCP servers installed/)).toBeDefined();
  });

  it("renders server cards when servers exist", () => {
    useServerStore.setState({
      servers: [
        {
          id: "1",
          slug: "stripe",
          name: "Stripe MCP",
          description: "Payments",
          installCommand: "npx" as const,
          status: "stopped" as const,
          installedAt: "2026-01-01",
          connected: false,
        },
      ],
    });
    render(<ServerList />);
    expect(screen.getByText("Stripe MCP")).toBeDefined();
  });
});
