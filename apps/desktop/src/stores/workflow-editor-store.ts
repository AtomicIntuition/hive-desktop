import { create } from "zustand";
import type {
  Workflow,
  WorkflowTrigger,
  WorkflowStep,
  WorkflowRunStepDetail,
  WorkflowAuditResult,
} from "@hive-desktop/shared";

// ── Types ─────────────────────────────────────────────

interface EditorSnapshot {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
}

interface ActiveRun {
  runId: string;
  status: "running" | "completed" | "failed";
  stepStatuses: Map<number, WorkflowRunStepDetail>;
}

interface WorkflowEditorState {
  // Source of truth for dirty check
  original: Workflow | null;

  // Working copy
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];

  // Undo/redo
  history: EditorSnapshot[];
  historyIndex: number;

  // UI state
  dirty: boolean;
  expandedSteps: Set<string>;
  heldSteps: Set<string>;
  activeTab: "editor" | "runs" | "json";
  saving: boolean;

  // Live run
  activeRun: ActiveRun | null;

  // AI audit
  auditResult: WorkflowAuditResult | null;
  auditing: boolean;

  // Actions
  load: (workflow: Workflow) => void;
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setTrigger: (trigger: WorkflowTrigger) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  addStep: (step: WorkflowStep, atIndex?: number) => void;
  removeStep: (stepId: string) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  undo: () => void;
  redo: () => void;
  replaceAllFromJson: (data: { name: string; description: string; trigger: WorkflowTrigger; steps: WorkflowStep[] }) => void;
  markSaved: (workflow: Workflow) => void;
  setActiveTab: (tab: "editor" | "runs" | "json") => void;
  toggleStepExpanded: (stepId: string) => void;
  collapseAllSteps: () => void;
  expandAllSteps: () => void;
  setSaving: (saving: boolean) => void;

  // Live run actions
  setActiveRun: (runId: string) => void;
  updateStepStatus: (detail: WorkflowRunStepDetail) => void;
  completeActiveRun: (status: "completed" | "failed") => void;
  clearActiveRun: () => void;

  // Hold actions
  toggleHeld: (stepId: string) => void;
  clearHeld: () => void;

  // Audit actions
  setAuditResult: (result: WorkflowAuditResult | null) => void;
  setAuditing: (auditing: boolean) => void;

  // Reset
  reset: () => void;
}

const MAX_HISTORY = 50;

function makeSnapshot(state: { name: string; description: string; trigger: WorkflowTrigger; steps: WorkflowStep[] }): EditorSnapshot {
  return {
    name: state.name,
    description: state.description,
    trigger: JSON.parse(JSON.stringify(state.trigger)),
    steps: JSON.parse(JSON.stringify(state.steps)),
  };
}

function isDirty(
  original: Workflow | null,
  name: string,
  description: string,
  trigger: WorkflowTrigger,
  steps: WorkflowStep[]
): boolean {
  if (!original) return false;
  return (
    name !== original.name ||
    description !== original.description ||
    JSON.stringify(trigger) !== JSON.stringify(original.trigger) ||
    JSON.stringify(steps) !== JSON.stringify(original.steps)
  );
}

const initialState = {
  original: null as Workflow | null,
  name: "",
  description: "",
  trigger: { type: "manual" } as WorkflowTrigger,
  steps: [] as WorkflowStep[],
  history: [] as EditorSnapshot[],
  historyIndex: -1,
  dirty: false,
  expandedSteps: new Set<string>(),
  heldSteps: new Set<string>(),
  activeTab: "editor" as const,
  saving: false,
  activeRun: null as ActiveRun | null,
  auditResult: null as WorkflowAuditResult | null,
  auditing: false,
};

export const useWorkflowEditorStore = create<WorkflowEditorState>((set, get) => ({
  ...initialState,

  load: (workflow) => {
    const snapshot = makeSnapshot({
      name: workflow.name,
      description: workflow.description,
      trigger: workflow.trigger,
      steps: workflow.steps,
    });
    set({
      original: workflow,
      name: workflow.name,
      description: workflow.description,
      trigger: JSON.parse(JSON.stringify(workflow.trigger)),
      steps: JSON.parse(JSON.stringify(workflow.steps)),
      history: [snapshot],
      historyIndex: 0,
      dirty: false,
      expandedSteps: new Set<string>(),
      heldSteps: new Set<string>(),
      activeTab: "editor",
      saving: false,
      activeRun: null,
      auditResult: null,
      auditing: false,
    });
  },

  setName: (name) => {
    const state = get();
    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    set({
      name,
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, name, state.description, state.trigger, state.steps),
    });
  },

  setDescription: (description) => {
    const state = get();
    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    set({
      description,
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, state.name, description, state.trigger, state.steps),
    });
  },

  setTrigger: (trigger) => {
    const state = get();
    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    set({
      trigger,
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, state.name, state.description, trigger, state.steps),
    });
  },

  updateStep: (stepId, updates) => {
    const state = get();
    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    const steps = state.steps.map((s) =>
      s.id === stepId ? { ...s, ...updates } : s
    );
    set({
      steps,
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, state.name, state.description, state.trigger, steps),
    });
  },

  addStep: (step, atIndex) => {
    const state = get();
    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    const steps = [...state.steps];
    if (atIndex !== undefined && atIndex >= 0 && atIndex <= steps.length) {
      steps.splice(atIndex, 0, step);
    } else {
      steps.push(step);
    }
    set({
      steps,
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, state.name, state.description, state.trigger, steps),
      expandedSteps: new Set([...state.expandedSteps, step.id]),
    });
  },

  removeStep: (stepId) => {
    const state = get();
    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    const steps = state.steps.filter((s) => s.id !== stepId);
    const expandedSteps = new Set(state.expandedSteps);
    expandedSteps.delete(stepId);
    set({
      steps,
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, state.name, state.description, state.trigger, steps),
      expandedSteps,
    });
  },

  reorderSteps: (fromIndex, toIndex) => {
    const state = get();
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= state.steps.length) return;
    if (toIndex < 0 || toIndex >= state.steps.length) return;

    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    const steps = [...state.steps];
    const [moved] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, moved);
    set({
      steps,
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, state.name, state.description, state.trigger, steps),
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const newIndex = state.historyIndex - 1;
    const snapshot = state.history[newIndex];
    set({
      name: snapshot.name,
      description: snapshot.description,
      trigger: JSON.parse(JSON.stringify(snapshot.trigger)),
      steps: JSON.parse(JSON.stringify(snapshot.steps)),
      historyIndex: newIndex,
      dirty: isDirty(state.original, snapshot.name, snapshot.description, snapshot.trigger, snapshot.steps),
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const newIndex = state.historyIndex + 1;
    const snapshot = state.history[newIndex];
    set({
      name: snapshot.name,
      description: snapshot.description,
      trigger: JSON.parse(JSON.stringify(snapshot.trigger)),
      steps: JSON.parse(JSON.stringify(snapshot.steps)),
      historyIndex: newIndex,
      dirty: isDirty(state.original, snapshot.name, snapshot.description, snapshot.trigger, snapshot.steps),
    });
  },

  replaceAllFromJson: (data) => {
    const state = get();
    const snapshot = makeSnapshot(state);
    const history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(-MAX_HISTORY);
    set({
      name: data.name,
      description: data.description,
      trigger: JSON.parse(JSON.stringify(data.trigger)),
      steps: JSON.parse(JSON.stringify(data.steps)),
      history,
      historyIndex: history.length - 1,
      dirty: isDirty(state.original, data.name, data.description, data.trigger, data.steps),
    });
  },

  markSaved: (workflow) => {
    set({
      original: workflow,
      dirty: false,
      saving: false,
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleStepExpanded: (stepId) => {
    const state = get();
    const expanded = new Set(state.expandedSteps);
    if (expanded.has(stepId)) {
      expanded.delete(stepId);
    } else {
      expanded.add(stepId);
    }
    set({ expandedSteps: expanded });
  },

  collapseAllSteps: () => set({ expandedSteps: new Set() }),
  expandAllSteps: () => {
    const state = get();
    set({ expandedSteps: new Set(state.steps.map((s) => s.id)) });
  },

  setSaving: (saving) => set({ saving }),

  // Live run
  setActiveRun: (runId) => set({
    activeRun: {
      runId,
      status: "running",
      stepStatuses: new Map(),
    },
  }),

  updateStepStatus: (detail) => {
    const state = get();
    if (!state.activeRun || state.activeRun.runId !== detail.runId) return;
    const stepStatuses = new Map(state.activeRun.stepStatuses);
    stepStatuses.set(detail.stepIndex, detail);
    set({
      activeRun: { ...state.activeRun, stepStatuses },
    });
  },

  completeActiveRun: (status) => {
    const state = get();
    if (!state.activeRun) return;
    set({
      activeRun: { ...state.activeRun, status },
    });
  },

  clearActiveRun: () => set({ activeRun: null }),

  // Holds
  toggleHeld: (stepId) => {
    const state = get();
    const held = new Set(state.heldSteps);
    if (held.has(stepId)) {
      held.delete(stepId);
    } else {
      held.add(stepId);
    }
    set({ heldSteps: held });
  },
  clearHeld: () => set({ heldSteps: new Set() }),

  // Audit
  setAuditResult: (result) => set({ auditResult: result }),
  setAuditing: (auditing) => set({ auditing }),

  // Reset
  reset: () => set(initialState),
}));
