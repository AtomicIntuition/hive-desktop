import { useLocation } from "react-router-dom";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/workflows": "Workflows",
  "/servers": "MCP Servers",
  "/vault": "Credential Vault",
  "/settings": "Settings",
};

export function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? "Hive Desktop";
  const appVersion = useAppStore((s) => s.appVersion);
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);

  return (
    <header
      data-tauri-drag-region
      className="flex h-14 items-center justify-between border-b border-white/[0.06] bg-gray-950/80 backdrop-blur-sm px-6"
    >
      <h1 className="text-lg font-semibold text-gray-50">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              runtimeConnected ? "bg-emerald-400" : "bg-red-400 animate-pulse"
            )}
          />
          <span className="text-xs text-gray-500">
            {runtimeConnected ? "Runtime" : "Disconnected"}
          </span>
        </div>
        <span className="text-xs text-gray-600">v{appVersion}</span>
      </div>
    </header>
  );
}
