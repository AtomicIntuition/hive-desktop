import { useEffect, useCallback } from "react";
import { useWorkflowStore } from "@/stores/workflow-store";
import { useAppStore } from "@/stores/app-store";
import { listWorkflows } from "@/lib/runtime-client";

export function useWorkflows() {
  const { workflows, loading, setWorkflows, setLoading } = useWorkflowStore();
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);

  const refresh = useCallback(async () => {
    if (!runtimeConnected) return;
    setLoading(true);
    try {
      const data = await listWorkflows();
      setWorkflows(data);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
    } finally {
      setLoading(false);
    }
  }, [runtimeConnected, setWorkflows, setLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { workflows, loading, refresh };
}
