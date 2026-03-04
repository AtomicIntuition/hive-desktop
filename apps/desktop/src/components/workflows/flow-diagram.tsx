/**
 * FlowDiagram — Pure React + SVG visual workflow flow diagram.
 * Shows steps as nodes connected by arrows with variable labels.
 */

import { useMemo } from "react";
import type { WorkflowStep, WorkflowRunStepDetail } from "@hive-desktop/shared";
import { analyzeDataFlow } from "./analyze-flow";

interface ActiveRun {
  runId: string;
  status: "running" | "completed" | "failed";
  stepStatuses: Map<number, WorkflowRunStepDetail>;
}

interface FlowDiagramProps {
  steps: WorkflowStep[];
  activeRun: ActiveRun | null;
  heldSteps: Set<string>;
  expandedSteps: Set<string>;
  onStepClick: (stepId: string) => void;
}

// ── Layout constants ──────────────────────────────────
const NODE_W = 260;
const NODE_H = 48;
const GAP = 40;
const PAD_X = 16;
const PAD_Y = 12;
const ARROW_SIZE = 6;

// Matches step-editor TYPE_CONFIG
const TYPE_COLORS: Record<string, { fill: string; text: string; label: string }> = {
  mcp_call:  { fill: "#7c3aed20", text: "#a78bfa", label: "MCP"  },
  condition: { fill: "#f59e0b20", text: "#fbbf24", label: "IF"   },
  transform: { fill: "#06b6d420", text: "#22d3ee", label: "FX"   },
  delay:     { fill: "#6b728020", text: "#9ca3af", label: "WAIT" },
  notify:    { fill: "#10b98120", text: "#34d399", label: "MSG"  },
};

type StepState = "running" | "completed" | "failed" | "held" | "default";

function getStepState(
  stepIndex: number,
  stepId: string,
  activeRun: ActiveRun | null,
  heldSteps: Set<string>
): StepState {
  if (heldSteps.has(stepId)) return "held";
  if (!activeRun) return "default";
  const detail = activeRun.stepStatuses.get(stepIndex);
  if (!detail) return "default";
  if (detail.status === "running") return "running";
  if (detail.status === "completed") return "completed";
  if (detail.status === "failed") return "failed";
  return "default";
}

const STATE_STYLES: Record<StepState, { stroke: string; glow: boolean; pulse: boolean }> = {
  running:   { stroke: "#8b5cf6", glow: true,  pulse: true  },
  completed: { stroke: "#10b981", glow: false, pulse: false },
  failed:    { stroke: "#ef4444", glow: false, pulse: false },
  held:      { stroke: "#f59e0b", glow: true,  pulse: false },
  default:   { stroke: "rgba(255,255,255,0.06)", glow: false, pulse: false },
};

export function FlowDiagram({ steps, activeRun, heldSteps, expandedSteps, onStepClick }: FlowDiagramProps) {
  // Build variable label map: connectorIndex -> variable names
  const varLabels = useMemo(() => {
    const vars = analyzeDataFlow(steps);
    const labels = new Map<string, string[]>();

    for (const v of vars) {
      for (const consumer of v.consumedBy) {
        // Label the connector between producer and consumer
        const key = `${v.producedBy.stepIndex}->${consumer.stepIndex}`;
        const existing = labels.get(key) ?? [];
        if (!existing.includes(v.name)) {
          existing.push(v.name);
        }
        labels.set(key, existing);
      }
    }

    return labels;
  }, [steps]);

  if (steps.length === 0) return null;

  const totalW = NODE_W + PAD_X * 2;
  const totalH = steps.length * NODE_H + (steps.length - 1) * GAP + PAD_Y * 2;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm overflow-hidden">
      <div className="px-4 py-3 text-sm font-medium text-gray-300 border-b border-white/[0.04]">
        Flow
      </div>
      <div className="overflow-x-auto">
        <svg
          width={totalW}
          height={totalH}
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="block mx-auto"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth={ARROW_SIZE}
              markerHeight={ARROW_SIZE}
              refX={ARROW_SIZE}
              refY={ARROW_SIZE / 2}
              orient="auto"
            >
              <polygon
                points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
                fill="rgba(255,255,255,0.15)"
              />
            </marker>
            {/* Glow filters */}
            <filter id="glow-violet" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor="#8b5cf6" floodOpacity="0.4" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor="#f59e0b" floodOpacity="0.3" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connectors */}
          {steps.map((_, i) => {
            if (i === steps.length - 1) return null;
            const y1 = PAD_Y + i * (NODE_H + GAP) + NODE_H;
            const y2 = PAD_Y + (i + 1) * (NODE_H + GAP);
            const cx = PAD_X + NODE_W / 2;

            // Check for variable labels on this connector
            const directLabel = varLabels.get(`${i}->${i + 1}`);

            return (
              <g key={`conn-${i}`}>
                <line
                  x1={cx}
                  y1={y1}
                  x2={cx}
                  y2={y2}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowhead)"
                />
                {directLabel && directLabel.length > 0 && (
                  <text
                    x={cx + NODE_W / 2 - 16}
                    y={y1 + (y2 - y1) / 2 + 3}
                    textAnchor="end"
                    className="fill-gray-500"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {directLabel.join(", ")}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {steps.map((step, i) => {
            const x = PAD_X;
            const y = PAD_Y + i * (NODE_H + GAP);
            const state = getStepState(i, step.id, activeRun, heldSteps);
            const style = STATE_STYLES[state];
            const typeConf = TYPE_COLORS[step.type] ?? TYPE_COLORS.notify;
            const isExpanded = expandedSteps.has(step.id);

            const filter =
              style.glow && style.pulse ? "url(#glow-violet)" :
              style.glow ? "url(#glow-amber)" :
              undefined;

            // Truncate name to fit
            const maxChars = 22;
            const displayName =
              step.name.length > maxChars ? step.name.slice(0, maxChars) + "..." : step.name;

            return (
              <g
                key={step.id}
                onClick={() => onStepClick(step.id)}
                style={{ cursor: "pointer" }}
                role="button"
                tabIndex={0}
              >
                {/* Node rect */}
                <rect
                  x={x}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={isExpanded ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.02)"}
                  stroke={style.stroke}
                  strokeWidth={state === "default" ? 1 : 1.5}
                  filter={filter}
                >
                  {style.pulse && (
                    <animate
                      attributeName="stroke-opacity"
                      values="1;0.4;1"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  )}
                </rect>

                {/* Type badge */}
                <rect
                  x={x + 8}
                  y={y + (NODE_H - 20) / 2}
                  width={32}
                  height={20}
                  rx={4}
                  fill={typeConf.fill}
                />
                <text
                  x={x + 24}
                  y={y + NODE_H / 2 + 4}
                  textAnchor="middle"
                  fill={typeConf.text}
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="monospace"
                >
                  {typeConf.label}
                </text>

                {/* Step name */}
                <text
                  x={x + 48}
                  y={y + NODE_H / 2 + 4}
                  fill="rgba(255,255,255,0.8)"
                  fontSize={12}
                  fontFamily="system-ui, sans-serif"
                >
                  {displayName}
                </text>

                {/* outputVar label (right side) */}
                {step.outputVar && (
                  <text
                    x={x + NODE_W - 8}
                    y={y + NODE_H / 2 + 3}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.25)"
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    → {step.outputVar}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
