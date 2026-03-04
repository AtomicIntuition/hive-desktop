import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ChevronRight,
  Download,
  Settings,
} from "lucide-react";
import {
  planWorkflowAI,
  confirmWorkflowPlan,
  getAiStatus,
  installServer,
  getMarketTool,
  type WorkflowPlan,
} from "@/lib/runtime-client";
import type { ServerEnvVar } from "@hive-desktop/shared";
import { useWorkflows } from "@/hooks/use-workflows";

interface WorkflowCreatorProps {
  onCreated?: (id: string) => void;
}

export function WorkflowCreator({ onCreated }: WorkflowCreatorProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<WorkflowPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const { refresh } = useWorkflows();

  useEffect(() => {
    getAiStatus()
      .then((s) => setAiConfigured(s.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  const examples = [
    "Watch my Stripe for payments over $500 and Slack me",
    "Auto-label new GitHub issues using AI",
    "Send me a daily digest of GitHub activity",
    "Alert Slack when a deployment fails",
  ];

  const handlePlan = async () => {
    if (!input.trim()) return;
    setPlanning(true);
    setError(null);
    setPlan(null);
    setConfirmed(false);

    try {
      const result = await planWorkflowAI(input);
      setPlan(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPlanning(false);
    }
  };

  const handleConfirm = async () => {
    if (!plan) return;
    setConfirming(true);
    try {
      const workflow = await confirmWorkflowPlan(plan);
      setConfirmed(true);
      refresh();

      // Navigate to editor if callback provided
      if (onCreated) {
        setTimeout(() => {
          onCreated(workflow.id);
          setPlan(null);
          setInput("");
          setConfirmed(false);
        }, 500);
      } else {
        setTimeout(() => {
          setPlan(null);
          setInput("");
          setConfirmed(false);
        }, 2000);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConfirming(false);
    }
  };

  const handleDiscard = () => {
    setPlan(null);
    setError(null);
    setConfirmed(false);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-400" />
        <h3 className="font-semibold text-gray-100">Create a Workflow</h3>
        {aiConfigured === false && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400">
            <Settings className="h-3 w-3" />
            API key needed — go to Settings
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-gray-400">
        Describe what you want to automate in plain English. AI will design the workflow for you.
      </p>

      {/* NL Input */}
      <div
        className={cn(
          "relative rounded-lg border transition-colors",
          focused
            ? "border-violet-500/50 ring-1 ring-violet-500/25"
            : "border-white/[0.06]"
        )}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handlePlan();
            }
          }}
          placeholder="e.g., Watch my Stripe and Slack me when a payment over $500 comes in"
          rows={3}
          disabled={planning}
          className="w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between border-t border-white/[0.04] px-3 py-2">
          <span className="text-xs text-gray-600">
            {input.trim() ? "Cmd+Enter to plan" : ""}
          </span>
          <button
            onClick={handlePlan}
            disabled={!input.trim() || planning || aiConfigured === false}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {planning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Planning...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Plan Workflow
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Plan Preview */}
      {plan && !confirmed && (
        <WorkflowPlanPreview
          plan={plan}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
          confirming={confirming}
        />
      )}

      {/* Confirmed */}
      {confirmed && (
        <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" />
            Workflow created! Find it in your workflows list.
          </div>
        </div>
      )}

      {/* Example prompts (only show when no plan) */}
      {!plan && !planning && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-gray-500">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="rounded-full border border-white/[0.06] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-violet-500/30 hover:text-violet-300"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plan Preview ─────────────────────────────────────────

interface PlanPreviewProps {
  plan: WorkflowPlan;
  onConfirm: () => void;
  onDiscard: () => void;
  confirming: boolean;
}

function WorkflowPlanPreview({ plan, onConfirm, onDiscard, confirming }: PlanPreviewProps) {
  const [installingServer, setInstallingServer] = useState<string | null>(null);
  const [installedServers, setInstalledServers] = useState<Set<string>>(
    new Set(plan.requiredServers.filter((s) => s.installed).map((s) => s.slug))
  );
  const [serverEnvVars, setServerEnvVars] = useState<Record<string, ServerEnvVar[]>>({});

  // Fetch env var requirements for all required servers
  useEffect(() => {
    const fetchEnvVars = async () => {
      const envMap: Record<string, ServerEnvVar[]> = {};
      for (const server of plan.requiredServers) {
        try {
          const tool = await getMarketTool(server.slug);
          if (tool.envVars && tool.envVars.length > 0) {
            envMap[server.slug] = tool.envVars;
          }
        } catch {
          // Tool not found in market — skip
        }
      }
      setServerEnvVars(envMap);
    };
    fetchEnvVars();
  }, [plan.requiredServers]);

  const missingServers = plan.requiredServers.filter(
    (s) => !s.installed && !installedServers.has(s.slug)
  );

  // Collect all env vars needed across all required servers
  const allRequiredEnvVars = plan.requiredServers.flatMap((s) =>
    (serverEnvVars[s.slug] ?? []).map((v) => ({ ...v, server: s.slug }))
  );

  const handleInstallServer = async (slug: string) => {
    setInstallingServer(slug);
    try {
      // Fetch full tool details from Hive Market for proper install
      let toolData: { name: string; npmPackage?: string; installCommand?: string; envVars?: ServerEnvVar[]; description?: string } | null = null;
      try {
        const tool = await getMarketTool(slug);
        toolData = tool;
      } catch {
        // Fallback if market fetch fails
      }

      await installServer({
        slug,
        name: toolData?.name ?? slug.replace(/-mcp$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " MCP",
        description: toolData?.description,
        npmPackage: toolData?.npmPackage ?? slug,
        installCommand: (toolData?.installCommand as "npx" | "uvx") ?? "npx",
        envVars: toolData?.envVars,
      });
      setInstalledServers((prev) => new Set(prev).add(slug));
    } catch (err) {
      console.error("Failed to install server:", err);
    } finally {
      setInstallingServer(null);
    }
  };

  const triggerLabel =
    plan.trigger && typeof plan.trigger === "object"
      ? formatTrigger(plan.trigger as Record<string, unknown>)
      : "Unknown";

  const stepTypes: Record<string, { color: string; label: string }> = {
    mcp_call: { color: "text-violet-400", label: "MCP" },
    condition: { color: "text-amber-400", label: "IF" },
    transform: { color: "text-cyan-400", label: "FX" },
    delay: { color: "text-gray-400", label: "WAIT" },
    notify: { color: "text-emerald-400", label: "MSG" },
  };

  return (
    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.03] overflow-hidden">
      {/* Header */}
      <div className="border-b border-violet-500/10 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-gray-100">{plan.name}</h4>
            <p className="mt-1 text-sm text-gray-400">{plan.description}</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={onDiscard}
              className="rounded-lg p-2 text-gray-500 hover:bg-white/[0.04] hover:text-gray-300"
              title="Discard"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-300">
            {triggerLabel}
          </span>
          <span>{(plan.steps as unknown[]).length} steps</span>
          <span>{plan.requiredServers.length} server(s)</span>
        </div>
      </div>

      {/* Missing Servers Warning */}
      {missingServers.length > 0 && (
        <div className="border-b border-violet-500/10 bg-amber-500/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm text-amber-400 mb-2">
            <Download className="h-4 w-4" />
            Missing MCP servers — install to run this workflow:
          </div>
          <div className="space-y-2">
            {missingServers.map((server) => (
              <div
                key={server.slug}
                className="flex items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2"
              >
                <span className="text-sm font-mono text-gray-300">{server.slug}</span>
                <button
                  onClick={() => handleInstallServer(server.slug)}
                  disabled={installingServer === server.slug}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
                >
                  {installingServer === server.slug ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Install
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required Environment Variables */}
      {allRequiredEnvVars.length > 0 && (
        <div className="border-b border-violet-500/10 bg-violet-500/[0.02] p-4">
          <div className="flex items-center gap-2 text-sm text-violet-300 mb-2">
            <Settings className="h-4 w-4" />
            Required API keys — add these in Vault before running:
          </div>
          <div className="space-y-1.5">
            {allRequiredEnvVars.map((v) => (
              <div
                key={`${v.server}-${v.name}`}
                className="flex items-center gap-2 rounded-lg bg-gray-900/50 px-3 py-2"
              >
                <code className="rounded bg-gray-800/50 px-1.5 py-0.5 font-mono text-xs text-amber-300">
                  {v.name}
                </code>
                <span className="flex-1 text-xs text-gray-500">{v.description}</span>
                <span className="text-[10px] text-gray-600 font-mono">{v.server}</span>
                {v.required && (
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                    required
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="p-4">
        <p className="mb-2 text-xs font-medium text-gray-400">Steps:</p>
        <div className="space-y-1.5">
          {(plan.steps as Array<Record<string, unknown>>).map((step, i) => {
            const typeConfig = stepTypes[step.type as string] ?? { color: "text-gray-400", label: "?" };
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-right text-xs text-gray-600">{i + 1}</span>
                <ChevronRight className="h-3 w-3 text-gray-700" />
                <span className={cn("font-mono text-[11px] w-8", typeConfig.color)}>
                  {typeConfig.label}
                </span>
                <span className="text-gray-300">{step.name as string}</span>
                {step.outputVar ? (
                  <span className="text-xs text-gray-600">→ {String(step.outputVar)}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Reasoning */}
      {plan.reasoning && (
        <div className="border-t border-violet-500/10 px-4 py-3">
          <p className="text-xs text-gray-500">
            <span className="text-violet-400">AI:</span> {plan.reasoning}
          </p>
        </div>
      )}

      {/* Editor hint */}
      <div className="border-t border-violet-500/10 px-4 py-3 bg-violet-500/[0.02]">
        <p className="text-xs text-gray-400">
          <span className="text-violet-300 font-medium">This is a starting point.</span>{" "}
          Press <span className="text-gray-300">Create Workflow</span> to open the full editor where you can customize steps, arguments, triggers, and error handling.
        </p>
      </div>

      {/* Actions */}
      <div className="border-t border-violet-500/10 p-4 flex items-center justify-end gap-2">
        <button
          onClick={onDiscard}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200"
        >
          Discard
        </button>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Create Workflow
        </button>
      </div>
    </div>
  );
}

function formatTrigger(trigger: Record<string, unknown>): string {
  switch (trigger.type) {
    case "schedule":
      return `Cron: ${trigger.cron}`;
    case "interval":
      return `Every ${trigger.seconds}s`;
    case "webhook":
      return `Webhook: ${trigger.path}`;
    case "manual":
      return "Manual";
    case "file_watch":
      return `Watch: ${trigger.path}`;
    default:
      return String(trigger.type);
  }
}
