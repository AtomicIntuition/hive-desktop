import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Workflow } from "@hive-desktop/shared";
import {
  Play,
  Pause,
  AlertCircle,
  FileEdit,
  Clock,
  Trash2,
  Loader2,
  Zap,
  Power,
} from "lucide-react";
import {
  activateWorkflow,
  pauseWorkflow,
  deleteWorkflow,
  runWorkflow as triggerRun,
} from "@/lib/runtime-client";

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
  onSelect?: (id: string) => void;
  onRefresh?: () => void;
}

export function WorkflowCard({ workflow, onSelect, onRefresh }: WorkflowCardProps) {
  const [busy, setBusy] = useState(false);
  const config = statusConfig[workflow.status];
  const Icon = config.icon;

  const handleActivate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await activateWorkflow(workflow.id);
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await pauseWorkflow(workflow.id);
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await triggerRun(workflow.id);
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await deleteWorkflow(workflow.id);
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={() => onSelect?.(workflow.id)}
      className="rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm p-4 transition-colors hover:border-white/[0.1] cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2", config.bg)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div>
            <h3 className="font-medium text-gray-100">{workflow.name}</h3>
            <p className="mt-0.5 text-sm text-gray-400 line-clamp-1">{workflow.description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          ) : (
            <>
              <button
                onClick={handleRun}
                title="Run now"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-violet-500/10 hover:text-violet-400"
              >
                <Zap className="h-4 w-4" />
              </button>
              {workflow.status === "active" ? (
                <button
                  onClick={handlePause}
                  title="Pause"
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-amber-500/10 hover:text-amber-400"
                >
                  <Pause className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  title="Activate"
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                >
                  <Power className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleDelete}
                title="Delete"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
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
        {workflow.errorCount > 0 && (
          <span className="text-red-400">{workflow.errorCount} errors</span>
        )}
      </div>
    </div>
  );
}
