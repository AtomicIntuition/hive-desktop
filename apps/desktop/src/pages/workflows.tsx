import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { WorkflowCreator } from "@/components/workflows/workflow-creator";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { WorkflowTemplates } from "@/components/workflows/workflow-templates";
import { useWorkflows } from "@/hooks/use-workflows";
import { LayoutList, LayoutTemplate } from "lucide-react";

export function WorkflowsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"workflows" | "templates">("workflows");
  const { refresh } = useWorkflows();

  const handleBack = useCallback(() => {
    setSelectedId(null);
    refresh();
  }, [refresh]);

  // Editor view — fill available height so content doesn't overflow
  if (selectedId) {
    return (
      <div className="h-full">
        <WorkflowEditor workflowId={selectedId} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkflowCreator onCreated={(id) => setSelectedId(id)} />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-900/60 backdrop-blur-sm p-1 border border-white/[0.06] w-fit">
        <button
          onClick={() => setTab("workflows")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            tab === "workflows" ? "bg-violet-500/15 text-violet-300" : "text-gray-400 hover:text-gray-300"
          )}
        >
          <LayoutList className="h-4 w-4" /> My Workflows
        </button>
        <button
          onClick={() => setTab("templates")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            tab === "templates" ? "bg-violet-500/15 text-violet-300" : "text-gray-400 hover:text-gray-300"
          )}
        >
          <LayoutTemplate className="h-4 w-4" /> Templates
        </button>
      </div>

      {tab === "workflows" ? (
        <WorkflowList onSelect={setSelectedId} />
      ) : (
        <WorkflowTemplates onCreated={() => { refresh(); setTab("workflows"); }} />
      )}
    </div>
  );
}
