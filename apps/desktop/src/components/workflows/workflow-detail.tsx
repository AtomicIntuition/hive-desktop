import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Workflow, WorkflowRun, WorkflowStep } from "@hive-desktop/shared";
import {
  getWorkflow,
  listWorkflowRuns,
  runWorkflow as triggerRun,
  activateWorkflow,
  pauseWorkflow,
} from "@/lib/runtime-client";
import {
  ArrowLeft,
  Play,
  Pause,
  Power,
  Zap,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileEdit,
  ChevronRight,
} from "lucide-react";

interface WorkflowDetailProps {
  workflowId: string;
  onBack: () => void;
}

export function WorkflowDetail({ workflowId, onBack }: WorkflowDetailProps) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [tab, setTab] = useState<"steps" | "runs">("steps");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [wf, runList] = await Promise.all([
        getWorkflow(workflowId),
        listWorkflowRuns(workflowId, 20),
      ]);
      setWorkflow(wf);
      setRuns(runList);
    } catch {
      // Workflow may have been deleted
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRun = async () => {
    setBusy(true);
    try {
      await triggerRun(workflowId);
      setTimeout(refresh, 1000);
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    setBusy(true);
    try {
      await activateWorkflow(workflowId);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    setBusy(true);
    try {
      await pauseWorkflow(workflowId);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-24 text-gray-400">
        Workflow not found.{" "}
        <button onClick={onBack} className="text-violet-400 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const statusColor =
    workflow.status === "active" ? "text-emerald-400" :
    workflow.status === "paused" ? "text-amber-400" :
    workflow.status === "error" ? "text-red-400" :
    "text-gray-400";

  const triggerLabel: Record<string, string> = {
    schedule: `Cron: ${(workflow.trigger as { cron?: string }).cron ?? ""}`,
    interval: `Every ${(workflow.trigger as { seconds?: number }).seconds ?? 0}s`,
    webhook: `Webhook: ${(workflow.trigger as { path?: string }).path ?? ""}`,
    manual: "Manual trigger",
    file_watch: `Watch: ${(workflow.trigger as { path?: string }).path ?? ""}`,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.04] hover:text-gray-200">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-50">{workflow.name}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className={cn("font-medium", statusColor)}>
              {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
            </span>
            <span className="text-gray-500">{triggerLabel[workflow.trigger.type]}</span>
            <span className="text-gray-500">{workflow.steps.length} steps</span>
            <span className="text-gray-500">{workflow.runCount} runs</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          ) : (
            <>
              <button
                onClick={handleRun}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                <Zap className="h-4 w-4" /> Run Now
              </button>
              {workflow.status === "active" ? (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 rounded-lg border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10"
                >
                  <Pause className="h-4 w-4" /> Pause
                </button>
              ) : (
                <button
                  onClick={handleActivate}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <Power className="h-4 w-4" /> Activate
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {workflow.description && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-gray-900/50 p-5">
          <p className="text-sm text-gray-300">{workflow.description}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-900/50 p-1 border border-white/[0.06] w-fit">
        <button
          onClick={() => setTab("steps")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            tab === "steps" ? "bg-violet-500/15 text-violet-300" : "text-gray-400 hover:text-gray-300"
          )}
        >
          Steps ({workflow.steps.length})
        </button>
        <button
          onClick={() => setTab("runs")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            tab === "runs" ? "bg-violet-500/15 text-violet-300" : "text-gray-400 hover:text-gray-300"
          )}
        >
          Run History ({runs.length})
        </button>
      </div>

      {/* Content */}
      {tab === "steps" ? (
        <StepList steps={workflow.steps} />
      ) : (
        <RunHistory runs={runs} />
      )}
    </div>
  );
}

// ── Step List ────────────────────────────────────────────

function StepList({ steps }: { steps: WorkflowStep[] }) {
  const typeConfig: Record<string, { color: string; label: string }> = {
    mcp_call: { color: "text-violet-400", label: "MCP Call" },
    condition: { color: "text-amber-400", label: "Condition" },
    transform: { color: "text-cyan-400", label: "Transform" },
    delay: { color: "text-gray-400", label: "Delay" },
    notify: { color: "text-emerald-400", label: "Notify" },
  };

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const config = typeConfig[step.type] ?? { color: "text-gray-400", label: step.type };
        return (
          <div
            key={step.id}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-gray-900/50 p-4"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-xs font-mono text-gray-400">
              {i + 1}
            </div>
            <ChevronRight className="h-4 w-4 text-gray-600" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{step.name}</span>
                <span className={cn("text-xs font-mono", config.color)}>{config.label}</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                {step.server && <span>Server: {step.server}</span>}
                {step.tool && <span>Tool: {step.tool}</span>}
                {step.outputVar && <span>→ {step.outputVar}</span>}
                <span>On error: {step.onError}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Run History ──────────────────────────────────────────

function RunHistory({ runs }: { runs: WorkflowRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
        <Clock className="mx-auto h-8 w-8 text-gray-600" />
        <p className="mt-3 text-gray-400">No runs yet</p>
        <p className="mt-1 text-sm text-gray-500">Click "Run Now" to execute this workflow</p>
      </div>
    );
  }

  const statusIcons = {
    running: <Loader2 className="h-4 w-4 animate-spin text-violet-400" />,
    completed: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    failed: <XCircle className="h-4 w-4 text-red-400" />,
  };

  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <div
          key={run.id}
          className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-gray-900/50 p-4"
        >
          {statusIcons[run.status]}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">
                {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </span>
              <span className="text-xs text-gray-500">{run.stepsExecuted} steps executed</span>
            </div>
            {run.error && (
              <p className="mt-1 text-xs text-red-400 line-clamp-1">{run.error}</p>
            )}
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>{new Date(run.startedAt).toLocaleString()}</div>
            {run.completedAt && (
              <div className="text-gray-600">
                {formatDuration(new Date(run.startedAt), new Date(run.completedAt))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
