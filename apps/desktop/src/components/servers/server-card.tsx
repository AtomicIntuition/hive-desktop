import { useState } from "react";
import { cn } from "@/lib/utils";
import type { McpServer } from "@hive-desktop/shared";
import { Power, Square, RotateCw, Trash2, Plug, ChevronRight, Loader2 } from "lucide-react";
import { startServer, stopServer, restartServer, removeServer } from "@/lib/runtime-client";

const statusBadge = {
  running: { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-500", label: "Running" },
  stopped: { bg: "bg-gray-500/15", text: "text-gray-400", dot: "bg-gray-500", label: "Stopped" },
  error: { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-500", label: "Error" },
  installing: { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-500", label: "Starting" },
};

interface ServerCardProps {
  server: McpServer & { connected?: boolean };
  onSelect?: () => void;
  onRefresh?: () => void;
}

export function ServerCard({ server, onSelect, onRefresh }: ServerCardProps) {
  const badge = statusBadge[server.status];
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onRefresh?.();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-gray-900/50 p-4 transition-colors hover:border-white/[0.1]">
      <div className="flex items-start justify-between">
        <button onClick={onSelect} className="flex flex-1 items-start gap-3 text-left">
          <div className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", badge.dot)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-100 truncate">{server.name}</h3>
              {server.connected && (
                <Plug className="h-3.5 w-3.5 text-violet-400" />
              )}
            </div>
            {server.description && (
              <p className="mt-0.5 text-sm text-gray-400 line-clamp-1">{server.description}</p>
            )}
            <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
              <span className={cn("font-medium", badge.text)}>{badge.label}</span>
              {server.npmPackage && (
                <span className="font-mono truncate">{server.npmPackage}</span>
              )}
              {server.pid && (
                <span>PID {server.pid}</span>
              )}
            </div>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-600 opacity-0 group-hover:opacity-100" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-1 border-t border-white/[0.04] pt-3">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        ) : (
          <>
            {server.status === "stopped" && (
              <button
                onClick={() => act(() => startServer(server.id))}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10"
              >
                <Power className="h-3.5 w-3.5" />
                Start
              </button>
            )}
            {server.status === "running" && (
              <>
                <button
                  onClick={() => act(() => stopServer(server.id))}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </button>
                <button
                  onClick={() => act(() => restartServer(server.id))}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Restart
                </button>
              </>
            )}
            {server.status === "error" && (
              <button
                onClick={() => act(() => startServer(server.id))}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Retry
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => act(() => removeServer(server.id))}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
              title="Remove server"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
