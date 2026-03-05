"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Send,
  Square,
  Wrench,
  Eye,
  Server,
  Zap,
  MessageSquare,
} from "lucide-react";
import type { AgentPlanEvent, WorkflowStep } from "@hive-desktop/shared";
import { useAgentPlannerStore } from "@/stores/agent-planner-store";
import { agentPlanWorkflow, confirmWorkflowPlan } from "@/lib/runtime-client";

const TOOL_ICONS: Record<string, typeof Wrench> = {
  list_installed_servers: Server,
  get_server_tools: Wrench,
  test_tool_call: Zap,
  validate_expression: Eye,
  add_workflow_step: CheckCircle,
  finalize_workflow: Sparkles,
};

const TOOL_LABELS: Record<string, string> = {
  list_installed_servers: "Discovering servers",
  get_server_tools: "Reading tool schemas",
  test_tool_call: "Testing tool call",
  validate_expression: "Validating expression",
  add_workflow_step: "Adding step",
  finalize_workflow: "Finalizing workflow",
};

interface AgentPlannerProps {
  initialPrompt?: string;
  onWorkflowCreated: (workflowId: string) => void;
  onClose: () => void;
}

export function AgentPlanner({ initialPrompt, onWorkflowCreated, onClose }: AgentPlannerProps) {
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [confirming, setConfirming] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const {
    planning,
    events,
    builtSteps,
    currentIteration,
    error,
    result,
    startPlanning,
    addEvent,
    setResult,
    setError,
    finish,
    cancel,
    reset,
  } = useAgentPlannerStore();

  // Auto-start if initial prompt provided
  useEffect(() => {
    if (initialPrompt?.trim() && !autoStarted && !planning) {
      setAutoStarted(true);
      handleStart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const handleStart = useCallback(async () => {
    if (!prompt.trim() || planning) return;

    startPlanning();
    const store = useAgentPlannerStore.getState();

    try {
      const planResult = await agentPlanWorkflow(
        prompt,
        (event: AgentPlanEvent) => {
          addEvent(event);
        },
        store.abortController?.signal
      );

      if (planResult) {
        setResult(planResult);
      } else {
        finish();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    }
  }, [prompt, planning, startPlanning, addEvent, setResult, setError, finish]);

  const handleConfirm = useCallback(async () => {
    if (!result) return;
    setConfirming(true);

    try {
      const workflow = await confirmWorkflowPlan({
        name: result.name,
        description: result.description,
        trigger: result.trigger,
        steps: result.steps,
        requiredServers: [],
        reasoning: result.reasoning,
        qualityScore: 100,
        auditSummary: "Agent-verified workflow",
        iterationsUsed: result.iterations,
      });

      onWorkflowCreated(workflow.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }, [result, onWorkflowCreated, setError]);

  const hasActivity = events.length > 0 || planning;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-violet-500/15">
          <Bot className="h-4 w-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white">Agent Workflow Builder</h3>
          <p className="text-[11px] text-gray-500">
            Discovers tools, tests calls, verifies data flow
          </p>
        </div>
        {planning && (
          <div className="flex items-center gap-1.5 text-[11px] text-violet-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Iteration {currentIteration}
          </div>
        )}
      </div>

      {/* Prompt Input */}
      {!hasActivity && (
        <div className="p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="Describe the workflow you want to build..."
              className="flex-1 rounded-lg border border-white/[0.08] bg-gray-800/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-violet-500/50 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleStart}
              disabled={!prompt.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Build
            </button>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {hasActivity && (
        <div
          ref={feedRef}
          className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.03]"
        >
          {events.map((event, i) => (
            <EventRow key={i} event={event} />
          ))}

          {planning && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
              Agent is working...
            </div>
          )}
        </div>
      )}

      {/* Built Steps Preview */}
      {builtSteps.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
            Built Steps ({builtSteps.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {builtSteps.map((step, i) => (
              <StepBadge key={i} step={step} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Result / Actions */}
      {(result || planning || error) && (
        <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-2">
          {planning && (
            <button
              onClick={cancel}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/[0.15] transition-colors"
            >
              <Square className="h-3 w-3" />
              Cancel
            </button>
          )}

          {result && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{result.name}</p>
                <p className="text-[11px] text-gray-500">
                  {result.iterations} iterations · {result.toolCallCount} tool calls · {builtSteps.length} steps
                </p>
              </div>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {confirming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Confirm & Create
              </button>
            </>
          )}

          {!planning && (
            <button
              onClick={() => {
                reset();
                setPrompt("");
              }}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/[0.15] transition-colors ml-auto"
            >
              Start Over
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Event Row ──────────────────────────────────────────

function EventRow({ event }: { event: AgentPlanEvent }) {
  const [expanded, setExpanded] = useState(false);

  if (event.type === "agent:thinking") {
    const text = event.data.text as string;
    if (!text.trim()) return null;
    return (
      <div className="px-4 py-2.5 flex items-start gap-2.5">
        <MessageSquare className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
        <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
      </div>
    );
  }

  if (event.type === "agent:tool_call") {
    const tool = event.data.tool as string;
    const input = event.data.input as Record<string, unknown>;
    const Icon = TOOL_ICONS[tool] ?? Wrench;
    const label = TOOL_LABELS[tool] ?? tool;

    return (
      <div className="px-4 py-2.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2.5 w-full text-left group"
        >
          <Icon className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span className="text-sm text-gray-200 flex-1">{label}</span>
          {input && Object.keys(input).length > 0 && (
            <>
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-gray-600" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-600" />
              )}
            </>
          )}
        </button>
        {expanded && input && Object.keys(input).length > 0 && (
          <pre className="mt-2 ml-6 text-[11px] text-gray-500 bg-gray-800/50 rounded-lg p-2 overflow-x-auto max-h-[150px] overflow-y-auto">
            {JSON.stringify(input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (event.type === "agent:tool_result") {
    const tool = event.data.tool as string;
    const result = event.data.result as Record<string, unknown>;
    const success = result?.success !== false && !result?.error;

    return (
      <div className="px-4 py-2 pl-10">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left"
        >
          {success ? (
            <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="h-3 w-3 text-red-400 shrink-0" />
          )}
          <span className="text-[11px] text-gray-500 flex-1">
            {success ? getResultSummary(tool, result) : (result?.error as string) ?? "Failed"}
          </span>
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-gray-600" />
          ) : (
            <ChevronRight className="h-3 w-3 text-gray-600" />
          )}
        </button>
        {expanded && (
          <pre className="mt-1.5 text-[11px] text-gray-500 bg-gray-800/50 rounded-lg p-2 overflow-x-auto max-h-[200px] overflow-y-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (event.type === "agent:step_added") {
    const step = event.data.step as WorkflowStep;
    return (
      <div className="px-4 py-2.5 flex items-center gap-2.5">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="text-sm text-emerald-300">
          Added step: {step.name}
        </span>
        <span className="text-[11px] text-gray-600">({step.type})</span>
      </div>
    );
  }

  if (event.type === "agent:complete") {
    return (
      <div className="px-4 py-2.5 flex items-center gap-2.5 bg-emerald-500/5">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span className="text-sm text-emerald-300 font-medium">
          Workflow built successfully
        </span>
      </div>
    );
  }

  return null;
}

function getResultSummary(tool: string, result: Record<string, unknown>): string {
  switch (tool) {
    case "list_installed_servers":
      return `Found ${result.count ?? 0} installed servers`;
    case "get_server_tools":
      return `${result.toolCount ?? 0} tools available`;
    case "test_tool_call":
      return `Output: ${result.outputType ?? "unknown"} (${result.rawLength ?? 0} chars)`;
    case "validate_expression":
      return `Result: ${result.resultType ?? "unknown"}`;
    case "add_workflow_step":
      return result.message as string ?? "Step added";
    case "finalize_workflow":
      return result.message as string ?? "Finalized";
    default:
      return "Done";
  }
}

// ── Step Badge ─────────────────────────────────────────

const STEP_TYPE_COLORS: Record<string, string> = {
  mcp_call: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  condition: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  transform: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  delay: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  notify: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

function StepBadge({ step, index }: { step: WorkflowStep; index: number }) {
  const colors = STEP_TYPE_COLORS[step.type] ?? STEP_TYPE_COLORS.transform;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${colors}`}
    >
      <span className="font-mono opacity-50">{index + 1}</span>
      <span className="truncate max-w-[120px]">{step.name}</span>
    </div>
  );
}
