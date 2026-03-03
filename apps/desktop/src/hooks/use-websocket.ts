import { useEffect, useRef } from "react";
import { WS_URL } from "@/lib/constants";
import { useAppStore } from "@/stores/app-store";
import { useServerStore } from "@/stores/server-store";
import type { ServerEvent } from "@hive-desktop/shared";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);
  const updateServerStatus = useServerStore((s) => s.updateServerStatus);

  useEffect(() => {
    if (!runtimeConnected) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerEvent;
        switch (msg.type) {
          case "server:status":
            updateServerStatus(msg.data.id, msg.data.status);
            break;
          case "runtime:ready":
            console.log("[ws] Runtime ready on port", msg.data.port);
            break;
          default:
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      console.warn("[ws] Connection error");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [runtimeConnected, updateServerStatus]);
}
