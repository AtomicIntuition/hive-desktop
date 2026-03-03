import { create } from "zustand";
import type { Workflow, WorkflowStatus } from "@hive-desktop/shared";

interface WorkflowState {
  workflows: Workflow[];
  loading: boolean;
  setWorkflows: (workflows: Workflow[]) => void;
  setLoading: (loading: boolean) => void;
  updateWorkflowStatus: (id: string, status: WorkflowStatus) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: [],
  loading: false,
  setWorkflows: (workflows) => set({ workflows }),
  setLoading: (loading) => set({ loading }),
  updateWorkflowStatus: (id, status) =>
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, status } : w
      ),
    })),
}));
