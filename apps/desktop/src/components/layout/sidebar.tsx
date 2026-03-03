import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  LayoutDashboard,
  Workflow,
  Server,
  KeyRound,
  Settings,
  ChevronLeft,
  Hexagon,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/workflows", icon: Workflow, label: "Workflows" },
  { to: "/servers", icon: Server, label: "Servers" },
  { to: "/vault", icon: KeyRound, label: "Vault" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, runtimeConnected } = useAppStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-white/[0.06] bg-gray-950 transition-all duration-200",
        sidebarCollapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-white/[0.06] px-4">
        <Hexagon className="h-7 w-7 shrink-0 text-amber-500" />
        {!sidebarCollapsed && (
          <span className="text-lg font-semibold tracking-tight">
            Hive <span className="text-violet-400">Desktop</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-violet-500/15 text-violet-400"
                  : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] p-3">
        {/* Runtime status */}
        <div className="mb-3 flex items-center gap-2 px-1">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              runtimeConnected ? "bg-emerald-500" : "bg-red-500"
            )}
          />
          {!sidebarCollapsed && (
            <span className="text-xs text-gray-500">
              Runtime {runtimeConnected ? "connected" : "disconnected"}
            </span>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              sidebarCollapsed && "rotate-180"
            )}
          />
        </button>
      </div>
    </aside>
  );
}
