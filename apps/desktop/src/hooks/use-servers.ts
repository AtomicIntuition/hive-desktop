import { useEffect, useCallback } from "react";
import { useServerStore } from "@/stores/server-store";
import { useAppStore } from "@/stores/app-store";
import { listServers } from "@/lib/runtime-client";

export function useServers() {
  const { servers, loading, setServers, setLoading } = useServerStore();
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);

  const refresh = useCallback(async () => {
    if (!runtimeConnected) return;
    setLoading(true);
    try {
      const data = await listServers();
      setServers(data);
    } catch (err) {
      console.error("Failed to fetch servers:", err);
    } finally {
      setLoading(false);
    }
  }, [runtimeConnected, setServers, setLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { servers, loading, refresh };
}
