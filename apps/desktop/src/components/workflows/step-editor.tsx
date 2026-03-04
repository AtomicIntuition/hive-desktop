import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { listServers, listServerTools } from "@/lib/runtime-client";
import type { ServerWithStatus } from "@/lib/runtime-client";
import type { WorkflowStep, McpTool } from "@hive-desktop/shared";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Plus,
  GripVertical,
} from "lucide-react";

// ── Type Config ──────────────────────────────────────────

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string; shortLabel: string }> = {
  mcp_call: { color: "text-violet-400", bg: "bg-violet-500/10", label: "MCP Call", shortLabel: "MCP" },
  condition: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Condition", shortLabel: "IF" },
  transform: { color: "text-cyan-400", bg: "bg-cyan-500/10", label: "Transform", shortLabel: "FX" },
  delay: { color: "text-gray-400", bg: "bg-gray-500/10", label: "Delay", shortLabel: "WAIT" },
  notify: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Notify", shortLabel: "MSG" },
};

// ── StepEditorPanel ─────────────────────────────────────

export function StepEditorPanel() {
  const { steps, addStep, reorderSteps, removeStep, expandedSteps, toggleStepExpanded, activeRun } =
    useWorkflowEditorStore();
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const handleAddStep = useCallback(
    (type: WorkflowStep["type"]) => {
      const defaults: Record<string, Partial<WorkflowStep>> = {
        mcp_call: { name: "New MCP Call", server: "", tool: "", arguments: {}, outputVar: "", onError: "stop" },
        condition: { name: "New Condition", condition: "", outputVar: "", onError: "stop" },
        transform: { name: "New Transform", condition: "", outputVar: "", onError: "stop" },
        delay: { name: "Wait", arguments: { seconds: 5 }, onError: "continue" },
        notify: { name: "Notification", arguments: { title: "", message: "" }, onError: "continue" },
      };

      const step: WorkflowStep = {
        id: `step-${crypto.randomUUID().slice(0, 8)}`,
        type,
        ...defaults[type],
        name: defaults[type]?.name ?? "New Step",
        onError: defaults[type]?.onError ?? "stop",
      };

      addStep(step);
      setAddMenuOpen(false);
    },
    [addStep]
  );

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const expanded = expandedSteps.has(step.id);
        const runStatus = activeRun?.stepStatuses.get(index)?.status;

        return (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            expanded={expanded}
            totalSteps={steps.length}
            runStatus={runStatus}
            onToggle={() => toggleStepExpanded(step.id)}
            onMoveUp={() => reorderSteps(index, index - 1)}
            onMoveDown={() => reorderSteps(index, index + 1)}
            onDelete={() => removeStep(step.id)}
          />
        );
      })}

      {/* Add Step Button */}
      <div className="relative">
        <button
          onClick={() => setAddMenuOpen(!addMenuOpen)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] py-3 text-sm text-gray-500 transition-colors hover:border-violet-500/30 hover:text-violet-300"
        >
          <Plus className="h-4 w-4" />
          Add Step
        </button>

        {addMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-white/[0.08] bg-gray-900 p-1 shadow-xl">
              {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => handleAddStep(type as WorkflowStep["type"])}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/[0.04]"
                >
                  <span className={cn("font-mono text-xs w-8", config.color)}>{config.shortLabel}</span>
                  {config.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── StepCard ─────────────────────────────────────────────

interface StepCardProps {
  step: WorkflowStep;
  index: number;
  expanded: boolean;
  totalSteps: number;
  runStatus?: "running" | "completed" | "failed";
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function StepCard({
  step,
  index,
  expanded,
  totalSteps,
  runStatus,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
}: StepCardProps) {
  const config = TYPE_CONFIG[step.type] ?? TYPE_CONFIG.mcp_call;

  const runBorder =
    runStatus === "running" ? "border-l-violet-500 animate-pulse" :
    runStatus === "completed" ? "border-l-emerald-500" :
    runStatus === "failed" ? "border-l-red-500" :
    "border-l-transparent";

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-gray-900/50 border-l-2 overflow-hidden",
        runBorder
      )}
    >
      {/* Collapsed header */}
      <div
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-[10px] font-mono text-gray-400 shrink-0">
          {index + 1}
        </div>

        <span className={cn("font-mono text-[10px] rounded px-1.5 py-0.5 shrink-0", config.bg, config.color)}>
          {config.shortLabel}
        </span>

        <span className="flex-1 truncate text-sm font-medium text-gray-200">{step.name}</span>

        {step.outputVar && (
          <span className="hidden sm:inline text-xs text-gray-500 shrink-0">
            → {step.outputVar}
          </span>
        )}

        {step.type === "mcp_call" && step.server && step.tool && (
          <span className="hidden md:inline text-[10px] font-mono text-gray-600 shrink-0">
            {step.server}/{step.tool}
          </span>
        )}

        {step.onError === "retry" && step.retryCount && (
          <span className="hidden sm:inline text-[10px] text-gray-600 shrink-0">retry({step.retryCount})</span>
        )}

        {/* Reorder / delete buttons — min 44px touch targets on mobile */}
        <div className="flex items-center gap-0 sm:gap-0.5 ml-0.5 sm:ml-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded p-2 sm:p-1 text-gray-600 hover:text-gray-300 disabled:opacity-20"
            title="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="rounded p-2 sm:p-1 text-gray-600 hover:text-gray-300 disabled:opacity-20"
            title="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-2 sm:p-1 text-gray-600 hover:text-red-400"
            title="Delete step"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <ChevronRight className={cn("h-4 w-4 text-gray-600 transition-transform shrink-0", expanded && "rotate-90")} />
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-white/[0.04] p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Name field (common) */}
          <FieldRow label="Name">
            <input
              type="text"
              value={step.name}
              onChange={(e) => useWorkflowEditorStore.getState().updateStep(step.id, { name: e.target.value })}
              className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
            />
          </FieldRow>

          {/* Type-specific editor */}
          {step.type === "mcp_call" && <McpCallEditor step={step} />}
          {step.type === "condition" && <ConditionEditor step={step} />}
          {step.type === "transform" && <TransformEditor step={step} />}
          {step.type === "delay" && <DelayEditor step={step} />}
          {step.type === "notify" && <NotifyEditor step={step} />}

          {/* Output Variable (common except delay) */}
          {step.type !== "delay" && (
            <FieldRow label="Output Variable">
              <input
                type="text"
                value={step.outputVar ?? ""}
                onChange={(e) => useWorkflowEditorStore.getState().updateStep(step.id, { outputVar: e.target.value || undefined })}
                placeholder="e.g., searchResults"
                className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder-gray-600"
              />
            </FieldRow>
          )}

          {/* Error handling (common) */}
          <FieldRow label="On Error">
            <div className="flex items-center gap-2">
              <select
                value={step.onError}
                onChange={(e) => {
                  const onError = e.target.value as WorkflowStep["onError"];
                  const updates: Partial<WorkflowStep> = { onError };
                  if (onError === "retry" && !step.retryCount) {
                    updates.retryCount = 3;
                    updates.retryDelay = 3000;
                  }
                  useWorkflowEditorStore.getState().updateStep(step.id, updates);
                }}
                className="rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
              >
                <option value="stop">Stop workflow</option>
                <option value="continue">Continue</option>
                <option value="retry">Retry</option>
              </select>

              {step.onError === "retry" && (
                <>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={step.retryCount ?? 3}
                    onChange={(e) =>
                      useWorkflowEditorStore.getState().updateStep(step.id, {
                        retryCount: parseInt(e.target.value, 10) || 3,
                      })
                    }
                    className="w-16 rounded-lg border border-white/[0.06] bg-gray-800/50 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
                  />
                  <span className="text-xs text-gray-500">times, delay</span>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={step.retryDelay ?? 3000}
                    onChange={(e) =>
                      useWorkflowEditorStore.getState().updateStep(step.id, {
                        retryDelay: parseInt(e.target.value, 10) || 3000,
                      })
                    }
                    className="w-20 rounded-lg border border-white/[0.06] bg-gray-800/50 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
                  />
                  <span className="text-xs text-gray-500">ms</span>
                </>
              )}
            </div>
          </FieldRow>
        </div>
      )}
    </div>
  );
}

// ── MCP Call Editor ──────────────────────────────────────

function McpCallEditor({ step }: { step: WorkflowStep }) {
  const updateStep = useWorkflowEditorStore((s) => s.updateStep);
  const [servers, setServers] = useState<ServerWithStatus[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);

  // Load servers once
  useEffect(() => {
    listServers().then(setServers).catch(() => {});
  }, []);

  // Load tools when server changes
  useEffect(() => {
    if (!step.server) { setTools([]); return; }
    setLoadingTools(true);
    listServerTools(step.server)
      .then((res) => setTools(res.tools))
      .catch(() => setTools([]))
      .finally(() => setLoadingTools(false));
  }, [step.server]);

  // Get selected tool's schema
  const selectedTool = useMemo(
    () => tools.find((t) => t.name === step.tool),
    [tools, step.tool]
  );

  const inputSchema = selectedTool?.inputSchema as {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  } | undefined;

  return (
    <>
      <FieldRow label="Server">
        <select
          value={step.server ?? ""}
          onChange={(e) => updateStep(step.id, { server: e.target.value, tool: "", arguments: {} })}
          className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
        >
          <option value="">Select server...</option>
          {servers.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.slug})</option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="Tool">
        <select
          value={step.tool ?? ""}
          onChange={(e) => updateStep(step.id, { tool: e.target.value, arguments: {} })}
          disabled={!step.server || loadingTools}
          className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50 disabled:opacity-50"
        >
          <option value="">{loadingTools ? "Loading tools..." : "Select tool..."}</option>
          {tools.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        {selectedTool?.description && (
          <p className="mt-1 text-xs text-gray-500">{selectedTool.description}</p>
        )}
      </FieldRow>

      {/* Dynamic arguments from input schema */}
      {inputSchema?.properties && Object.keys(inputSchema.properties).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-400">Arguments</p>
          {Object.entries(inputSchema.properties).map(([key, prop]) => {
            const isRequired = inputSchema.required?.includes(key);
            const currentValue = (step.arguments as Record<string, unknown>)?.[key];

            return (
              <FieldRow
                key={key}
                label={
                  <span>
                    {key}
                    {isRequired && <span className="text-red-400 ml-0.5">*</span>}
                  </span>
                }
              >
                <ArgumentInput
                  propKey={key}
                  propType={prop.type}
                  description={prop.description}
                  value={currentValue}
                  onChange={(val) => {
                    const args = { ...(step.arguments ?? {}), [key]: val };
                    updateStep(step.id, { arguments: args });
                  }}
                />
              </FieldRow>
            );
          })}
        </div>
      )}

      {/* Manual arguments when no schema */}
      {(!inputSchema?.properties || Object.keys(inputSchema.properties).length === 0) && step.tool && (
        <FieldRow label="Arguments (JSON)">
          <textarea
            value={JSON.stringify(step.arguments ?? {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                updateStep(step.id, { arguments: parsed });
              } catch {
                // Allow typing invalid JSON while editing
              }
            }}
            rows={4}
            className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 font-mono text-sm text-gray-200 outline-none focus:border-violet-500/50 resize-none"
          />
        </FieldRow>
      )}
    </>
  );
}

// ── Argument Input ────────────────────────────────────────

function ArgumentInput({
  propKey,
  propType,
  description,
  value,
  onChange,
}: {
  propKey: string;
  propType?: string;
  description?: string;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  if (propType === "boolean") {
    return (
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800"
          />
          <span className="text-xs text-gray-400">{description ?? propKey}</span>
        </label>
      </div>
    );
  }

  if (propType === "number" || propType === "integer") {
    return (
      <div>
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          placeholder={description ?? propKey}
          className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder-gray-600"
        />
        {description && <p className="mt-1 text-xs text-gray-600">{description}</p>}
      </div>
    );
  }

  if (propType === "object" || propType === "array") {
    return (
      <div>
        <textarea
          value={typeof value === "string" ? value : JSON.stringify(value ?? (propType === "array" ? [] : {}), null, 2)}
          onChange={(e) => {
            try { onChange(JSON.parse(e.target.value)); } catch { /* allow invalid while typing */ }
          }}
          rows={3}
          placeholder={description ?? propKey}
          className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 font-mono text-sm text-gray-200 outline-none focus:border-violet-500/50 resize-none placeholder-gray-600"
        />
        {description && <p className="mt-1 text-xs text-gray-600">{description}</p>}
      </div>
    );
  }

  // Default: string
  return (
    <div>
      <input
        type="text"
        value={typeof value === "string" ? value : String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={description ?? propKey}
        className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder-gray-600"
      />
      {description && <p className="mt-1 text-xs text-gray-600">{description}</p>}
    </div>
  );
}

// ── Condition Editor ─────────────────────────────────────

function ConditionEditor({ step }: { step: WorkflowStep }) {
  const updateStep = useWorkflowEditorStore((s) => s.updateStep);

  return (
    <FieldRow label="Expression">
      <textarea
        value={step.condition ?? ""}
        onChange={(e) => updateStep(step.id, { condition: e.target.value })}
        rows={3}
        placeholder="e.g., payments.length > 0"
        className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 font-mono text-sm text-gray-200 outline-none focus:border-violet-500/50 resize-none placeholder-gray-600"
      />
      <p className="mt-1 text-xs text-gray-600">
        JavaScript expression. Use variable names directly. Returns false → skip remaining steps.
      </p>
    </FieldRow>
  );
}

// ── Transform Editor ─────────────────────────────────────

function TransformEditor({ step }: { step: WorkflowStep }) {
  const updateStep = useWorkflowEditorStore((s) => s.updateStep);

  return (
    <FieldRow label="Expression">
      <textarea
        value={step.condition ?? ""}
        onChange={(e) => updateStep(step.id, { condition: e.target.value })}
        rows={3}
        placeholder='e.g., results.map(r => r.title).join(", ")'
        className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 font-mono text-sm text-gray-200 outline-none focus:border-violet-500/50 resize-none placeholder-gray-600"
      />
      <p className="mt-1 text-xs text-gray-600">
        JavaScript expression. Use variable names directly. Result is stored in output variable.
      </p>
    </FieldRow>
  );
}

// ── Delay Editor ─────────────────────────────────────────

function DelayEditor({ step }: { step: WorkflowStep }) {
  const updateStep = useWorkflowEditorStore((s) => s.updateStep);
  const seconds = (step.arguments as Record<string, unknown>)?.seconds;

  return (
    <FieldRow label="Seconds">
      <input
        type="number"
        min={1}
        value={typeof seconds === "number" ? seconds : 1}
        onChange={(e) =>
          updateStep(step.id, { arguments: { seconds: parseInt(e.target.value, 10) || 1 } })
        }
        className="w-32 rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50"
      />
    </FieldRow>
  );
}

// ── Notify Editor ────────────────────────────────────────

function NotifyEditor({ step }: { step: WorkflowStep }) {
  const updateStep = useWorkflowEditorStore((s) => s.updateStep);
  const args = (step.arguments ?? {}) as Record<string, unknown>;

  return (
    <>
      <FieldRow label="Title">
        <input
          type="text"
          value={(args.title as string) ?? ""}
          onChange={(e) =>
            updateStep(step.id, { arguments: { ...args, title: e.target.value } })
          }
          placeholder="Notification title"
          className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-violet-500/50 placeholder-gray-600"
        />
      </FieldRow>
      <FieldRow label="Message">
        <textarea
          value={(args.message as string) ?? ""}
          onChange={(e) =>
            updateStep(step.id, { arguments: { ...args, message: e.target.value } })
          }
          rows={2}
          placeholder="Use {{variableName}} to include data from previous steps"
          className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500/50 resize-none placeholder-gray-600"
        />
        <p className="mt-1 text-xs text-gray-600">
          Use {"{{varName}}"} to include data from previous steps.
        </p>
      </FieldRow>
    </>
  );
}

// ── Shared ────────────────────────────────────────────────

function FieldRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-start">
      <label className="text-xs font-medium text-gray-400 pt-2">{label}</label>
      <div>{children}</div>
    </div>
  );
}
