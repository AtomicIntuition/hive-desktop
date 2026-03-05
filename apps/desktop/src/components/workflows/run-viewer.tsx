import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { listWorkflowRuns, getWorkflowRun } from "@/lib/runtime-client";
import type { WorkflowRun } from "@hive-desktop/shared";
import { JsonViewer } from "@/components/ui/json-viewer";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  Copy,
  Download,
  Maximize2,
  X,
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
          className="flex w-full items-center gap-4 rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm p-4 text-left transition-colors hover:border-violet-500/20"
        >
          {statusIcons[run.status]}
          <div className="flex-1 min-w-0">
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
  const [fullscreenStep, setFullscreenStep] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
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

  const handleCopyJson = useCallback(() => {
    if (!run?.result) return;
    navigator.clipboard.writeText(JSON.stringify(run.result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [run?.result]);

  const handleDownloadJson = useCallback(() => {
    if (!run?.result) return;
    const blob = new Blob([JSON.stringify(run.result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${runId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [run?.result, runId]);

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
  const passedSteps = run.error ? run.stepsExecuted - 1 : run.stepsExecuted;
  const failedSteps = run.error ? 1 : 0;
  const duration = run.completedAt
    ? formatDuration(new Date(run.startedAt), new Date(run.completedAt))
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 hover:border-white/[0.12] transition-colors"
        >
          &larr; Back
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

      {/* Summary Header */}
      <div className="rounded-lg border border-white/[0.06] bg-gray-800/30 p-3">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-gray-500" />
            <span className="text-gray-400">{duration ?? "Running…"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="text-gray-400">{passedSteps} passed</span>
          </div>
          {failedSteps > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-red-400" />
              <span className="text-gray-400">{failedSteps} failed</span>
            </div>
          )}
          <div className="text-gray-600">
            {new Date(run.startedAt).toLocaleString()}
          </div>
          {resultData && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 rounded px-2 py-1 text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors"
                title="Copy JSON"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownloadJson}
                className="flex items-center gap-1 rounded px-2 py-1 text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition-colors"
                title="Download JSON"
              >
                <Download className="h-3 w-3" />
                Export
              </button>
            </div>
          )}
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
          const isFailed = i === run.stepsExecuted - 1 && !!run.error;

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
                <span className={cn("text-sm flex-1 min-w-0 truncate", isExecuted ? "text-gray-300" : "text-gray-600")}>
                  {step.name}
                </span>
                <span className="ml-auto shrink-0">
                  {isExecuted ? (
                    isFailed ? (
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
                    <div className="relative">
                      <button
                        onClick={() => setFullscreenStep(i)}
                        className="absolute top-1 right-1 rounded p-1 text-gray-600 hover:text-gray-300 hover:bg-white/[0.06] transition-colors z-10"
                        title="Full screen"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </button>
                      <div className="overflow-auto rounded-lg bg-gray-900/60 backdrop-blur-sm p-3" style={{ maxHeight: "240px" }}>
                        {typeof stepResult === "object" && stepResult !== null ? (
                          <JsonViewer data={stepResult} />
                        ) : (
                          <pre className="font-mono text-xs text-gray-400 whitespace-pre-wrap">
                            {String(stepResult)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 italic">No output captured</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fullscreen Modal */}
      {fullscreenStep !== null && (
        <FullscreenOutputModal
          stepName={steps[fullscreenStep]?.name ?? `Step ${fullscreenStep + 1}`}
          data={resultData?.[steps[fullscreenStep]?.outputVar ?? ""] ?? resultData?.[steps[fullscreenStep]?.id]}
          onClose={() => setFullscreenStep(null)}
        />
      )}
    </div>
  );
}

// ── Fullscreen Output Modal ──────────────────────────────

function FullscreenOutputModal({
  stepName,
  data,
  onClose,
}: {
  stepName: string;
  data: unknown;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(
      typeof data === "string" ? data : JSON.stringify(data, null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-[90vw] max-w-4xl max-h-[85vh] rounded-xl border border-white/[0.08] bg-gray-900 shadow-2xl flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h4 className="text-sm font-medium text-gray-200">{stepName}</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Copy className="h-3 w-3" />
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Modal body */}
        <div className="flex-1 overflow-auto p-4">
          {typeof data === "object" && data !== null ? (
            <JsonViewer data={data} defaultExpanded maxDepth={8} />
          ) : (
            <pre className="font-mono text-xs text-gray-400 whitespace-pre-wrap">
              {String(data ?? "")}
            </pre>
          )}
        </div>
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
        <div className="flex items-center gap-3">
          {!isComplete && <ElapsedTimer />}
          {isComplete && (
            <button
              onClick={clearActiveRun}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-gray-800 overflow-hidden mb-3">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isComplete
              ? activeRun.status === "completed" ? "bg-emerald-500" : "bg-red-500"
              : "bg-violet-500"
          )}
          style={{
            width: `${steps.length > 0 ? Math.round(((activeRun.stepStatuses?.size ?? 0) / steps.length) * 100) : 0}%`,
          }}
        />
      </div>

      {steps.map((step, i) => {
        const detail = activeRun.stepStatuses.get(i);
        const status = detail?.status ?? "waiting";

        return (
          <div key={step.id} className="flex items-center gap-3 text-sm">
            <span className="w-5 shrink-0 flex justify-center">
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
              "flex-1 min-w-0 truncate",
              status === "waiting" ? "text-gray-600" :
              status === "running" ? "text-violet-300" :
              status === "failed" ? "text-red-300" :
              "text-gray-300"
            )}>
              {step.name}
            </span>
            {detail?.durationMs !== undefined && (
              <span className="text-xs text-gray-500 shrink-0">
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

// ── Elapsed Timer ────────────────────────────────────────

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="text-xs font-mono text-gray-500 tabular-nums">
      {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
