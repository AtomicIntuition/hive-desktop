import { cn } from "@/lib/utils";
import type { McpServer } from "@hive-desktop/shared";
import { Power, Square, Trash2 } from "lucide-react";

const statusBadge = {
  running: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Running" },
  stopped: { bg: "bg-gray-500/15", text: "text-gray-400", label: "Stopped" },
  error: { bg: "bg-red-500/15", text: "text-red-400", label: "Error" },
  installing: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Installing" },
};

interface ServerCardProps {
  server: McpServer;
  onStart?: () => void;
  onStop?: () => void;
  onRemove?: () => void;
}

export function ServerCard({ server, onStart, onStop, onRemove }: ServerCardProps) {
  const badge = statusBadge[server.status];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-100">{server.name}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.bg, badge.text)}>
              {badge.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{server.slug}</p>
          {server.npmPackage && (
            <p className="mt-1 text-xs font-mono text-gray-600">{server.npmPackage}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {server.status === "stopped" && (
            <button
              onClick={onStart}
              className="rounded-lg p-2 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400"
              title="Start server"
            >
              <Power className="h-4 w-4" />
            </button>
          )}
          {server.status === "running" && (
            <button
              onClick={onStop}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
              title="Stop server"
            >
              <Square className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onRemove}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
            title="Remove server"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
