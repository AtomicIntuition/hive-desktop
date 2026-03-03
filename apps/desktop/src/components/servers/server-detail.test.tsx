import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ServerDetail } from "./server-detail";

vi.mock("@/lib/runtime-client", () => ({
  getServer: vi.fn(),
  getServerLogs: vi.fn(),
  connectServer: vi.fn(),
  listServerTools: vi.fn(),
  callServerTool: vi.fn(),
  startServer: vi.fn(),
  stopServer: vi.fn(),
}));

import { getServer, getServerLogs } from "@/lib/runtime-client";
const mockGetServer = vi.mocked(getServer);
const mockGetServerLogs = vi.mocked(getServerLogs);

describe("ServerDetail", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    onBack.mockReset();
    mockGetServer.mockReset();
    mockGetServerLogs.mockReset();
  });

  it("shows loading spinner initially", () => {
    mockGetServer.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetServerLogs.mockReturnValue(new Promise(() => {}));
    render(<ServerDetail serverId="srv-1" onBack={onBack} />);
    expect(document.querySelector(".animate-spin")).toBeDefined();
  });

  it("shows server not found when fetch fails", async () => {
    mockGetServer.mockRejectedValue(new Error("not found"));
    mockGetServerLogs.mockRejectedValue(new Error("not found"));
    render(<ServerDetail serverId="srv-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Server not found.")).toBeDefined();
    });
  });

  it("shows server name after loading", async () => {
    mockGetServer.mockResolvedValue({
      id: "srv-1",
      slug: "stripe-mcp",
      name: "Stripe MCP",
      description: "Payment processing",
      installCommand: "npx",
      npmPackage: "@stripe/mcp",
      status: "running",
      installedAt: "2026-01-01",
      pid: 12345,
    });
    mockGetServerLogs.mockResolvedValue({ logs: [] });

    render(<ServerDetail serverId="srv-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Stripe MCP")).toBeDefined();
    });
  });

  it("shows Stop button when server is running", async () => {
    mockGetServer.mockResolvedValue({
      id: "srv-1",
      slug: "stripe-mcp",
      name: "Stripe MCP",
      description: "",
      installCommand: "npx",
      status: "running",
      installedAt: "2026-01-01",
    });
    mockGetServerLogs.mockResolvedValue({ logs: [] });

    render(<ServerDetail serverId="srv-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("Stop")).toBeDefined();
    });
  });

  it("shows Tools and Logs tabs", async () => {
    mockGetServer.mockResolvedValue({
      id: "srv-1",
      slug: "test",
      name: "Test",
      description: "",
      installCommand: "npx",
      status: "stopped",
      installedAt: "2026-01-01",
    });
    mockGetServerLogs.mockResolvedValue({ logs: [] });

    render(<ServerDetail serverId="srv-1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Tools/)).toBeDefined();
      expect(screen.getByText(/Logs/)).toBeDefined();
    });
  });
});
