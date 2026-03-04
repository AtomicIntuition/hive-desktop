import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAppStore } from "@/stores/app-store";
import { useRuntime } from "@/hooks/use-runtime";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCw, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);
  const [showBanner, setShowBanner] = useState(false);

  // Connect to runtime + WebSocket
  useRuntime();
  useWebSocket();

  // Delay showing the banner to give the runtime time to auto-start
  useEffect(() => {
    if (runtimeConnected) {
      setShowBanner(false);
      return;
    }
    const timer = setTimeout(() => setShowBanner(true), 5000);
    return () => clearTimeout(timer);
  }, [runtimeConnected]);

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
        {/* Runtime connecting / disconnected banner */}
        {!runtimeConnected && !showBanner && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-400" />
            <p className="text-sm text-amber-300">Starting runtime server...</p>
          </div>
        )}
        {!runtimeConnected && showBanner && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">Runtime not connected</p>
              <p className="text-xs text-red-400/70">
                Could not connect to the runtime server. Make sure Node.js (v22+) is installed.
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
