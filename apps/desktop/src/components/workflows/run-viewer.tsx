import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { listWorkflowRuns, getWorkflowRun } from "@/lib/runtime-client";
import type { WorkflowRun, WorkflowRunStepDetail } from "@hive-desktop/shared";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
} from "lucide-react";

// ── Runs Tab ──────────────────────────────────────────────

export function RunsTab() {
  const original = useWorkflowEditorStore((s) => s.original);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!original) return;
    setLoading(true);
    listWorkflowRuns(original.id, 50)
      .then(setRuns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [original]);

  // Auto-refresh when active run completes
  const activeRun = useWorkflowEditorStore((s) => s.activeRun);
  useEffect(() => {
    if (!original || !activeRun || activeRun.status === "running") return;
    listWorkflowRuns(original.id, 50).then(setRuns).catch(() => {});
  }, [original, activeRun?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  if (selectedRunId) {
    return (
      <RunDetailPanel
        runId={selectedRunId}
        onBack={() => setSelectedRunId(null)}
      />
    );
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
        <Clock className="mx-auto h-8 w-8 text-gray-600" />
        <p className="mt-3 text-gray-400">No runs yet</p>
        <p className="mt-1 text-sm text-gray-500">Run this workflow to see execution history</p>
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
        <button
          key={run.id}
          onClick={() => setSelectedRunId(run.id)}
          className="flex w-full items-center gap-4 rounded-xl border border-white/[0.06] bg-gray-900/50 p-4 text-left transition-colors hover:border-violet-500/20"
        >
          {statusIcons[run.status]}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">
                {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </span>
              <span className="text-xs text-gray-500">{run.stepsExecuted} steps</span>
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
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      ))}
    </div>
  );
}

// ── Run Detail Panel ─────────────────────────────────────

function RunDetailPanel({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const steps = useWorkflowEditorStore((s) => s.steps);

  useEffect(() => {
    setLoading(true);
    getWorkflowRun(runId)
      .then(setRun)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [runId]);

  const toggleStep = (index: number) => {
    const next = new Set(expandedSteps);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedSteps(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!run) {
    return <p className="text-sm text-gray-400">Run not found.</p>;
  }

  const resultData = run.result as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200"
        >
          Back to runs
        </button>
        <div className="flex-1" />
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            run.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
            run.status === "failed" ? "bg-red-500/10 text-red-400" :
            "bg-violet-500/10 text-violet-400"
          )}
        >
          {run.status}
        </span>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-3 gap-3 text-xs text-gray-500">
        <div>
          <span className="text-gray-600">Started:</span>{" "}
          {new Date(run.startedAt).toLocaleString()}
        </div>
        {run.completedAt && (
          <div>
            <span className="text-gray-600">Duration:</span>{" "}
            {formatDuration(new Date(run.startedAt), new Date(run.completedAt))}
          </div>
        )}
        <div>
          <span className="text-gray-600">Steps:</span> {run.stepsExecuted}/{steps.length}
        </div>
      </div>

      {run.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {run.error}
        </div>
      )}

      {/* Step-by-step output */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400 mb-2">Step Outputs</p>
        {steps.map((step, i) => {
          const stepResult = resultData?.[step.outputVar ?? ""] ?? resultData?.[step.id];
          const isExecuted = i < run.stepsExecuted;
          const expanded = expandedSteps.has(i);

          return (
            <div key={step.id} className="rounded-lg border border-white/[0.04] bg-gray-800/30">
              <button
                onClick={() => toggleStep(i)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                )}
                <span className="text-xs font-mono text-gray-500 w-5">{i + 1}</span>
                <span className={cn("text-sm", isExecuted ? "text-gray-300" : "text-gray-600")}>
                  {step.name}
                </span>
                <span className="ml-auto">
                  {isExecuted ? (
                    i < run.stepsExecuted && !run.error ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : i === run.stepsExecuted - 1 && run.error ? (
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    )
                  ) : (
                    <span className="text-[10px] text-gray-600">skipped</span>
                  )}
                </span>
              </button>

              {expanded && (
                <div className="border-t border-white/[0.04] px-3 py-2">
                  {stepResult !== undefined ? (
                    <pre className="overflow-auto rounded bg-gray-900/50 p-2 font-mono text-xs text-gray-400" style={{ maxHeight: "200px" }}>
                      {typeof stepResult === "string" ? stepResult : JSON.stringify(stepResult, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs text-gray-600 italic">No output captured</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Live Run Overlay ─────────────────────────────────────

export function LiveRunOverlay() {
  const activeRun = useWorkflowEditorStore((s) => s.activeRun);
  const steps = useWorkflowEditorStore((s) => s.steps);
  const clearActiveRun = useWorkflowEditorStore((s) => s.clearActiveRun);

  if (!activeRun) return null;

  const isComplete = activeRun.status !== "running";

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {!isComplete ? (
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          ) : activeRun.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-gray-200">
            {!isComplete ? "Running..." : activeRun.status === "completed" ? "Run Complete" : "Run Failed"}
          </span>
        </div>
        {isComplete && (
          <button
            onClick={clearActiveRun}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Dismiss
          </button>
        )}
      </div>

      {steps.map((step, i) => {
        const detail = activeRun.stepStatuses.get(i);
        const status = detail?.status ?? "waiting";

        return (
          <div key={step.id} className="flex items-center gap-3 text-sm">
            <span className="w-14 shrink-0">
              {status === "running" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
              ) : status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : status === "failed" ? (
                <XCircle className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Play className="h-3.5 w-3.5 text-gray-600" />
              )}
            </span>
            <span className={cn(
              "flex-1",
              status === "waiting" ? "text-gray-600" :
              status === "running" ? "text-violet-300" :
              status === "failed" ? "text-red-300" :
              "text-gray-300"
            )}>
              {step.name}
            </span>
            {detail?.durationMs !== undefined && (
              <span className="text-xs text-gray-500">
                {detail.durationMs < 1000
                  ? `${detail.durationMs}ms`
                  : `${(detail.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
