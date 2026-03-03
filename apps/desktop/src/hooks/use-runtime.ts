import { useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { checkHealth } from "@/lib/runtime-client";

export function useRuntime() {
  const { runtimeConnected, setRuntimeConnected } = useAppStore();

  const pollHealth = useCallback(async () => {
    try {
      await checkHealth();
      setRuntimeConnected(true);
    } catch {
      setRuntimeConnected(false);
    }
  }, [setRuntimeConnected]);

  useEffect(() => {
    // Initial check
    pollHealth();

    // Poll every 5 seconds
    const interval = setInterval(pollHealth, 5000);
    return () => clearInterval(interval);
  }, [pollHealth]);

  return { runtimeConnected };
}
