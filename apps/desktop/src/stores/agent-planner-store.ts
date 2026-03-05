import { create } from "zustand";
import type { AgentPlanEvent, WorkflowStep } from "@hive-desktop/shared";
import type { AgentPlanResult } from "@/lib/runtime-client";

export interface AgentPlannerState {
  // State
  planning: boolean;
  events: AgentPlanEvent[];
  builtSteps: WorkflowStep[];
  currentIteration: number;
  error: string | null;
  result: AgentPlanResult | null;
  abortController: AbortController | null;

  // Actions
  startPlanning: () => void;
  addEvent: (event: AgentPlanEvent) => void;
  setResult: (result: AgentPlanResult) => void;
  setError: (error: string) => void;
  finish: () => void;
  cancel: () => void;
  reset: () => void;
}

export const useAgentPlannerStore = create<AgentPlannerState>((set, get) => ({
  planning: false,
  events: [],
  builtSteps: [],
  currentIteration: 0,
  error: null,
  result: null,
  abortController: null,

  startPlanning: () =>
    set({
      planning: true,
      events: [],
      builtSteps: [],
      currentIteration: 0,
      error: null,
      result: null,
      abortController: new AbortController(),
    }),

  addEvent: (event) =>
    set((state) => {
      const updates: Partial<AgentPlannerState> = {
        events: [...state.events, event],
      };

      // Track iterations from tool calls
      if (event.type === "agent:tool_call") {
        const iteration = (event.data.iteration as number) ?? state.currentIteration;
        updates.currentIteration = iteration;
      }

      // Track built steps
      if (event.type === "agent:step_added") {
        const step = event.data.step as WorkflowStep;
        updates.builtSteps = [...state.builtSteps, step];
      }

      // Track errors
      if (event.type === "agent:error") {
        updates.error = event.data.message as string;
        updates.planning = false;
      }

      return updates;
    }),

  setResult: (result) => set({ result, planning: false }),

  setError: (error) => set({ error, planning: false }),

  finish: () => set({ planning: false }),

  cancel: () => {
    const { abortController } = get();
    abortController?.abort();
    set({ planning: false, abortController: null });
  },

  reset: () =>
    set({
      planning: false,
      events: [],
      builtSteps: [],
      currentIteration: 0,
      error: null,
      result: null,
      abortController: null,
    }),
}));
