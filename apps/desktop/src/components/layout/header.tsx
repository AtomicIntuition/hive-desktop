import { useLocation } from "react-router-dom";
import { useAppStore } from "@/stores/app-store";

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

  return (
    <header
      data-tauri-drag-region
      className="flex h-14 items-center justify-between border-b border-white/[0.06] px-6"
    >
      <h1 className="text-lg font-semibold text-gray-50">{title}</h1>
      <span className="text-xs text-gray-600">v{appVersion}</span>
    </header>
  );
}
