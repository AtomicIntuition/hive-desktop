import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { McpTool } from "@hive-desktop/shared";
import type { ServerWithStatus, LogEntry } from "@/lib/runtime-client";
import {
  getServer,
  getServerLogs,
  connectServer,
  listServerTools,
  callServerTool,
  startServer,
  stopServer,
} from "@/lib/runtime-client";
import {
  ArrowLeft,
  Power,
  Square,
  Plug,
  Terminal,
  Wrench,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";

interface ServerDetailProps {
  serverId: string;
  onBack: () => void;
}

export function ServerDetail({ serverId, onBack }: ServerDetailProps) {
  const [server, setServer] = useState<ServerWithStatus | null>(null);
  const [tab, setTab] = useState<"tools" | "logs">("tools");
  const [tools, setTools] = useState<McpTool[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getServer(serverId);
      setServer(s);
      const logData = await getServerLogs(serverId);
      setLogs(logData.logs);
    } catch {
      // Server may not exist
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleStart = async () => {
    setBusy(true);
    try {
      await startServer(serverId);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      await stopServer(serverId);
      setTools([]);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      const result = await connectServer(serverId);
      setTools(result.tools);
      await refresh();
    } catch (err) {
      console.error("Connect failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleDiscoverTools = async () => {
    try {
      const result = await listServerTools(serverId);
      setTools(result.tools);
    } catch (err) {
      console.error("Tool discovery failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="text-center py-24 text-gray-400">
        Server not found. <button onClick={onBack} className="text-violet-400 hover:underline">Go back</button>
      </div>
    );
  }

  const statusColor =
    server.status === "running" ? "text-emerald-400" :
    server.status === "error" ? "text-red-400" :
    server.status === "installing" ? "text-amber-400" :
    "text-gray-400";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.04] hover:text-gray-200">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-50">{server.name}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span className={cn("font-medium", statusColor)}>
              {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
            </span>
            {server.npmPackage && (
              <span className="font-mono text-gray-500">{server.npmPackage}</span>
            )}
            {server.pid && <span className="text-gray-500">PID {server.pid}</span>}
            {server.connected && (
              <span className="flex items-center gap-1 text-violet-400">
                <Plug className="h-3.5 w-3.5" /> Connected
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          ) : (
            <>
              {server.status === "stopped" && (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <Power className="h-4 w-4" /> Start
                </button>
              )}
              {server.status === "running" && !server.connected && (
                <button
                  onClick={handleConnect}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                >
                  <Plug className="h-4 w-4" /> Connect
                </button>
              )}
              {server.status === "running" && (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
              )}
              {server.status === "error" && (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  <Power className="h-4 w-4" /> Retry
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Description + env vars */}
      {(server.description || server.envVars?.length) && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm p-5">
          {server.description && <p className="text-sm text-gray-300">{server.description}</p>}
          {server.envVars && server.envVars.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-400 mb-2">Required Environment Variables:</p>
              <div className="space-y-1">
                {server.envVars.map((v) => (
                  <div key={v.name} className="flex items-center gap-2 text-xs">
                    <code className="rounded bg-gray-800/50 px-1.5 py-0.5 font-mono text-amber-300">{v.name}</code>
                    <span className="text-gray-500">{v.description}</span>
                    {v.required && <span className="text-red-400">required</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-900/60 backdrop-blur-sm p-1 border border-white/[0.06] w-fit">
        <button
          onClick={() => { setTab("tools"); if (server.connected) handleDiscoverTools(); }}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            tab === "tools" ? "bg-violet-500/15 text-violet-300" : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Wrench className="h-4 w-4" /> Tools {tools.length > 0 && `(${tools.length})`}
        </button>
        <button
          onClick={() => setTab("logs")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            tab === "logs" ? "bg-violet-500/15 text-violet-300" : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Terminal className="h-4 w-4" /> Logs {logs.length > 0 && `(${logs.length})`}
        </button>
      </div>

      {/* Content */}
      {tab === "tools" ? (
        <ToolExplorer serverId={serverId} tools={tools} connected={!!server.connected} />
      ) : (
        <LogViewer logs={logs} />
      )}
    </div>
  );
}

// ── Tool Explorer ───────────────────────────────────────

function ToolExplorer({ serverId, tools, connected }: { serverId: string; tools: McpTool[]; connected: boolean }) {
  if (!connected) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
        <Wrench className="mx-auto h-8 w-8 text-gray-600" />
        <p className="mt-3 text-gray-400">Connect to the server to discover its tools</p>
        <p className="mt-1 text-sm text-gray-500">Start the server, then click Connect</p>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
        <p className="text-gray-400">No tools found on this server</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <ToolCard key={tool.name} serverId={serverId} tool={tool} />
      ))}
    </div>
  );
}

function ToolCard({ serverId, tool }: { serverId: string; tool: McpTool }) {
  const [expanded, setExpanded] = useState(false);
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCall = async () => {
    setRunning(true);
    setResult(null);
    try {
      const parsed = JSON.parse(args);
      const res = await callServerTool(serverId, tool.name, parsed);
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setResult(`Error: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const schema = tool.inputSchema as Record<string, unknown>;
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required ?? []) as string[];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
        <div className="flex-1">
          <span className="font-mono text-sm font-medium text-violet-300">{tool.name}</span>
          {tool.description && (
            <p className="mt-0.5 text-sm text-gray-400">{tool.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-600">{Object.keys(properties).length} params</span>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] p-4">
          {/* Schema info */}
          {Object.keys(properties).length > 0 && (
            <div className="mb-4 space-y-1.5">
              <p className="text-xs font-medium text-gray-400">Parameters:</p>
              {Object.entries(properties).map(([name, prop]) => (
                <div key={name} className="flex items-baseline gap-2 text-xs">
                  <code className="rounded bg-gray-800/50 px-1.5 py-0.5 font-mono text-amber-300">{name}</code>
                  <span className="text-gray-500">{String(prop.type ?? "any")}</span>
                  {prop.description ? <span className="text-gray-600">— {String(prop.description)}</span> : null}
                  {required.includes(name) && <span className="text-red-400">*</span>}
                </div>
              ))}
            </div>
          )}

          {/* Try it */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Arguments (JSON)</label>
              <textarea
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                rows={3}
                spellCheck={false}
                className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 font-mono text-xs text-gray-200 outline-none focus:border-violet-500/50"
              />
            </div>
            <button
              onClick={handleCall}
              disabled={running}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Call Tool
            </button>

            {result && (
              <div className="relative">
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-2 rounded p-1 text-gray-500 hover:text-gray-300"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="max-h-64 overflow-auto rounded-lg border border-white/[0.06] bg-gray-950 p-3 font-mono text-xs text-gray-300">
                  {result}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Log Viewer ──────────────────────────────────────────

function LogViewer({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
        <Terminal className="mx-auto h-8 w-8 text-gray-600" />
        <p className="mt-3 text-gray-400">No logs yet</p>
        <p className="mt-1 text-sm text-gray-500">Start the server to see logs</p>
      </div>
    );
  }

  const levelColors = {
    info: "text-gray-400",
    warn: "text-amber-400",
    error: "text-red-400",
    debug: "text-gray-600",
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-950 p-1">
      <div className="max-h-96 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="shrink-0 text-gray-600">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={cn("shrink-0 w-12 text-right", levelColors[log.level])}>
              [{log.level}]
            </span>
            <span className="text-gray-300 break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
