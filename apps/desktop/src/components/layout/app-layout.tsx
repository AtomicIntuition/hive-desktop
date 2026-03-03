import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useAppStore } from "@/stores/app-store";
import { useRuntime } from "@/hooks/use-runtime";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

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
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
