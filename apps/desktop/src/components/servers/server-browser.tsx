import { useState, useEffect, useCallback } from "react";
import { Search, Download, Star, ExternalLink, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketTool } from "@hive-desktop/shared";
import { HIVE_MARKET_URL } from "@/lib/constants";
import { installServer } from "@/lib/runtime-client";
import { useAppStore } from "@/stores/app-store";

interface ServerBrowserProps {
  onInstalled?: () => void;
  installedSlugs?: Set<string>;
}

export function ServerBrowser({ onInstalled, installedSlugs = new Set() }: ServerBrowserProps) {
  const [tools, setTools] = useState<MarketTool[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const runtimeConnected = useAppStore((s) => s.runtimeConnected);

  const searchTools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      params.set("limit", "24");

      let res: Response;
      try {
        res = await fetch(`http://127.0.0.1:45678/api/market/tools?${params}`);
      } catch {
        res = await fetch(`${HIVE_MARKET_URL}/api/tools?${params}`);
      }

      if (res.ok) {
        const data = await res.json();
        setTools(data.tools ?? data ?? []);
      }
    } catch (err) {
      console.error("Failed to search tools:", err);
    } finally {
      setLoading(false);
    }
  }, [query, category]);

  useEffect(() => {
    searchTools();
  }, [searchTools]);

  const categories = [
    { slug: "", label: "All" },
    { slug: "devtools", label: "Dev Tools" },
    { slug: "data", label: "Data" },
    { slug: "communication", label: "Communication" },
    { slug: "productivity", label: "Productivity" },
    { slug: "ai-ml", label: "AI/ML" },
    { slug: "payments", label: "Payments" },
    { slug: "content", label: "Content" },
    { slug: "analytics", label: "Analytics" },
  ];

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search MCP servers on Hive Market..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-gray-900/50 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setCategory(cat.slug)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              category === cat.slug
                ? "bg-violet-500/20 text-violet-300"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : tools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
          <p className="text-gray-400">No tools found</p>
          <p className="mt-1 text-sm text-gray-500">Try a different search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <MarketToolCard
              key={tool.slug}
              tool={tool}
              installed={installedSlugs.has(tool.slug)}
              runtimeConnected={runtimeConnected}
              onInstalled={onInstalled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketToolCard({
  tool,
  installed,
  runtimeConnected,
  onInstalled,
}: {
  tool: MarketTool;
  installed: boolean;
  runtimeConnected: boolean;
  onInstalled?: () => void;
}) {
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  const handleInstall = async () => {
    if (!tool.npmPackage || !runtimeConnected) return;
    setInstalling(true);
    try {
      await installServer({
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        npmPackage: tool.npmPackage,
        installCommand: tool.installCommand ?? "npx",
        envVars: tool.envVars,
      });
      setJustInstalled(true);
      onInstalled?.();
    } catch (err) {
      console.error("Install failed:", err);
    } finally {
      setInstalling(false);
    }
  };

  const isInstalled = installed || justInstalled;

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-gray-900/50 p-4 transition-colors hover:border-white/[0.1]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-100 truncate">{tool.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-gray-400">{tool.description}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tool.tags?.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-gray-800/50 px-2 py-0.5 text-xs text-gray-500">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3">
        <div className="flex items-center gap-3">
          {tool.rating !== undefined && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Star className="h-3 w-3 fill-current" />
              {tool.rating.toFixed(1)}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {tool.pricing?.model === "free" ? "Free" : tool.pricing?.model}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isInstalled ? (
            <span className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Installed
            </span>
          ) : tool.npmPackage ? (
            <button
              onClick={handleInstall}
              disabled={installing || !runtimeConnected}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {installing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Install
            </button>
          ) : (
            <span className="text-xs text-gray-600">No package</span>
          )}
          {tool.githubUrl && (
            <a
              href={tool.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-white/[0.06] hover:text-gray-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
