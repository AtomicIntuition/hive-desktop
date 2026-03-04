import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { ChevronDown, ChevronRight, ArrowRight, Variable } from "lucide-react";
import { analyzeDataFlow } from "./analyze-flow";

export function DataFlowPanel() {
  const steps = useWorkflowEditorStore((s) => s.steps);
  const [collapsed, setCollapsed] = useState(false);

  const variables = useMemo(() => analyzeDataFlow(steps), [steps]);

  if (steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm">
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
