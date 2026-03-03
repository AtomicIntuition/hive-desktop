import { cn } from "@/lib/utils";
import type { Workflow } from "@hive-desktop/shared";
import { Play, Pause, AlertCircle, FileEdit, Clock, MoreVertical } from "lucide-react";

const statusConfig = {
  active: { icon: Play, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Active" },
  paused: { icon: Pause, color: "text-amber-400", bg: "bg-amber-500/15", label: "Paused" },
  error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/15", label: "Error" },
  draft: { icon: FileEdit, color: "text-gray-400", bg: "bg-gray-500/15", label: "Draft" },
};

const triggerLabels: Record<string, string> = {
  schedule: "Scheduled",
  interval: "Interval",
  webhook: "Webhook",
  manual: "Manual",
  file_watch: "File Watch",
};

interface WorkflowCardProps {
  workflow: Workflow;
}

export function WorkflowCard({ workflow }: WorkflowCardProps) {
  const config = statusConfig[workflow.status];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-4 transition-colors hover:border-white/[0.1]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", config.bg)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div>
            <h3 className="font-medium text-gray-100">{workflow.name}</h3>
            <p className="mt-0.5 text-sm text-gray-400">{workflow.description}</p>
          </div>
        </div>
        <button className="rounded-lg p-1.5 text-gray-500 hover:bg-white/[0.04] hover:text-gray-400">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", config.bg, config.color)}>
          {config.label}
        </span>
        <span>{triggerLabels[workflow.trigger.type] ?? workflow.trigger.type}</span>
        <span>{workflow.steps.length} steps</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {workflow.runCount} runs
        </span>
      </div>
    </div>
  );
}
