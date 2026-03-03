import { create } from "zustand";
import type { Workflow } from "@hive-desktop/shared";

interface WorkflowState {
  workflows: Workflow[];
  loading: boolean;
  setWorkflows: (workflows: Workflow[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  loading: false,
  setWorkflows: (workflows) => set({ workflows }),
  setLoading: (loading) => set({ loading }),
}));
