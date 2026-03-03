import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { Save, ExternalLink, Check, Trash2, Loader2 } from "lucide-react";
import { getAiStatus, setAiApiKey, removeAiApiKey } from "@/lib/runtime-client";

export function SettingsPage() {
  const { runtimeConnected, runtimePort } = useAppStore();
  const [anthropicKey, setAnthropicKey] = useState("");
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (runtimeConnected) {
      getAiStatus()
        .then((s) => setAiStatus({ configured: s.configured, model: s.model }))
        .catch(() => {});
    }
  }, [runtimeConnected]);

  const handleSave = async () => {
    if (!anthropicKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await setAiApiKey(anthropicKey);
      setSaved(true);
      setAnthropicKey("");
      setAiStatus((prev) => prev ? { ...prev, configured: true } : { configured: true, model: "claude-sonnet-4-20250514" });
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeAiApiKey();
      setAiStatus((prev) => prev ? { ...prev, configured: false } : null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Runtime */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Runtime
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200">Runtime Status</p>
              <p className="text-xs text-gray-500">Local server for MCP management</p>
            </div>
            <span className={`text-sm font-medium ${runtimeConnected ? "text-emerald-400" : "text-red-400"}`}>
              {runtimeConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200">Port</p>
              <p className="text-xs text-gray-500">Runtime server port</p>
            </div>
            <span className="font-mono text-sm text-gray-300">{runtimePort}</span>
          </div>
        </div>
      </section>

      {/* AI Provider */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          AI Provider
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-5 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200">Status</p>
              <p className="text-xs text-gray-500">
                {aiStatus?.configured
                  ? `Connected — model: ${aiStatus.model}`
                  : "Not configured — AI workflow planner requires an API key"}
              </p>
            </div>
            <span className={`text-sm font-medium ${aiStatus?.configured ? "text-emerald-400" : "text-amber-400"}`}>
              {aiStatus?.configured ? "Active" : "Not Set"}
            </span>
          </div>

          {/* Key Input */}
          <div>
            <label className="mb-1 block text-sm text-gray-200">Anthropic API Key</label>
            <p className="mb-2 text-xs text-gray-500">
              Required for the AI workflow planner. Get your key at{" "}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300"
              >
                console.anthropic.com
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={aiStatus?.configured ? "••••••••••••••••" : "sk-ant-..."}
              className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500/50"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-between">
            {aiStatus?.configured ? (
              <button
                onClick={handleRemove}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
                Remove key
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleSave}
              disabled={!anthropicKey.trim() || saving}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Saved!" : "Save Key"}
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          About
        </h2>
        <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Hive Desktop</span>
            <span className="text-sm text-gray-500">v0.1.0</span>
          </div>
          <p className="text-xs text-gray-500">
            Local AI Agent Workflow Runtime — powered by Hive Market
          </p>
        </div>
      </section>
    </div>
  );
}
