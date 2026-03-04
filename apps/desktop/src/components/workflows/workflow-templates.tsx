import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  listWorkflowTemplates,
  createWorkflowFromTemplate,
  type WorkflowTemplate,
} from "@/lib/runtime-client";
import {
  CreditCard,
  GitBranch,
  AlertTriangle,
  Newspaper,
  Rocket,
  UserPlus,
  Shield,
  FileText,
  Search,
  Database,
  Loader2,
  Plus,
  Check,
} from "lucide-react";

const templateIcons: Record<string, typeof CreditCard> = {
  "payment-monitor": CreditCard,
  "issue-triager": GitBranch,
  "error-alerter": AlertTriangle,
  "daily-digest": Newspaper,
  "deploy-watcher": Rocket,
  "customer-onboarding": UserPlus,
  "dependency-auditor": Shield,
  "content-pipeline": FileText,
  "competitor-monitor": Search,
  "database-backup-alert": Database,
};

interface WorkflowTemplatesProps {
  onCreated?: () => void;
}

export function WorkflowTemplates({ onCreated }: WorkflowTemplatesProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());

  useEffect(() => {
    listWorkflowTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (slug: string) => {
    setCreating(slug);
    try {
      await createWorkflowFromTemplate(slug);
      setCreated((prev) => new Set(prev).add(slug));
      onCreated?.();
    } catch (err) {
      console.error("Failed to create from template:", err);
    } finally {
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((template) => {
        const Icon = templateIcons[template.slug] ?? FileText;
        const isCreating = creating === template.slug;
        const isCreated = created.has(template.slug);

        return (
          <div
            key={template.slug}
            className="rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm p-4"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <Icon className="h-5 w-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-100">{template.name}</h4>
                <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{template.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.requiredServers.map((server) => (
                    <span
                      key={server}
                      className="rounded-full bg-gray-800/50 px-2 py-0.5 text-[10px] font-mono text-gray-500"
                    >
                      {server}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleCreate(template.slug)}
                disabled={isCreating || isCreated}
                className={cn(
                  "shrink-0 rounded-lg p-2 transition-colors",
                  isCreated
                    ? "text-emerald-400"
                    : "text-gray-500 hover:bg-violet-500/10 hover:text-violet-400"
                )}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCreated ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
