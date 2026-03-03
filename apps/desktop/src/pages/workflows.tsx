import { WorkflowCreator } from "@/components/workflows/workflow-creator";
import { WorkflowList } from "@/components/workflows/workflow-list";

export function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <WorkflowCreator />
      <WorkflowList />
    </div>
  );
}
