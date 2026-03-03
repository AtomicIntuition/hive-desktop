import { Workflow, Server, Play, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-50">{value}</p>
        </div>
        <div className={cn("rounded-lg p-3", bgColor)}>
          <Icon className={cn("h-6 w-6", color)} />
        </div>
      </div>
    </div>
  );
}

interface StatsCardsProps {
  activeWorkflows: number;
  runningServers: number;
  totalRuns: number;
  errorRate: number;
}

export function StatsCards({ activeWorkflows, runningServers, totalRuns, errorRate }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Active Workflows"
        value={activeWorkflows}
        icon={Workflow}
        color="text-violet-400"
        bgColor="bg-violet-500/15"
      />
      <StatCard
        label="Running Servers"
        value={runningServers}
        icon={Server}
        color="text-emerald-400"
        bgColor="bg-emerald-500/15"
      />
      <StatCard
        label="Total Runs"
        value={totalRuns}
        icon={Play}
        color="text-amber-400"
        bgColor="bg-amber-500/15"
      />
      <StatCard
        label="Error Rate"
        value={`${errorRate}%`}
        icon={AlertTriangle}
        color="text-red-400"
        bgColor="bg-red-500/15"
      />
    </div>
  );
}
