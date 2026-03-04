import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAppStore } from "@/stores/app-store";
import { useRuntime } from "@/hooks/use-runtime";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCw } from "lucide-react";

export function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);

  // Connect to runtime + WebSocket
  useRuntime();
  useWebSocket();

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-200",
          sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"
        )}
      >
        <Header />
        {/* Runtime disconnected banner */}
        {!runtimeConnected && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">Runtime not connected</p>
              <p className="text-xs text-red-400/70">
                The Node.js runtime server is not running on port 45678. Start it with:{" "}
                <code className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-red-300">
                  pnpm dev:runtime
                </code>
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
            >
              <RotateCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
