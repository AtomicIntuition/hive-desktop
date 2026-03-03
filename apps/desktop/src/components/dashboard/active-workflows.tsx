import { cn } from "@/lib/utils";
import type { Workflow } from "@hive-desktop/shared";
import { Play, Pause, AlertCircle, FileEdit } from "lucide-react";

const statusIcons = {
  active: Play,
  paused: Pause,
  error: AlertCircle,
  draft: FileEdit,
};

const statusColors = {
  active: "text-emerald-400",
  paused: "text-amber-400",
  error: "text-red-400",
  draft: "text-gray-400",
};

interface ActiveWorkflowsProps {
  workflows: Workflow[];
}

export function ActiveWorkflows({ workflows }: ActiveWorkflowsProps) {
  const recent = workflows.slice(0, 5);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">Recent Workflows</h3>
      {recent.length === 0 ? (
        <p className="text-sm text-gray-500">No workflows created yet. Describe what you want to automate.</p>
      ) : (
        <div className="space-y-3">
          {recent.map((wf) => {
            const Icon = statusIcons[wf.status];
            return (
              <div key={wf.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4", statusColors[wf.status])} />
                  <div>
                    <p className="text-sm text-gray-200">{wf.name}</p>
                    <p className="text-xs text-gray-500">{wf.runCount} runs</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{wf.trigger.type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
