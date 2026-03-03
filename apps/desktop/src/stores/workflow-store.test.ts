import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore } from "./workflow-store";

describe("WorkflowStore", () => {
  beforeEach(() => {
    useWorkflowStore.setState({ workflows: [], loading: false });
  });

  it("starts with empty state", () => {
    const state = useWorkflowStore.getState();
    expect(state.workflows).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it("sets workflows", () => {
    const workflows = [
      {
        id: "1",
        name: "Test",
        description: "",
        status: "draft" as const,
        trigger: { type: "manual" as const },
        steps: [],
        createdAt: "",
        updatedAt: "",
        runCount: 0,
        errorCount: 0,
      },
    ];

    useWorkflowStore.getState().setWorkflows(workflows);
    expect(useWorkflowStore.getState().workflows).toHaveLength(1);
    expect(useWorkflowStore.getState().workflows[0].name).toBe("Test");
  });

  it("sets loading state", () => {
    useWorkflowStore.getState().setLoading(true);
    expect(useWorkflowStore.getState().loading).toBe(true);
  });

  it("updates workflow status by ID", () => {
    useWorkflowStore.setState({
      workflows: [
        {
          id: "1",
          name: "WF1",
          description: "",
          status: "draft",
          trigger: { type: "manual" },
          steps: [],
          createdAt: "",
          updatedAt: "",
          runCount: 0,
          errorCount: 0,
        },
        {
          id: "2",
          name: "WF2",
          description: "",
          status: "draft",
          trigger: { type: "manual" },
          steps: [],
          createdAt: "",
          updatedAt: "",
          runCount: 0,
          errorCount: 0,
        },
      ],
    });

    useWorkflowStore.getState().updateWorkflowStatus("1", "active");

    const workflows = useWorkflowStore.getState().workflows;
    expect(workflows[0].status).toBe("active");
    expect(workflows[1].status).toBe("draft"); // Unchanged
  });

  it("does nothing when updating non-existent workflow", () => {
    useWorkflowStore.setState({
      workflows: [
        {
          id: "1",
          name: "WF1",
          description: "",
          status: "draft",
          trigger: { type: "manual" },
          steps: [],
          createdAt: "",
          updatedAt: "",
          runCount: 0,
          errorCount: 0,
        },
      ],
    });

    useWorkflowStore.getState().updateWorkflowStatus("99", "active");
    expect(useWorkflowStore.getState().workflows[0].status).toBe("draft");
  });
});
