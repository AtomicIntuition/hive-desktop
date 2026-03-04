import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { fixWorkflow, auditWorkflow, updateWorkflow } from "@/lib/runtime-client";
import {
  X,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  Lightbulb,
  Loader2,
  Wrench,
  Check,
  RotateCcw,
} from "lucide-react";
import type { WorkflowAuditItem } from "@hive-desktop/shared";

export function AuditModal() {
  const { auditResult, auditing, setAuditResult, setAuditing } = useWorkflowEditorStore();
  const toggleStepExpanded = useWorkflowEditorStore((s) => s.toggleStepExpanded);
  const setActiveTab = useWorkflowEditorStore((s) => s.setActiveTab);
  const steps = useWorkflowEditorStore((s) => s.steps);
  const name = useWorkflowEditorStore((s) => s.name);
  const description = useWorkflowEditorStore((s) => s.description);
  const trigger = useWorkflowEditorStore((s) => s.trigger);
  const replaceAllFromJson = useWorkflowEditorStore((s) => s.replaceAllFromJson);
  const original = useWorkflowEditorStore((s) => s.original);
  const markSaved = useWorkflowEditorStore((s) => s.markSaved);

  const [fixing, setFixing] = useState(false);
  const [fixChanges, setFixChanges] = useState<string[] | null>(null);
  const [fixChecklist, setFixChecklist] = useState<Array<{ message: string; fixed: boolean }> | null>(null);
  const [fixWarning, setFixWarning] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setAuditResult(null);
    setFixChanges(null);
    setFixChecklist(null);
    setFixWarning(null);
  }, [setAuditResult]);

  const handleClickStep = useCallback((stepIndex: number | undefined) => {
    if (stepIndex === undefined || stepIndex < 0 || stepIndex >= steps.length) return;
    const stepId = steps[stepIndex].id;
    setActiveTab("editor");
    toggleStepExpanded(stepId);
    setAuditResult(null);
    setFixChanges(null);
    setFixChecklist(null);
    setFixWarning(null);
  }, [steps, setActiveTab, toggleStepExpanded, setAuditResult]);

  const handleFix = useCallback(async () => {
    if (!auditResult) return;
    setFixing(true);
    setFixChanges(null);
    setFixChecklist(null);
    setFixWarning(null);

    // Snapshot previous issues for checklist comparison
    const previousIssues = [
      ...auditResult.issues.map((i) => i.message),
      ...auditResult.suggestions.map((s) => s.message),
    ];

    try {
      const result = await fixWorkflow(
        { name, description, trigger, steps },
        auditResult.issues,
        auditResult.suggestions,
        auditResult.score // Pass original score for regression guard
      );

      // Check for regression warning
      if (result.warning) {
        setFixWarning(result.warning);
        setFixing(false);
        setAuditing(false);
        return;
      }

      // Apply the fixed workflow to the editor
      replaceAllFromJson({
        name: result.name,
        description: result.description,
        trigger: result.trigger as ReturnType<typeof useWorkflowEditorStore.getState>["trigger"],
        steps: result.steps as ReturnType<typeof useWorkflowEditorStore.getState>["steps"],
      });

      // Auto-save to DB so fixes persist
      if (original) {
        try {
          const saved = await updateWorkflow(original.id, {
            name: result.name,
            description: result.description,
            trigger: JSON.stringify(result.trigger),
            steps: JSON.stringify(result.steps),
          });
          markSaved(saved);
        } catch {
          // Save failed — changes are still in editor, user can save manually
        }
      }

      setFixChanges(result.changes);

      // Use inline audit if available (saves a round-trip), otherwise re-audit
      if (result.audit) {
        setAuditResult(result.audit);

        // Build checklist by comparing previous issues to new ones
        const newMessages = new Set([
          ...result.audit.issues.map((i) => i.message),
          ...result.audit.suggestions.map((s) => s.message),
        ]);
        const checklist = previousIssues.map((msg) => ({
          message: msg,
          fixed: !newMessages.has(msg),
        }));
        setFixChecklist(checklist);
      } else {
        // Fallback: re-audit the fixed workflow
        setAuditing(true);
        const newAudit = await auditWorkflow({
          name: result.name,
          description: result.description,
          trigger: result.trigger,
          steps: result.steps,
        });
        setAuditResult(newAudit);

        // Build checklist by comparing previous issues to new ones
        const newMessages = new Set([
          ...newAudit.issues.map((i) => i.message),
          ...newAudit.suggestions.map((s) => s.message),
        ]);
        const checklist = previousIssues.map((msg) => ({
          message: msg,
          fixed: !newMessages.has(msg),
        }));
        setFixChecklist(checklist);
      }
    } catch {
      setFixChanges(["Fix failed — try manually editing the issues"]);
    } finally {
      setFixing(false);
      setAuditing(false);
    }
  }, [auditResult, name, description, trigger, steps, replaceAllFromJson, setAuditing, setAuditResult, original, markSaved]);

  if (!auditResult && !auditing) return null;

  const hasFixableIssues =
    auditResult && (auditResult.issues.length > 0 || auditResult.suggestions.length > 0);

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
            <p className="mt-3 text-sm text-gray-400">
              {fixing ? "Fixing and re-auditing..." : "Analyzing workflow..."}
            </p>
          </div>
        )}

        {/* Results */}
        {auditResult && (
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Score */}
            <div className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-5">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold shrink-0",
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

            {/* Fix Warning (score regression prevented) */}
            {fixWarning && (
              <div className="border-b border-white/[0.06] px-6 py-3 bg-amber-500/[0.05]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-300">Fix could not improve workflow</p>
                    <p className="mt-0.5 text-xs text-gray-400">{fixWarning}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fix Checklist (shown after a fix was applied) */}
            {fixChecklist && fixChecklist.length > 0 && (
              <div className="border-b border-white/[0.06] px-6 py-3 bg-emerald-500/[0.03]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    Fix results — {fixChecklist.filter((c) => c.fixed).length}/{fixChecklist.length} resolved
                  </span>
                </div>
                <ul className="space-y-1">
                  {fixChecklist.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs pl-2">
                      {item.fixed ? (
                        <Check className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                      )}
                      <span className={item.fixed ? "text-gray-500 line-through" : "text-gray-300"}>
                        {item.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fix Changes descriptions */}
            {fixChanges && fixChanges.length > 0 && !fixChecklist && (
              <div className="border-b border-white/[0.06] px-6 py-3 bg-emerald-500/[0.03]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Changes applied</span>
                </div>
                <ul className="space-y-1">
                  {fixChanges.map((change, i) => (
                    <li key={i} className="text-xs text-gray-400 pl-5">
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
        <div className="border-t border-white/[0.06] px-6 py-3 flex items-center justify-between">
          <div>
            {auditResult && hasFixableIssues && (
              <button
                onClick={handleFix}
                disabled={fixing}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
              >
                {fixing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : fixChanges ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Wrench className="h-4 w-4" />
                )}
                {fixing ? "Fixing..." : fixChanges ? "Fix Again" : "Fix Issues"}
              </button>
            )}
          </div>
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
