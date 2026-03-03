import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VaultPage } from "./vault";
import { useAppStore } from "@/stores/app-store";

vi.mock("@/lib/runtime-client", () => ({
  listCredentials: vi.fn().mockResolvedValue([]),
  deleteCredential: vi.fn(),
  storeCredential: vi.fn(),
}));

describe("VaultPage", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: true });
  });

  it("renders vault list component", () => {
    render(<VaultPage />);
    expect(screen.getByText("Add Credential")).toBeDefined();
  });

  it("renders vault description", () => {
    render(<VaultPage />);
    expect(screen.getByText(/Securely store API keys/)).toBeDefined();
  });
});
