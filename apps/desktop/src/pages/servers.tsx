import { useState } from "react";
import { cn } from "@/lib/utils";
import { ServerList } from "@/components/servers/server-list";
import { ServerBrowser } from "@/components/servers/server-browser";

type Tab = "installed" | "browse";

export function ServersPage() {
  const [tab, setTab] = useState<Tab>("browse");

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-gray-900/50 p-1 border border-white/[0.06] w-fit">
        {([
          { value: "installed" as Tab, label: "Installed" },
          { value: "browse" as Tab, label: "Browse Hive Market" },
        ]).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              tab === t.value
                ? "bg-violet-500/15 text-violet-300"
                : "text-gray-400 hover:text-gray-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "installed" ? <ServerList /> : <ServerBrowser />}
    </div>
  );
}
