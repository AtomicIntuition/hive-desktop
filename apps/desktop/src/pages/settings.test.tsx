import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SettingsPage } from "./settings";
import { useAppStore } from "@/stores/app-store";

vi.mock("@/lib/runtime-client", () => ({
  getAiStatus: vi.fn(),
  setAiApiKey: vi.fn(),
  removeAiApiKey: vi.fn(),
}));

import { getAiStatus } from "@/lib/runtime-client";
const mockGetAiStatus = vi.mocked(getAiStatus);

describe("SettingsPage", () => {
  beforeEach(() => {
    useAppStore.setState({ runtimeConnected: true, runtimePort: 45678 });
    mockGetAiStatus.mockReset();
  });

  it("renders Runtime section", () => {
    mockGetAiStatus.mockResolvedValue({ configured: false, provider: "", model: "" });
    render(<SettingsPage />);
    expect(screen.getByText("Runtime")).toBeDefined();
    expect(screen.getByText("Runtime Status")).toBeDefined();
  });

  it("shows connected status", () => {
    mockGetAiStatus.mockResolvedValue({ configured: false, provider: "", model: "" });
    render(<SettingsPage />);
    expect(screen.getByText("Connected")).toBeDefined();
  });

  it("shows runtime port", () => {
    mockGetAiStatus.mockResolvedValue({ configured: false, provider: "", model: "" });
    render(<SettingsPage />);
    expect(screen.getByText("45678")).toBeDefined();
  });

  it("renders AI Provider section", () => {
    mockGetAiStatus.mockResolvedValue({ configured: false, provider: "", model: "" });
    render(<SettingsPage />);
    expect(screen.getByText("AI Provider")).toBeDefined();
    expect(screen.getByText("Anthropic API Key")).toBeDefined();
  });

  it("shows Save Key button", () => {
    mockGetAiStatus.mockResolvedValue({ configured: false, provider: "", model: "" });
    render(<SettingsPage />);
    expect(screen.getByText("Save Key")).toBeDefined();
  });

  it("renders About section", () => {
    mockGetAiStatus.mockResolvedValue({ configured: false, provider: "", model: "" });
    render(<SettingsPage />);
    expect(screen.getByText("About")).toBeDefined();
    expect(screen.getByText("Hive Desktop")).toBeDefined();
  });

  it("shows AI configured status", async () => {
    mockGetAiStatus.mockResolvedValue({ configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" });
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeDefined();
    });
  });
});
