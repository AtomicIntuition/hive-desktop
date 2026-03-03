import { useState, useEffect } from "react";
import { KeyRound, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import type { Credential } from "@hive-desktop/shared";
import { listCredentials, deleteCredential, storeCredential } from "@/lib/runtime-client";
import { useAppStore } from "@/stores/app-store";

export function VaultList() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);

  const refresh = async () => {
    if (!runtimeConnected) return;
    setLoading(true);
    try {
      const data = await listCredentials();
      setCredentials(data);
    } catch {
      // Runtime not available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [runtimeConnected]);

  const handleDelete = async (id: string) => {
    await deleteCredential(id);
    refresh();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Securely store API keys and credentials for your MCP servers. Values are encrypted at rest.
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          Add Credential
        </button>
      </div>

      {showForm && <CredentialForm onSave={() => { setShowForm(false); refresh(); }} />}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-gray-600" />
          <p className="mt-3 text-gray-400">No credentials stored</p>
          <p className="mt-1 text-sm text-gray-500">
            Add API keys for your MCP servers
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-gray-900/50 p-4"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">{cred.name}</p>
                  {cred.serverSlug && (
                    <p className="text-xs text-gray-500">{cred.serverSlug}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(cred.id)}
                className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialForm({ onSave }: { onSave: () => void }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [serverSlug, setServerSlug] = useState("");
  const [showValue, setShowValue] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return;
    await storeCredential({ name, value, serverSlug: serverSlug || undefined });
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-white/[0.06] bg-gray-900/50 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="STRIPE_API_KEY"
            className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Value</label>
          <div className="relative">
            <input
              type={showValue ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="sk_live_..."
              className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 pr-10 text-sm text-gray-200 outline-none focus:border-violet-500/50"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">Server (optional)</label>
          <input
            value={serverSlug}
            onChange={(e) => setServerSlug(e.target.value)}
            placeholder="stripe-mcp"
            className="w-full rounded-lg border border-white/[0.06] bg-gray-800/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-violet-500/50"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={!name || !value}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-30"
        >
          Save
        </button>
      </div>
    </form>
  );
}
