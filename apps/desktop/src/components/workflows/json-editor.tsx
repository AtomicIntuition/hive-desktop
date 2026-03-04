import React, { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowEditorStore } from "@/stores/workflow-editor-store";
import { Copy, Check, Pencil, Eye, AlertCircle } from "lucide-react";

export function JsonEditorTab() {
  const { name, description, trigger, steps, replaceAllFromJson } = useWorkflowEditorStore();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const jsonData = useMemo(
    () => ({ name, description, trigger, steps }),
    [name, description, trigger, steps]
  );

  const jsonString = useMemo(
    () => JSON.stringify(jsonData, null, 2),
    [jsonData]
  );

  const handleStartEdit = useCallback(() => {
    setEditText(jsonString);
    setParseError(null);
    setEditing(true);
  }, [jsonString]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setParseError(null);
  }, []);

  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(editText);
      if (!parsed.name || !parsed.trigger || !Array.isArray(parsed.steps)) {
        setParseError("JSON must contain name, trigger, and steps array");
        return;
      }
      replaceAllFromJson({
        name: parsed.name,
        description: parsed.description ?? "",
        trigger: parsed.trigger,
        steps: parsed.steps,
      });
      setEditing(false);
      setParseError(null);
    } catch (err) {
      setParseError((err as Error).message);
    }
  }, [editText, replaceAllFromJson]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [jsonString]);

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Edit JSON</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
            >
              Apply Changes
            </button>
          </div>
        </div>

        <textarea
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            setParseError(null);
          }}
          spellCheck={false}
          className={cn(
            "w-full rounded-xl border bg-gray-900/60 backdrop-blur-sm p-4 font-mono text-sm text-gray-200 outline-none resize-none",
            parseError ? "border-red-500/50" : "border-white/[0.06] focus:border-violet-500/50"
          )}
          style={{ minHeight: "500px", tabSize: 2 }}
        />

        {parseError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {parseError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">Workflow JSON</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-gray-400 hover:border-violet-500/30 hover:text-violet-300"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit JSON
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-gray-900/60 backdrop-blur-sm p-4 overflow-auto" style={{ maxHeight: "600px" }}>
        <pre className="font-mono text-sm leading-relaxed">
          <SyntaxHighlightedJson json={jsonString} />
        </pre>
      </div>
    </div>
  );
}

// ── Syntax Highlighting ─────────────────────────────────

function SyntaxHighlightedJson({ json }: { json: string }) {
  const highlighted = useMemo(() => highlightJson(json), [json]);
  return <>{highlighted}</>;
}

function highlightJson(json: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  // Regex to match JSON tokens
  const tokenRegex = /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRegex.exec(json)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(json.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // Key
      parts.push(
        <span key={key++} className="text-violet-400">{match[1]}</span>
      );
      parts.push(":");
    } else if (match[2] !== undefined) {
      // String value
      parts.push(
        <span key={key++} className="text-amber-300">{match[2]}</span>
      );
    } else if (match[3] !== undefined) {
      // Number
      parts.push(
        <span key={key++} className="text-cyan-400">{match[3]}</span>
      );
    } else if (match[4] !== undefined) {
      // Boolean
      parts.push(
        <span key={key++} className="text-emerald-400">{match[4]}</span>
      );
    } else if (match[5] !== undefined) {
      // Null
      parts.push(
        <span key={key++} className="text-gray-500">{match[5]}</span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < json.length) {
    parts.push(json.slice(lastIndex));
  }

  return parts;
}
