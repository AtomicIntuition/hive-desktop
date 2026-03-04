import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { useWebSocketEditor } from "@/hooks/use-websocket-editor";
import {
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
  auditWorkflow,
  getMarketTool,
  modifyWorkflow,
} from "@/lib/runtime-client";
import type { Workflow, WorkflowTrigger, ServerEnvVar } from "@hive-desktop/shared";
import { StepEditorPanel } from "./step-editor";
import { DataFlowPanel } from "./data-flow-panel";
import { JsonEditorTab } from "./json-editor";
import { RunsTab, LiveRunOverlay } from "./run-viewer";
import { AuditModal } from "./audit-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  Play,
  Shield,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  Key,
  Sparkles,
  Send,
} from "lucide-react";

interface WorkflowEditorProps {
  workflowId: string;
  onBack: () => void;
}

export function WorkflowEditor({ workflowId, onBack }: WorkflowEditorProps) {
  const store = useWorkflowEditorStore();
  const {
    original,
    name,
    description,
    trigger,
    steps,
    dirty,
    activeTab,
    saving,
    historyIndex,
    history,
    activeRun,
    auditing,
    auditResult,
    load,
    setName,
    setDescription,
    setTrigger,
    setActiveTab,
    setSaving,
    markSaved,
    setActiveRun,
    setAuditing,
    setAuditResult,
    reset,
    undo,
    redo,
  } = store;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [envVars, setEnvVars] = useState<Array<{ name: string; description: string; server: string; required: boolean }>>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModifying, setAiModifying] = useState(false);
  const [aiChanges, setAiChanges] = useState<string[] | null>(null);

  // WebSocket for live runs
  useWebSocketEditor();

  // Load workflow
  useEffect(() => {
    setLoading(true);
    getWorkflow(workflowId)
      .then((wf) => {
        load(wf);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });

    return () => { reset(); };
  }, [workflowId, load, reset]);

  // Fetch env var requirements for MCP servers used in steps
  const serverSlugs = useMemo(
    () => [...new Set(steps.filter((s) => s.type === "mcp_call" && s.server).map((s) => s.server!))],
    [steps]
  );

  useEffect(() => {
    if (serverSlugs.length === 0) { setEnvVars([]); return; }
    let cancelled = false;

    const fetchEnvVars = async () => {
      const vars: Array<{ name: string; description: string; server: string; required: boolean }> = [];
      for (const slug of serverSlugs) {
        try {
          const tool = await getMarketTool(slug);
          if (tool.envVars) {
            for (const v of tool.envVars) {
              vars.push({ name: v.name, description: v.description, server: slug, required: v.required });
            }
          }
        } catch {
          // Tool not found in market — skip
        }
      }
      if (!cancelled) setEnvVars(vars);
    };

    fetchEnvVars();
    return () => { cancelled = true; };
  }, [serverSlugs.join(",")]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (meta && e.shiftKey && e.key === "z") {
        e.preventDefault();
        redo();
      } else if (meta && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (meta && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Save
  const handleSave = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWorkflow(workflowId, {
        name,
        description,
        trigger: JSON.stringify(trigger),
        steps: JSON.stringify(steps),
      });
      markSaved(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }, [dirty, saving, workflowId, name, description, trigger, steps, setSaving, markSaved]);

  // Run
  const handleRun = useCallback(async () => {
    if (activeRun?.status === "running") return;

    // Save first if dirty
    if (dirty) {
      try {
        await updateWorkflow(workflowId, {
          name,
          description,
          trigger: JSON.stringify(trigger),
          steps: JSON.stringify(steps),
        });
      } catch {
        // Continue anyway
      }
    }

    try {
      const result = await runWorkflow(workflowId);
      setActiveRun(result.runId);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [activeRun, dirty, workflowId, name, description, trigger, steps, setActiveRun]);

  // Audit
  const handleAudit = useCallback(async () => {
    setAuditing(true);
    setAuditResult(null);
    try {
      const result = await auditWorkflow({ name, description, trigger, steps });
      setAuditResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAuditing(false);
    }
  }, [name, description, trigger, steps, setAuditing, setAuditResult]);

  // Delete
  const handleDelete = useCallback(async () => {
    try {
      await deleteWorkflow(workflowId);
      onBack();
    } catch (err) {
      setError((err as Error).message);
    }
    setDeleteConfirmOpen(false);
  }, [workflowId, onBack]);

  // AI Modify
  const handleAiModify = useCallback(async () => {
    if (!aiPrompt.trim() || aiModifying) return;
    setAiModifying(true);
    setAiChanges(null);
    setError(null);

    try {
      const result = await modifyWorkflow({ name, description, trigger, steps }, aiPrompt);
      store.replaceAllFromJson({
        name: result.name,
        description: result.description,
        trigger: result.trigger as typeof trigger,
        steps: result.steps as typeof steps,
      });
      setAiChanges(result.changes);
      setAiPrompt("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiModifying(false);
    }
  }, [aiPrompt, aiModifying, name, description, trigger, steps, store]);

  // Navigate away guard
  const handleBack = useCallback(() => {
    if (dirty) {
      setDiscardConfirmOpen(true);
    } else {
      onBack();
    }
  }, [dirty, onBack]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!original) {
    return (
      <div className="text-center py-24 text-gray-400">
        Workflow not found.{" "}
        <button onClick={onBack} className="text-violet-400 hover:underline">Go back</button>
      </div>
    );
  }

  const statusColor =
    original.status === "active" ? "text-emerald-400" :
    original.status === "paused" ? "text-amber-400" :
    original.status === "error" ? "text-red-400" :
    "text-gray-400";

  const triggerLabel = formatTriggerLabel(trigger);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2 sm:gap-3">
        <button
          onClick={handleBack}
          className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Inline-editable name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent text-lg sm:text-xl font-semibold text-gray-50 outline-none border-b border-transparent hover:border-white/[0.06] focus:border-violet-500/50 pb-0.5"
          />
          <div className="mt-1 flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
            <span className={cn("font-medium", statusColor)}>
              {original.status.charAt(0).toUpperCase() + original.status.slice(1)}
            </span>
            <span className="text-gray-500">{triggerLabel}</span>
            <span className="text-gray-500">{steps.length} steps</span>
            {dirty && (
              <span className="text-amber-400">Unsaved changes</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description..."
          rows={1}
          className="w-full resize-none bg-transparent text-sm text-gray-400 outline-none placeholder-gray-600 border-b border-transparent hover:border-white/[0.06] focus:border-violet-500/50"
        />
      </div>

      {/* Required env vars banner */}
      {envVars.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">Required API Keys</span>
            <span className="text-xs text-gray-500">Add these in Vault before running</span>
          </div>
          <div className="space-y-1.5">
            {envVars.map((v) => (
              <div key={`${v.server}-${v.name}`} className="flex items-center gap-2">
                <code className="rounded bg-gray-800/50 px-1.5 py-0.5 font-mono text-xs text-amber-300">{v.name}</code>
                <span className="flex-1 text-xs text-gray-500 truncate">{v.description}</span>
                <span className="text-[10px] text-gray-600 font-mono shrink-0">{v.server}</span>
                {v.required && (
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 shrink-0">required</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trigger editor */}
      <TriggerEditor trigger={trigger} onChange={setTrigger} />

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-1 flex-wrap overflow-x-auto -mx-1 px-1">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            dirty && !saving
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "text-gray-500 bg-gray-800/50"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveSuccess ? "Saved" : "Save"}
        </button>

        <button
          onClick={() => undo()}
          disabled={!canUndo}
          className="rounded-lg p-2 text-gray-500 hover:text-gray-300 disabled:opacity-20"
          title="Undo (Cmd+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          className="rounded-lg p-2 text-gray-500 hover:text-gray-300 disabled:opacity-20"
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="w-px h-5 bg-white/[0.06] mx-1" />

        <button
          onClick={handleRun}
          disabled={activeRun?.status === "running"}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {activeRun?.status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Run
        </button>

        <button
          onClick={handleAudit}
          disabled={auditing}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-2 text-sm font-medium text-gray-300 hover:border-violet-500/30 hover:text-violet-300 disabled:opacity-50"
        >
          {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
          AI Audit
        </button>

        <div className="w-px h-5 bg-white/[0.06] mx-1" />

        <button
          onClick={() => setDeleteConfirmOpen(true)}
          className="rounded-lg p-2 text-gray-500 hover:text-red-400"
          title="Delete workflow"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* AI Modify Prompt */}
      <div className="mb-4 rounded-xl border border-white/[0.06] bg-gray-900/50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiModify(); } }}
            placeholder="Ask AI to modify this workflow..."
            disabled={aiModifying}
            className="flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder-gray-600 disabled:opacity-50"
          />
          <button
            onClick={handleAiModify}
            disabled={!aiPrompt.trim() || aiModifying}
            className="rounded-lg p-1.5 text-gray-500 hover:text-violet-300 disabled:opacity-30 transition-colors"
          >
            {aiModifying ? <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {aiChanges && aiChanges.length > 0 && (
          <div className="border-t border-white/[0.04] px-3 py-2 bg-violet-500/[0.03]">
            <div className="flex items-center gap-1.5 mb-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Changes applied</span>
              <button onClick={() => setAiChanges(null)} className="ml-auto text-gray-600 hover:text-gray-400 text-xs">dismiss</button>
            </div>
            <ul className="space-y-0.5">
              {aiChanges.map((change, i) => (
                <li key={i} className="text-xs text-gray-400 pl-5">{change}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Live Run Overlay */}
      {activeRun && <div className="mb-4"><LiveRunOverlay /></div>}

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-900/50 p-1 border border-white/[0.06] w-full sm:w-fit">
        {(["editor", "runs", "json"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 sm:flex-initial rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-colors capitalize",
              activeTab === tab
                ? "bg-violet-500/15 text-violet-300"
                : "text-gray-400 hover:text-gray-300"
            )}
          >
            {tab === "editor" ? `Editor (${steps.length})` :
             tab === "runs" ? "Runs" :
             "JSON"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "editor" && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <StepEditorPanel />
          </div>
          <div className="lg:w-[320px] shrink-0">
            <DataFlowPanel />
          </div>
        </div>
      )}
      {activeTab === "runs" && <RunsTab />}
      {activeTab === "json" && <JsonEditorTab />}

      {/* Modals */}
      <AuditModal />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Workflow"
        message={`Are you sure you want to delete "${original.name}"? This action cannot be undone. All run history will be lost.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <ConfirmDialog
        open={discardConfirmOpen}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to discard them and go back?"
        confirmLabel="Discard"
        variant="warning"
        onConfirm={() => { setDiscardConfirmOpen(false); onBack(); }}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </div>
  );
}

// ── Trigger Editor ───────────────────────────────────────

function TriggerEditor({
  trigger,
  onChange,
}: {
  trigger: WorkflowTrigger;
  onChange: (t: WorkflowTrigger) => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-white/[0.06] bg-gray-900/50 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <label className="text-xs font-medium text-gray-400 sm:w-20 shrink-0">Trigger</label>
        <select
          value={trigger.type}
          onChange={(e) => {
            const type = e.target.value;
            switch (type) {
              case "manual":
                onChange({ type: "manual" });
                break;
              case "interval":
                onChange({ type: "interval", seconds: 300 });
                break;
              case "schedule":
                onChange({ type: "schedule", cron: "0 9 * * 1-5" });
                break;
              case "webhook":
                onChange({ type: "webhook", path: "/my-webhook" });
                break;
              case "file_watch":
                onChange({ type: "file_watch", path: "/tmp/watch", event: "create" });
                break;
            }
          }}
          className="w-full sm:w-auto rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 sm:py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
        >
          <option value="manual">Manual</option>
          <option value="interval">Interval</option>
          <option value="schedule">Cron Schedule</option>
          <option value="webhook">Webhook</option>
          <option value="file_watch">File Watch</option>
        </select>

        {/* Type-specific params */}
        {trigger.type === "interval" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Every</span>
            <input
              type="number"
              min={10}
              value={trigger.seconds}
              onChange={(e) => onChange({ ...trigger, seconds: parseInt(e.target.value, 10) || 60 })}
              className="w-20 rounded-lg border border-white/[0.06] bg-gray-800/50 px-2 py-2 sm:py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
            />
            <span className="text-xs text-gray-500">seconds</span>
          </div>
        )}

        {trigger.type === "schedule" && (
          <input
            type="text"
            value={trigger.cron}
            onChange={(e) => onChange({ ...trigger, cron: e.target.value })}
            placeholder="0 9 * * 1-5"
            className="w-full sm:flex-1 rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 sm:py-1.5 font-mono text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder-gray-600"
          />
        )}

        {trigger.type === "webhook" && (
          <input
            type="text"
            value={trigger.path}
            onChange={(e) => onChange({ ...trigger, path: e.target.value })}
            placeholder="/my-webhook"
            className="w-full sm:flex-1 rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 sm:py-1.5 font-mono text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder-gray-600"
          />
        )}

        {trigger.type === "file_watch" && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:flex-1">
            <input
              type="text"
              value={trigger.path}
              onChange={(e) => onChange({ ...trigger, path: e.target.value })}
              placeholder="/path/to/watch"
              className="w-full sm:flex-1 rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 sm:py-1.5 font-mono text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder-gray-600"
            />
            <select
              value={trigger.event}
              onChange={(e) =>
                onChange({ ...trigger, event: e.target.value as "create" | "modify" | "delete" })
              }
              className="rounded-lg border border-white/[0.06] bg-gray-800/50 px-2 py-2 sm:py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
            >
              <option value="create">Create</option>
              <option value="modify">Modify</option>
              <option value="delete">Delete</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function formatTriggerLabel(trigger: WorkflowTrigger): string {
  switch (trigger.type) {
    case "schedule": return `Cron: ${trigger.cron}`;
    case "interval": return `Every ${trigger.seconds}s`;
    case "webhook": return `Webhook: ${trigger.path}`;
    case "manual": return "Manual trigger";
    case "file_watch": return `Watch: ${trigger.path}`;
  }
}
