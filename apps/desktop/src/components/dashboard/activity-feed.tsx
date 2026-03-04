import { Clock } from "lucide-react";

interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
  type: "info" | "success" | "error";
}

// Placeholder activity items for the empty state
const placeholderItems: ActivityItem[] = [
  {
    id: "1",
    message: "Welcome to Hive Desktop! Install MCP servers to get started.",
    timestamp: new Date().toISOString(),
    type: "info",
  },
];

export function ActivityFeed() {
  const items = placeholderItems;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">Activity</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
            <div>
              <p className="text-sm text-gray-300">{item.message}</p>
              <p className="mt-0.5 text-xs text-gray-600">
                {new Date(item.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
