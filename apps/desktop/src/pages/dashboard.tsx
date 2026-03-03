import { StatsCards } from "@/components/dashboard/stats-cards";
import { ServerStatus } from "@/components/dashboard/server-status";
import { ActiveWorkflows } from "@/components/dashboard/active-workflows";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { useServers } from "@/hooks/use-servers";
import { useWorkflows } from "@/hooks/use-workflows";

export function DashboardPage() {
  const { servers } = useServers();
  const { workflows } = useWorkflows();

  const stats = {
    activeWorkflows: workflows.filter((w) => w.status === "active").length,
    runningServers: servers.filter((s) => s.status === "running").length,
    totalRuns: workflows.reduce((sum, w) => sum + w.runCount, 0),
    errorRate: workflows.length
      ? Math.round(
          (workflows.reduce((sum, w) => sum + w.errorCount, 0) /
            Math.max(workflows.reduce((sum, w) => sum + w.runCount, 0), 1)) *
            100
        )
      : 0,
  };

  return (
    <div className="space-y-6">
      <StatsCards {...stats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActiveWorkflows workflows={workflows} />
        <ServerStatus servers={servers} />
      </div>

      <ActivityFeed />
    </div>
  );
}
