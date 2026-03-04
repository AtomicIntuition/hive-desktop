import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JsonEditorTab } from "./json-editor";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";

describe("JsonEditorTab", () => {
  beforeEach(() => {
    useWorkflowEditorStore.getState().reset();
    useWorkflowEditorStore.getState().load({
      id: "wf-1",
      name: "Test Workflow",
      description: "Test description",
      status: "draft",
      trigger: { type: "manual" },
      steps: [
        { id: "s1", name: "Step 1", type: "mcp_call", server: "test", tool: "test_tool", onError: "stop" },
      ],
      createdAt: "",
      updatedAt: "",
      runCount: 0,
      errorCount: 0,
    });
  });

  it("renders in read mode by default", () => {
    render(<JsonEditorTab />);
    expect(screen.getByText("Workflow JSON")).toBeDefined();
    expect(screen.getByText("Copy")).toBeDefined();
    expect(screen.getByText("Edit JSON")).toBeDefined();
  });

  it("shows syntax-highlighted JSON content", () => {
    render(<JsonEditorTab />);
    // Should contain the workflow name somewhere in the highlighted output
    const pre = document.querySelector("pre");
    expect(pre).toBeDefined();
    expect(pre?.textContent).toContain("Test Workflow");
    expect(pre?.textContent).toContain("mcp_call");
  });

  it("switching to edit mode shows textarea", () => {
    render(<JsonEditorTab />);
    fireEvent.click(screen.getByText("Edit JSON"));

    expect(screen.getByText("Edit JSON", { selector: "span" })).toBeDefined();
    const textarea = document.querySelector("textarea");
    expect(textarea).toBeDefined();
    expect(textarea?.value).toContain("Test Workflow");
  });

  it("shows Apply and Cancel buttons in edit mode", () => {
    render(<JsonEditorTab />);
    fireEvent.click(screen.getByText("Edit JSON"));

    expect(screen.getByText("Apply Changes")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("cancel returns to read mode", () => {
    render(<JsonEditorTab />);
    fireEvent.click(screen.getByText("Edit JSON"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByText("Workflow JSON")).toBeDefined();
  });

  it("apply with valid JSON updates the store", () => {
    render(<JsonEditorTab />);
    fireEvent.click(screen.getByText("Edit JSON"));

    const textarea = document.querySelector("textarea")!;
    const newJson = JSON.stringify({
      name: "Updated Name",
      description: "Updated desc",
      trigger: { type: "manual" },
      steps: [{ id: "s1", name: "Updated Step", type: "delay", arguments: { seconds: 5 }, onError: "continue" }],
    }, null, 2);

    fireEvent.change(textarea, { target: { value: newJson } });
    fireEvent.click(screen.getByText("Apply Changes"));

    const state = useWorkflowEditorStore.getState();
    expect(state.name).toBe("Updated Name");
    expect(state.description).toBe("Updated desc");
    expect(state.steps[0].name).toBe("Updated Step");
  });

  it("apply with invalid JSON shows error", () => {
    render(<JsonEditorTab />);
    fireEvent.click(screen.getByText("Edit JSON"));

    const textarea = document.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "not valid json" } });
    fireEvent.click(screen.getByText("Apply Changes"));

    // Should still be in edit mode (error shown)
    expect(screen.getByText("Apply Changes")).toBeDefined();
  });

  it("apply with missing required fields shows error", () => {
    render(<JsonEditorTab />);
    fireEvent.click(screen.getByText("Edit JSON"));

    const textarea = document.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: JSON.stringify({ description: "no name" }) } });
    fireEvent.click(screen.getByText("Apply Changes"));

    // Should still be in edit mode
    expect(screen.getByText("Apply Changes")).toBeDefined();
  });

  it("copy button works", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(<JsonEditorTab />);
    fireEvent.click(screen.getByText("Copy"));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(writeTextMock.mock.calls[0][0]).toContain("Test Workflow");
    });
  });
});
