/**
 * Shared data flow analysis utilities.
 * Used by both DataFlowPanel and FlowDiagram.
 */

import type { WorkflowStep } from "@hive-desktop/shared";

export interface VarInfo {
  name: string;
  producedBy: { stepIndex: number; stepName: string };
  consumedBy: Array<{ stepIndex: number; stepName: string; field: string }>;
}

export function analyzeDataFlow(steps: WorkflowStep[]): VarInfo[] {
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

export function findVarReferences(step: WorkflowStep): Array<{ varName: string; field: string }> {
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
  }

  return refs;
}
