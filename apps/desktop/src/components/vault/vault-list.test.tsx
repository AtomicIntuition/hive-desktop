import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { VaultList } from "./vault-list";
import { useAppStore } from "@/stores/app-store";

vi.mock("@/lib/runtime-client", () => ({
  listCredentials: vi.fn(),
  deleteCredential: vi.fn(),
  storeCredential: vi.fn(),
}));

import { listCredentials } from "@/lib/runtime-client";
const mockListCredentials = vi.mocked(listCredentials);

describe("VaultList", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: true });
    mockListCredentials.mockReset();
  });

  it("renders Add Credential button", () => {
    mockListCredentials.mockResolvedValue([]);
    render(<VaultList />);
    expect(screen.getByText("Add Credential")).toBeDefined();
  });

  it("renders description text", () => {
    mockListCredentials.mockResolvedValue([]);
    render(<VaultList />);
    expect(screen.getByText(/Securely store API keys/)).toBeDefined();
  });

  it("shows empty state when no credentials", async () => {
    mockListCredentials.mockResolvedValue([]);
    render(<VaultList />);

    await waitFor(() => {
      expect(screen.getByText("No credentials stored")).toBeDefined();
    });
  });

  it("shows credential names when loaded", async () => {
    mockListCredentials.mockResolvedValue([
      { id: "c-1", name: "STRIPE_API_KEY", serverSlug: "stripe-mcp", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    ]);

    render(<VaultList />);

    await waitFor(() => {
      expect(screen.getByText("STRIPE_API_KEY")).toBeDefined();
    });
  });

  it("shows server slug for credentials", async () => {
    mockListCredentials.mockResolvedValue([
      { id: "c-1", name: "KEY", serverSlug: "stripe-mcp", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    ]);

    render(<VaultList />);

    await waitFor(() => {
      expect(screen.getByText("stripe-mcp")).toBeDefined();
    });
  });
});
