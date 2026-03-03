import { cn } from "@/lib/utils";
import type { McpServer } from "@hive-desktop/shared";

const statusConfig = {
  running: { label: "Running", color: "bg-emerald-500", textColor: "text-emerald-400" },
  stopped: { label: "Stopped", color: "bg-gray-500", textColor: "text-gray-400" },
  error: { label: "Error", color: "bg-red-500", textColor: "text-red-400" },
  installing: { label: "Installing", color: "bg-amber-500", textColor: "text-amber-400" },
};

interface ServerStatusProps {
  servers: McpServer[];
}

export function ServerStatus({ servers }: ServerStatusProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">MCP Servers</h3>
      {servers.length === 0 ? (
        <p className="text-sm text-gray-500">No servers installed yet. Browse the marketplace to get started.</p>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => {
            const config = statusConfig[server.status];
            return (
              <div key={server.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("h-2 w-2 rounded-full", config.color)} />
                  <span className="text-sm text-gray-200">{server.name}</span>
                </div>
                <span className={cn("text-xs font-medium", config.textColor)}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
