import { useEffect, useRef, useCallback } from "react";
import { WS_URL } from "@/lib/constants";
import { useAppStore } from "@/stores/app-store";
import { useServerStore } from "@/stores/server-store";
import type { ServerEvent } from "@hive-desktop/shared";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);
  const updateServerStatus = useServerStore((s) => s.updateServerStatus);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data) as ServerEvent;
      switch (msg.type) {
        case "server:status":
          updateServerStatus(msg.data.id, msg.data.status);
          break;
        case "server:log":
          // Logs are polled via REST — this is for real-time push if needed later
          break;
        case "server:installed":
        case "server:removed":
          // Trigger a full refresh via the hook
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
  }, [updateServerStatus]);

  useEffect(() => {
    if (!runtimeConnected) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = handleMessage;

    ws.onerror = () => {
      console.warn("[ws] Connection error");
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [runtimeConnected, handleMessage]);
}
