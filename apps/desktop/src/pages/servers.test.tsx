import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServersPage } from "./servers";
import { useAppStore } from "@/stores/app-store";
import { useServerStore } from "@/stores/server-store";

vi.mock("@/lib/runtime-client", () => ({
  listServers: vi.fn().mockResolvedValue([]),
  startServer: vi.fn(),
  stopServer: vi.fn(),
  restartServer: vi.fn(),
  removeServer: vi.fn(),
  installServer: vi.fn(),
}));

describe("ServersPage", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: false });
    useServerStore.setState({ servers: [], loading: false });
  });

  it("renders Installed and Browse tabs", () => {
    render(<ServersPage />);
    expect(screen.getByText(/Installed/)).toBeDefined();
    expect(screen.getByText("Browse Hive Market")).toBeDefined();
  });

  it("shows installed count in tab", () => {
    useServerStore.setState({
      servers: [
        { id: "1", slug: "stripe", name: "Stripe", description: "", installCommand: "npx", status: "stopped", installedAt: "" },
      ],
    });
    render(<ServersPage />);
    expect(screen.getByText("Installed (1)")).toBeDefined();
  });

  it("shows empty server list message by default", () => {
    render(<ServersPage />);
    expect(screen.getByText("No MCP servers installed")).toBeDefined();
  });
});
