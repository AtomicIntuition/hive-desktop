import { useServers } from "@/hooks/use-servers";
import { ServerCard } from "./server-card";

export function ServerList() {
  const { servers, loading } = useServers();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
        <p className="text-gray-400">No MCP servers installed</p>
        <p className="mt-1 text-sm text-gray-500">Browse the Hive Market to discover and install tools</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {servers.map((server) => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
