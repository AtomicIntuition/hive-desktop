import { useEffect, useRef, useCallback } from "react";
import { WS_URL } from "@/lib/constants";
import { useAppStore } from "@/stores/app-store";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import type { ServerEvent } from "@hive-desktop/shared";

/**
 * WebSocket hook for the workflow editor.
 * Subscribes to workflow:run:step:detail events and updates the editor store's active run.
 */
export function useWebSocketEditor() {
  const wsRef = useRef<WebSocket | null>(null);
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);
  const updateStepStatus = useWorkflowEditorStore((s) => s.updateStepStatus);
  const completeActiveRun = useWorkflowEditorStore((s) => s.completeActiveRun);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data) as ServerEvent;
      switch (msg.type) {
        case "workflow:run:step:detail":
          updateStepStatus(msg.data);
          break;
        case "workflow:run:complete":
          completeActiveRun(msg.data.run.status as "completed" | "failed");
          break;
        default:
          break;
      }
    } catch {
      // Ignore malformed messages
    }
  }, [updateStepStatus, completeActiveRun]);

  useEffect(() => {
    if (!runtimeConnected) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = handleMessage;
    ws.onerror = () => {};
    ws.onclose = () => { wsRef.current = null; };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [runtimeConnected, handleMessage]);
}
