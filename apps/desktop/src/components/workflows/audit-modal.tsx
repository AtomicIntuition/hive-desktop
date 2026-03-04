import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import {
  X,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  Loader2,
} from "lucide-react";
import type { WorkflowAuditItem } from "@hive-desktop/shared";

export function AuditModal() {
  const { auditResult, auditing, setAuditResult } = useWorkflowEditorStore();
  const toggleStepExpanded = useWorkflowEditorStore((s) => s.toggleStepExpanded);
  const setActiveTab = useWorkflowEditorStore((s) => s.setActiveTab);
  const steps = useWorkflowEditorStore((s) => s.steps);

  if (!auditResult && !auditing) return null;

  const handleClose = () => {
    setAuditResult(null);
  };

  const handleClickStep = (stepIndex: number | undefined) => {
    if (stepIndex === undefined || stepIndex < 0 || stepIndex >= steps.length) return;
    const stepId = steps[stepIndex].id;
    setActiveTab("editor");
    toggleStepExpanded(stepId);
    handleClose();
  };

  const scoreColor =
    !auditResult ? "text-gray-400" :
    auditResult.score >= 80 ? "text-emerald-400" :
    auditResult.score >= 50 ? "text-amber-400" :
    "text-red-400";

  const scoreBg =
    !auditResult ? "bg-gray-500/10" :
    auditResult.score >= 80 ? "bg-emerald-500/10" :
    auditResult.score >= 50 ? "bg-amber-500/10" :
    "bg-red-500/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg rounded-xl border border-white/[0.08] bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-400" />
            <h3 className="font-semibold text-gray-100">AI Audit</h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Loading */}
        {auditing && !auditResult && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            <p className="mt-3 text-sm text-gray-400">Analyzing workflow...</p>
          </div>
        )}

        {/* Results */}
        {auditResult && (
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Score */}
            <div className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-5">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold",
                  scoreBg,
                  scoreColor
                )}
              >
                {auditResult.score}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">
                  {auditResult.score >= 80 ? "Good" : auditResult.score >= 50 ? "Needs Work" : "Critical Issues"}
                </p>
                <p className="mt-1 text-xs text-gray-400">{auditResult.summary}</p>
              </div>
            </div>

            {/* Issues */}
            {auditResult.issues.length > 0 && (
              <div className="border-b border-white/[0.06] px-6 py-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Issues ({auditResult.issues.length})
                </h4>
                <div className="space-y-2">
                  {auditResult.issues.map((item, i) => (
                    <AuditItemRow
                      key={i}
                      item={item}
                      onClickStep={() => handleClickStep(item.stepIndex)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {auditResult.suggestions.length > 0 && (
              <div className="px-6 py-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Suggestions ({auditResult.suggestions.length})
                </h4>
                <div className="space-y-2">
                  {auditResult.suggestions.map((item, i) => (
                    <AuditItemRow
                      key={i}
                      item={item}
                      isSuggestion
                      onClickStep={() => handleClickStep(item.stepIndex)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/[0.06] px-6 py-3 flex justify-end">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditItemRow({
  item,
  isSuggestion,
  onClickStep,
}: {
  item: WorkflowAuditItem;
  isSuggestion?: boolean;
  onClickStep: () => void;
}) {
  const severityConfig = {
    error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  };

  const config = isSuggestion
    ? { icon: Lightbulb, color: "text-violet-400", bg: "bg-violet-500/10" }
    : severityConfig[item.severity];

  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 rounded-lg bg-gray-800/30 px-3 py-2">
      <div className={cn("mt-0.5 rounded p-1", config.bg)}>
        <Icon className={cn("h-3.5 w-3.5", config.color)} />
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-300">{item.message}</p>
        {item.stepIndex !== undefined && (
          <button
            onClick={onClickStep}
            className="mt-1 text-xs text-violet-400 hover:text-violet-300"
          >
            Go to step {item.stepIndex + 1}
          </button>
        )}
      </div>
    </div>
  );
}
