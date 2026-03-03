import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ServerBrowser } from "./server-browser";
import { useAppStore } from "@/stores/app-store";

// Mock runtime-client
vi.mock("@/lib/runtime-client", () => ({
  installServer: vi.fn().mockResolvedValue({}),
}));

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("ServerBrowser", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: true });
    mockFetch.mockReset();
  });

  it("renders search input", () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    render(<ServerBrowser />);
    expect(screen.getByPlaceholderText(/Search MCP servers/)).toBeDefined();
  });

  it("renders category filter buttons", () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    render(<ServerBrowser />);
    expect(screen.getByText("All")).toBeDefined();
    expect(screen.getByText("Dev Tools")).toBeDefined();
    expect(screen.getByText("Payments")).toBeDefined();
  });

  it("shows tools from API response", async () => {
    const mockTools = [
      { slug: "stripe-mcp", name: "Stripe MCP", description: "Payments", tags: ["payments"], npmPackage: "@stripe/mcp" },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTools),
    });

    render(<ServerBrowser />);

    await waitFor(() => {
      expect(screen.getByText("Stripe MCP")).toBeDefined();
    });
  });

  it("shows empty state when no tools found", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<ServerBrowser />);

    await waitFor(() => {
      expect(screen.getByText("No tools found")).toBeDefined();
    });
  });

  it("shows Installed badge for installed tools", async () => {
    const mockTools = [
      { slug: "stripe-mcp", name: "Stripe MCP", description: "Payments", tags: [], npmPackage: "@stripe/mcp" },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTools),
    });

    render(<ServerBrowser installedSlugs={new Set(["stripe-mcp"])} />);

    await waitFor(() => {
      expect(screen.getByText("Installed")).toBeDefined();
    });
  });
});
