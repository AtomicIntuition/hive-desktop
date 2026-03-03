import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkflowCreator() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);

  const examples = [
    "Watch my Stripe for payments over $500 and Slack me",
    "Auto-label new GitHub issues using AI",
    "Send me a daily digest of GitHub activity",
    "Alert Slack when a Vercel deployment fails",
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gray-900/50 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-400" />
        <h3 className="font-semibold text-gray-100">Create a Workflow</h3>
      </div>
      <p className="mb-4 text-sm text-gray-400">
        Describe what you want to automate in plain English. The AI planner will design the workflow for you.
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
          placeholder="e.g., Watch my Stripe and Slack me when a payment over $500 comes in"
          rows={3}
          className="w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none"
        />
        <div className="flex items-center justify-end border-t border-white/[0.04] px-3 py-2">
          <button
            disabled={!input.trim()}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Plan Workflow
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Example prompts */}
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
    </div>
  );
}
