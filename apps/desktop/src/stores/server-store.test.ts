import { describe, it, expect, beforeEach } from "vitest";
import { useServerStore } from "./server-store";

describe("useServerStore", () => {
  beforeEach(() => {
    useServerStore.setState({ servers: [], loading: false });
  });

  it("has correct initial state", () => {
    const state = useServerStore.getState();
    expect(state.servers).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it("setServers updates server list", () => {
    const servers = [
      {
        id: "srv-1",
        slug: "stripe-mcp",
        name: "Stripe MCP",
        description: "",
        installCommand: "npx" as const,
        status: "running" as const,
        installedAt: "2026-01-01",
        connected: true,
      },
    ];
    useServerStore.getState().setServers(servers);
    expect(useServerStore.getState().servers).toHaveLength(1);
    expect(useServerStore.getState().servers[0].name).toBe("Stripe MCP");
  });

  it("setLoading updates loading flag", () => {
    useServerStore.getState().setLoading(true);
    expect(useServerStore.getState().loading).toBe(true);
  });

  it("updateServerStatus updates specific server status", () => {
    useServerStore.setState({
      servers: [
        {
          id: "srv-1",
          slug: "test",
          name: "Test",
          description: "",
          installCommand: "npx" as const,
          status: "stopped" as const,
          installedAt: "2026-01-01",
          connected: false,
        },
        {
          id: "srv-2",
          slug: "other",
          name: "Other",
          description: "",
          installCommand: "npx" as const,
          status: "running" as const,
          installedAt: "2026-01-01",
          connected: true,
        },
      ],
    });

    useServerStore.getState().updateServerStatus("srv-1", "running");
    const servers = useServerStore.getState().servers;
    expect(servers[0].status).toBe("running");
    expect(servers[1].status).toBe("running"); // unchanged
  });

  it("updateServerStatus is safe for non-existent id", () => {
    useServerStore.setState({ servers: [] });
    useServerStore.getState().updateServerStatus("bad-id", "error");
    expect(useServerStore.getState().servers).toEqual([]);
  });
});
