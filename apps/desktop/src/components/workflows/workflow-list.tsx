import { useWorkflows } from "@/hooks/use-workflows";
import { WorkflowCard } from "./workflow-card";

interface WorkflowListProps {
  onSelect?: (id: string) => void;
}

export function WorkflowList({ onSelect }: WorkflowListProps) {
  const { workflows, loading, refresh } = useWorkflows();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] p-12 text-center">
        <p className="text-gray-400">No workflows yet</p>
        <p className="mt-1 text-sm text-gray-500">
          Create one from a template or describe what you want to automate
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workflows.map((wf) => (
        <WorkflowCard key={wf.id} workflow={wf} onSelect={onSelect} onRefresh={refresh} />
      ))}
    </div>
  );
}
