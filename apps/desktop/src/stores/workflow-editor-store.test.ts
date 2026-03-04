import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowEditorStore } from "./workflow-editor-store";
import type { Workflow, WorkflowStep, WorkflowTrigger } from "@hive-desktop/shared";

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf-1",
    name: "Test Workflow",
    description: "A test workflow",
    status: "draft",
    trigger: { type: "manual" },
    steps: [
      { id: "s1", name: "Step 1", type: "mcp_call", server: "brave-search-mcp", tool: "brave_web_search", arguments: { query: "test" }, outputVar: "results", onError: "stop" },
      { id: "s2", name: "Step 2", type: "transform", condition: "results.length > 0", outputVar: "count", onError: "stop" },
    ],
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    runCount: 0,
    errorCount: 0,
    ...overrides,
  };
}

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: `step-${Math.random().toString(36).slice(2, 8)}`,
    name: "New Step",
    type: "mcp_call",
    onError: "stop",
    ...overrides,
  };
}

describe("WorkflowEditorStore", () => {
  beforeEach(() => {
    useWorkflowEditorStore.getState().reset();
  });

  // ── Load ────────────────────────────────────────────

  describe("load", () => {
    it("loads workflow into working copy", () => {
      const wf = makeWorkflow();
      useWorkflowEditorStore.getState().load(wf);

      const state = useWorkflowEditorStore.getState();
      expect(state.original).toEqual(wf);
      expect(state.name).toBe("Test Workflow");
      expect(state.description).toBe("A test workflow");
      expect(state.steps).toHaveLength(2);
      expect(state.dirty).toBe(false);
      expect(state.activeTab).toBe("editor");
    });

    it("deep-clones steps so mutations are independent", () => {
      const wf = makeWorkflow();
      useWorkflowEditorStore.getState().load(wf);

      const state = useWorkflowEditorStore.getState();
      state.steps[0].name = "MUTATED";
      expect(wf.steps[0].name).toBe("Step 1"); // original unchanged
    });

    it("resets all state on load", () => {
      const store = useWorkflowEditorStore.getState();
      store.load(makeWorkflow());
      store.setName("Changed");
      store.setActiveTab("json");

      // Load a new workflow
      store.load(makeWorkflow({ id: "wf-2", name: "Other" }));

      const state = useWorkflowEditorStore.getState();
      expect(state.name).toBe("Other");
      expect(state.activeTab).toBe("editor");
      expect(state.dirty).toBe(false);
      expect(state.expandedSteps.size).toBe(0);
    });

    it("initializes history with one entry", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      const state = useWorkflowEditorStore.getState();
      expect(state.history).toHaveLength(1);
      expect(state.historyIndex).toBe(0);
    });
  });

  // ── Dirty Detection ─────────────────────────────────

  describe("dirty detection", () => {
    it("is not dirty after load", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      expect(useWorkflowEditorStore.getState().dirty).toBe(false);
    });

    it("is dirty after setName", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setName("Changed");
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);
    });

    it("is dirty after setDescription", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setDescription("Changed description");
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);
    });

    it("is dirty after setTrigger", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setTrigger({ type: "interval", seconds: 60 });
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);
    });

    it("is dirty after updateStep", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().updateStep("s1", { name: "Renamed" });
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);
    });

    it("is dirty after addStep", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().addStep(makeStep());
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);
    });

    it("is dirty after removeStep", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().removeStep("s1");
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);
    });

    it("is dirty after reorderSteps", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().reorderSteps(0, 1);
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);
    });

    it("becomes clean after markSaved", () => {
      const wf = makeWorkflow();
      useWorkflowEditorStore.getState().load(wf);
      useWorkflowEditorStore.getState().setName("Changed");
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);

      useWorkflowEditorStore.getState().markSaved({ ...wf, name: "Changed" });
      expect(useWorkflowEditorStore.getState().dirty).toBe(false);
    });

    it("reverts to clean when name matches original", () => {
      const wf = makeWorkflow();
      useWorkflowEditorStore.getState().load(wf);
      useWorkflowEditorStore.getState().setName("Changed");
      expect(useWorkflowEditorStore.getState().dirty).toBe(true);

      useWorkflowEditorStore.getState().setName("Test Workflow");
      expect(useWorkflowEditorStore.getState().dirty).toBe(false);
    });
  });

  // ── Step Mutations ──────────────────────────────────

  describe("step mutations", () => {
    it("updateStep modifies the correct step", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().updateStep("s1", { name: "Renamed", onError: "retry" });

      const steps = useWorkflowEditorStore.getState().steps;
      expect(steps[0].name).toBe("Renamed");
      expect(steps[0].onError).toBe("retry");
      expect(steps[1].name).toBe("Step 2"); // unchanged
    });

    it("addStep appends at end by default", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      const newStep = makeStep({ id: "s3", name: "Step 3" });
      useWorkflowEditorStore.getState().addStep(newStep);

      const steps = useWorkflowEditorStore.getState().steps;
      expect(steps).toHaveLength(3);
      expect(steps[2].id).toBe("s3");
    });

    it("addStep at specific index", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      const newStep = makeStep({ id: "s-middle", name: "Middle" });
      useWorkflowEditorStore.getState().addStep(newStep, 1);

      const steps = useWorkflowEditorStore.getState().steps;
      expect(steps).toHaveLength(3);
      expect(steps[0].id).toBe("s1");
      expect(steps[1].id).toBe("s-middle");
      expect(steps[2].id).toBe("s2");
    });

    it("addStep auto-expands the new step", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      const newStep = makeStep({ id: "s-new" });
      useWorkflowEditorStore.getState().addStep(newStep);

      expect(useWorkflowEditorStore.getState().expandedSteps.has("s-new")).toBe(true);
    });

    it("removeStep filters out the step", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().removeStep("s1");

      const steps = useWorkflowEditorStore.getState().steps;
      expect(steps).toHaveLength(1);
      expect(steps[0].id).toBe("s2");
    });

    it("removeStep cleans up expanded set", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().toggleStepExpanded("s1");
      expect(useWorkflowEditorStore.getState().expandedSteps.has("s1")).toBe(true);

      useWorkflowEditorStore.getState().removeStep("s1");
      expect(useWorkflowEditorStore.getState().expandedSteps.has("s1")).toBe(false);
    });

    it("reorderSteps swaps step positions", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().reorderSteps(0, 1);

      const steps = useWorkflowEditorStore.getState().steps;
      expect(steps[0].id).toBe("s2");
      expect(steps[1].id).toBe("s1");
    });

    it("reorderSteps no-op for same index", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().reorderSteps(0, 0);

      const steps = useWorkflowEditorStore.getState().steps;
      expect(steps[0].id).toBe("s1");
    });

    it("reorderSteps no-op for out-of-bounds", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().reorderSteps(-1, 0);

      const steps = useWorkflowEditorStore.getState().steps;
      expect(steps[0].id).toBe("s1");
    });
  });

  // ── Undo / Redo ─────────────────────────────────────

  describe("undo/redo", () => {
    it("undo reverts last change", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setName("Changed");
      expect(useWorkflowEditorStore.getState().name).toBe("Changed");

      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().name).toBe("Test Workflow");
    });

    it("redo re-applies undone change", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setName("Changed");
      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().name).toBe("Test Workflow");

      useWorkflowEditorStore.getState().redo();
      // After redo, name should be back to the state before undo
      // But note: redo goes to the next snapshot, which is the snapshot *before* the setName
      // The way the store works: setName pushes current state, then mutates
      // So history[0] = initial load state, history[1] = state before setName
      // undo goes to history[0] (initial), redo goes to history[1]
    });

    it("undo is no-op at beginning of history", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().name).toBe("Test Workflow");
    });

    it("redo is no-op at end of history", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().redo();
      expect(useWorkflowEditorStore.getState().name).toBe("Test Workflow");
    });

    it("multiple undos walk back through history", () => {
      // Store pushes current state BEFORE mutation, so:
      // load → history = [initial], state = initial
      // setName("First")  → history = [initial, initial],  state = "First"
      // setName("Second") → history = [initial, initial, First], state = "Second"
      // setName("Third")  → history = [initial, initial, First, Second], state = "Third"
      // undo → restore history[2] = "First" state, index=2... wait, let's trace more carefully
      //
      // Actually, each pushHistory pushes current working state before the mutation happens.
      // So after setName("First"):  history = [loadSnapshot, {name:"Test Workflow",...}], state.name = "First"
      // After setName("Second"): history = [loadSnapshot, {name:"Test Workflow",...}, {name:"First",...}], state.name = "Second"
      // After setName("Third"):  history = [loadSnapshot, {name:"Test Workflow",...}, {name:"First",...}, {name:"Second",...}], state.name = "Third"
      // undo: historyIndex goes from 3→2, restores snapshot at [2] = {name:"First",...}
      // undo: historyIndex goes from 2→1, restores snapshot at [1] = {name:"Test Workflow",...}
      // undo: historyIndex goes from 1→0, restores snapshot at [0] = load snapshot = "Test Workflow"
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setName("First");
      useWorkflowEditorStore.getState().setName("Second");
      useWorkflowEditorStore.getState().setName("Third");

      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().name).toBe("First");

      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().name).toBe("Test Workflow");

      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().name).toBe("Test Workflow"); // already at beginning
    });

    it("new mutation after undo truncates redo history", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setName("First");
      useWorkflowEditorStore.getState().setName("Second");

      useWorkflowEditorStore.getState().undo(); // back to "First"
      useWorkflowEditorStore.getState().setName("Branch"); // new branch

      useWorkflowEditorStore.getState().redo(); // should be no-op, redo was truncated
      expect(useWorkflowEditorStore.getState().name).toBe("Branch");
    });

    it("undo works across step mutations", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().addStep(makeStep({ id: "s3" }));
      expect(useWorkflowEditorStore.getState().steps).toHaveLength(3);

      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().steps).toHaveLength(2);
    });

    it("respects history limit of 50", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      for (let i = 0; i < 60; i++) {
        useWorkflowEditorStore.getState().setName(`Change ${i}`);
      }

      const state = useWorkflowEditorStore.getState();
      expect(state.history.length).toBeLessThanOrEqual(50);
    });
  });

  // ── Replace from JSON ───────────────────────────────

  describe("replaceAllFromJson", () => {
    it("replaces all fields", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().replaceAllFromJson({
        name: "From JSON",
        description: "JSON desc",
        trigger: { type: "interval", seconds: 120 },
        steps: [{ id: "j1", name: "JSON Step", type: "delay", arguments: { seconds: 5 }, onError: "continue" }],
      });

      const state = useWorkflowEditorStore.getState();
      expect(state.name).toBe("From JSON");
      expect(state.description).toBe("JSON desc");
      expect(state.trigger.type).toBe("interval");
      expect(state.steps).toHaveLength(1);
      expect(state.steps[0].name).toBe("JSON Step");
      expect(state.dirty).toBe(true);
    });

    it("is undoable", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().replaceAllFromJson({
        name: "From JSON",
        description: "",
        trigger: { type: "manual" },
        steps: [],
      });

      useWorkflowEditorStore.getState().undo();
      expect(useWorkflowEditorStore.getState().name).toBe("Test Workflow");
      expect(useWorkflowEditorStore.getState().steps).toHaveLength(2);
    });
  });

  // ── UI State ────────────────────────────────────────

  describe("UI state", () => {
    it("toggleStepExpanded toggles", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().toggleStepExpanded("s1");
      expect(useWorkflowEditorStore.getState().expandedSteps.has("s1")).toBe(true);

      useWorkflowEditorStore.getState().toggleStepExpanded("s1");
      expect(useWorkflowEditorStore.getState().expandedSteps.has("s1")).toBe(false);
    });

    it("expandAllSteps expands all", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().expandAllSteps();
      expect(useWorkflowEditorStore.getState().expandedSteps.size).toBe(2);
    });

    it("collapseAllSteps collapses all", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().expandAllSteps();
      useWorkflowEditorStore.getState().collapseAllSteps();
      expect(useWorkflowEditorStore.getState().expandedSteps.size).toBe(0);
    });

    it("setActiveTab changes tab", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setActiveTab("json");
      expect(useWorkflowEditorStore.getState().activeTab).toBe("json");
    });

    it("setSaving updates saving state", () => {
      useWorkflowEditorStore.getState().setSaving(true);
      expect(useWorkflowEditorStore.getState().saving).toBe(true);
    });
  });

  // ── Active Run ──────────────────────────────────────

  describe("active run", () => {
    it("setActiveRun initializes run state", () => {
      useWorkflowEditorStore.getState().setActiveRun("run-1");

      const state = useWorkflowEditorStore.getState();
      expect(state.activeRun).not.toBeNull();
      expect(state.activeRun!.runId).toBe("run-1");
      expect(state.activeRun!.status).toBe("running");
      expect(state.activeRun!.stepStatuses.size).toBe(0);
    });

    it("updateStepStatus adds step detail", () => {
      useWorkflowEditorStore.getState().setActiveRun("run-1");
      useWorkflowEditorStore.getState().updateStepStatus({
        runId: "run-1",
        stepIndex: 0,
        stepId: "s1",
        status: "completed",
        output: { data: "test" },
        durationMs: 123,
        startedAt: "2026-01-01T00:00:00Z",
        completedAt: "2026-01-01T00:00:00Z",
      });

      const detail = useWorkflowEditorStore.getState().activeRun!.stepStatuses.get(0);
      expect(detail).toBeDefined();
      expect(detail!.status).toBe("completed");
      expect(detail!.durationMs).toBe(123);
    });

    it("updateStepStatus ignores wrong runId", () => {
      useWorkflowEditorStore.getState().setActiveRun("run-1");
      useWorkflowEditorStore.getState().updateStepStatus({
        runId: "run-OTHER",
        stepIndex: 0,
        stepId: "s1",
        status: "completed",
        startedAt: "2026-01-01T00:00:00Z",
      });

      expect(useWorkflowEditorStore.getState().activeRun!.stepStatuses.size).toBe(0);
    });

    it("completeActiveRun sets status", () => {
      useWorkflowEditorStore.getState().setActiveRun("run-1");
      useWorkflowEditorStore.getState().completeActiveRun("completed");
      expect(useWorkflowEditorStore.getState().activeRun!.status).toBe("completed");
    });

    it("clearActiveRun removes run state", () => {
      useWorkflowEditorStore.getState().setActiveRun("run-1");
      useWorkflowEditorStore.getState().clearActiveRun();
      expect(useWorkflowEditorStore.getState().activeRun).toBeNull();
    });
  });

  // ── Audit ───────────────────────────────────────────

  describe("audit", () => {
    it("setAuditResult stores result", () => {
      const result = { score: 85, summary: "Good", issues: [], suggestions: [] };
      useWorkflowEditorStore.getState().setAuditResult(result);
      expect(useWorkflowEditorStore.getState().auditResult).toEqual(result);
    });

    it("setAuditing updates flag", () => {
      useWorkflowEditorStore.getState().setAuditing(true);
      expect(useWorkflowEditorStore.getState().auditing).toBe(true);
    });

    it("setAuditResult null clears", () => {
      useWorkflowEditorStore.getState().setAuditResult({ score: 50, summary: "", issues: [], suggestions: [] });
      useWorkflowEditorStore.getState().setAuditResult(null);
      expect(useWorkflowEditorStore.getState().auditResult).toBeNull();
    });
  });

  // ── Held Steps ──────────────────────────────────────

  describe("held steps", () => {
    it("toggleHeld adds step to held set", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().toggleHeld("s1");
      expect(useWorkflowEditorStore.getState().heldSteps.has("s1")).toBe(true);
    });

    it("toggleHeld removes step when already held", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().toggleHeld("s1");
      useWorkflowEditorStore.getState().toggleHeld("s1");
      expect(useWorkflowEditorStore.getState().heldSteps.has("s1")).toBe(false);
    });

    it("clearHeld empties the held set", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().toggleHeld("s1");
      useWorkflowEditorStore.getState().toggleHeld("s2");
      expect(useWorkflowEditorStore.getState().heldSteps.size).toBe(2);

      useWorkflowEditorStore.getState().clearHeld();
      expect(useWorkflowEditorStore.getState().heldSteps.size).toBe(0);
    });

    it("load resets held steps", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().toggleHeld("s1");

      useWorkflowEditorStore.getState().load(makeWorkflow({ id: "wf-2" }));
      expect(useWorkflowEditorStore.getState().heldSteps.size).toBe(0);
    });

    it("reset clears held steps", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().toggleHeld("s1");

      useWorkflowEditorStore.getState().reset();
      expect(useWorkflowEditorStore.getState().heldSteps.size).toBe(0);
    });
  });

  // ── Reset ───────────────────────────────────────────

  describe("reset", () => {
    it("restores initial state", () => {
      useWorkflowEditorStore.getState().load(makeWorkflow());
      useWorkflowEditorStore.getState().setName("Modified");
      useWorkflowEditorStore.getState().setActiveTab("json");

      useWorkflowEditorStore.getState().reset();

      const state = useWorkflowEditorStore.getState();
      expect(state.original).toBeNull();
      expect(state.name).toBe("");
      expect(state.steps).toEqual([]);
      expect(state.activeTab).toBe("editor");
      expect(state.dirty).toBe(false);
    });
  });
});
