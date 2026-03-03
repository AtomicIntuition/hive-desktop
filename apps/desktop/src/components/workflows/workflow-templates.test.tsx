import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WorkflowTemplates } from "./workflow-templates";

// Mock runtime-client
vi.mock("@/lib/runtime-client", () => ({
  listWorkflowTemplates: vi.fn().mockResolvedValue([
    {
      slug: "payment-monitor",
      name: "Payment Monitor",
      description: "Watch for large payments",
      category: "payments",
      requiredServers: ["stripe-mcp", "slack-mcp"],
      trigger: { type: "interval", seconds: 60 },
      steps: [],
    },
  ]),
  createWorkflowFromTemplate: vi.fn().mockResolvedValue({ id: "wf-1" }),
}));

describe("WorkflowTemplates", () => {
  it("shows loading spinner initially", () => {
    render(<WorkflowTemplates />);
    // Component starts in loading state showing a spinner
    expect(document.querySelector(".animate-spin")).toBeDefined();
  });

  it("renders template names after loading", async () => {
    render(<WorkflowTemplates />);
    const name = await screen.findByText("Payment Monitor");
    expect(name).toBeDefined();
  });

  it("renders template description", async () => {
    render(<WorkflowTemplates />);
    const desc = await screen.findByText("Watch for large payments");
    expect(desc).toBeDefined();
  });

  it("renders required server badges", async () => {
    render(<WorkflowTemplates />);
    const badge = await screen.findByText("stripe-mcp");
    expect(badge).toBeDefined();
    expect(screen.getByText("slack-mcp")).toBeDefined();
  });
});
