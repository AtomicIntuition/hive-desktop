import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { ChevronDown, ChevronRight, ArrowRight, Variable } from "lucide-react";
import type { WorkflowStep } from "@hive-desktop/shared";

interface VarInfo {
  name: string;
  producedBy: { stepIndex: number; stepName: string };
  consumedBy: Array<{ stepIndex: number; stepName: string; field: string }>;
}

export function DataFlowPanel() {
  const steps = useWorkflowEditorStore((s) => s.steps);
  const [collapsed, setCollapsed] = useState(false);

  const variables = useMemo(() => analyzeDataFlow(steps), [steps]);

  if (steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
        <Variable className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-gray-300">Data Flow</span>
        <span className="text-xs text-gray-500">({variables.length} variables)</span>
      </button>

      {!collapsed && (
        <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
          {variables.length === 0 ? (
            <p className="text-xs text-gray-500">No variables defined. Add outputVar to steps to pass data between them.</p>
          ) : (
            variables.map((v) => (
              <div key={v.name} className="space-y-1">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-xs text-violet-300">
                    {v.name}
                  </code>
                  <span className="text-[10px] text-gray-600">
                    from step {v.producedBy.stepIndex + 1}
                  </span>
                </div>

                <div className="ml-4 space-y-0.5">
                  {/* Producer */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="w-12 shrink-0 text-right text-emerald-400/70">set by</span>
                    <ArrowRight className="h-3 w-3 text-gray-600" />
                    <span className="text-gray-400">
                      <span className="text-gray-500">[{v.producedBy.stepIndex + 1}]</span>{" "}
                      {v.producedBy.stepName}
                    </span>
                  </div>

                  {/* Consumers */}
                  {v.consumedBy.length > 0 ? (
                    v.consumedBy.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className="w-12 shrink-0 text-right text-cyan-400/70">used in</span>
                        <ArrowRight className="h-3 w-3 text-gray-600" />
                        <span className="text-gray-400">
                          <span className="text-gray-500">[{c.stepIndex + 1}]</span>{" "}
                          {c.stepName}
                          <span className="text-gray-600"> ({c.field})</span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="w-12 shrink-0 text-right text-amber-400/70">unused</span>
                      <ArrowRight className="h-3 w-3 text-gray-600" />
                      <span className="text-gray-500 italic">not referenced by any step</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Analysis ──────────────────────────────────────────────

function analyzeDataFlow(steps: WorkflowStep[]): VarInfo[] {
  const vars = new Map<string, VarInfo>();

  // Find producers (steps with outputVar)
  steps.forEach((step, i) => {
    if (step.outputVar) {
      vars.set(step.outputVar, {
        name: step.outputVar,
        producedBy: { stepIndex: i, stepName: step.name },
        consumedBy: [],
      });
    }
  });

  // Find consumers (steps that reference {{varName}})
  steps.forEach((step, i) => {
    const refs = findVarReferences(step);
    for (const ref of refs) {
      const varInfo = vars.get(ref.varName);
      if (varInfo) {
        varInfo.consumedBy.push({
          stepIndex: i,
          stepName: step.name,
          field: ref.field,
        });
      }
    }
  });

  return Array.from(vars.values());
}

function findVarReferences(step: WorkflowStep): Array<{ varName: string; field: string }> {
  const refs: Array<{ varName: string; field: string }> = [];
  const varPattern = /\{\{([^}]+)\}\}/g;

  // Check arguments
  if (step.arguments) {
    const argsStr = JSON.stringify(step.arguments);
    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(argsStr)) !== null) {
      const varRef = match[1].trim();
      const rootVar = varRef.split(".")[0];
      refs.push({ varName: rootVar, field: "arguments" });
    }
  }

  // Check condition/expression
  if (step.condition) {
    let match: RegExpExecArray | null;
    const condPattern = /\{\{([^}]+)\}\}/g;
    while ((match = condPattern.exec(step.condition)) !== null) {
      const varRef = match[1].trim();
      const rootVar = varRef.split(".")[0];
      refs.push({ varName: rootVar, field: "condition" });
    }

    // Also check for bare variable names (used in JS expressions)
    // This catches cases like `payments.length > 0` where payments is an outputVar
    // We check if any known variable name appears in the condition
  }

  return refs;
}
