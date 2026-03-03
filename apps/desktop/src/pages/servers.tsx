import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ServerList } from "@/components/servers/server-list";
import { ServerBrowser } from "@/components/servers/server-browser";
import { ServerDetail } from "@/components/servers/server-detail";
import { useServers } from "@/hooks/use-servers";

type Tab = "installed" | "browse";

export function ServersPage() {
  const [tab, setTab] = useState<Tab>("installed");
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const { servers, refresh } = useServers();

  const installedSlugs = useMemo(
    () => new Set(servers.map((s) => s.slug)),
    [servers]
  );

  // Detail view
  if (selectedServerId) {
    return (
      <ServerDetail
        serverId={selectedServerId}
        onBack={() => setSelectedServerId(null)}
      />
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-900/50 p-1 border border-white/[0.06]">
          {([
            { value: "installed" as Tab, label: `Installed (${servers.length})` },
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
      </div>

      {tab === "installed" ? (
        <ServerList onSelectServer={setSelectedServerId} />
      ) : (
        <ServerBrowser
          installedSlugs={installedSlugs}
          onInstalled={() => { refresh(); setTab("installed"); }}
        />
      )}
    </div>
  );
}
