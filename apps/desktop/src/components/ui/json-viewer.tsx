"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";

interface JsonViewerProps {
  data: unknown;
  defaultExpanded?: boolean;
  maxDepth?: number;
  className?: string;
}

export function JsonViewer({ data, defaultExpanded = true, maxDepth = 6, className }: JsonViewerProps) {
  return (
    <div className={cn("font-mono text-xs leading-relaxed", className)}>
      <JsonNode value={data} depth={0} defaultExpanded={defaultExpanded} maxDepth={maxDepth} />
    </div>
  );
}

// ── Recursive Node ───────────────────────────────────────

interface JsonNodeProps {
  value: unknown;
  depth: number;
  defaultExpanded: boolean;
  maxDepth: number;
  keyName?: string;
  isLast?: boolean;
}

function JsonNode({ value, depth, defaultExpanded, maxDepth, keyName, isLast = true }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(depth < (defaultExpanded ? 2 : 0));
  const comma = isLast ? "" : ",";

  // Null
  if (value === null) {
    return (
      <span>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-gray-500">null</span>
        {comma}
      </span>
    );
  }

  // Undefined
  if (value === undefined) {
    return (
      <span>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-gray-500">undefined</span>
        {comma}
      </span>
    );
  }

  const type = typeof value;

  // Primitives
  if (type === "string") {
    const str = value as string;
    const isLong = str.length > 120;
    return (
      <span>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-emerald-400" title={isLong ? str : undefined}>
          &quot;{isLong ? str.slice(0, 120) + "…" : str}&quot;
        </span>
        {comma}
      </span>
    );
  }

  if (type === "number") {
    return (
      <span>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-amber-400">{String(value)}</span>
        {comma}
      </span>
    );
  }

  if (type === "boolean") {
    return (
      <span>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-violet-400">{String(value)}</span>
        {comma}
      </span>
    );
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-500">[]</span>
          {comma}
        </span>
      );
    }

    if (depth >= maxDepth) {
      return (
        <span>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-500">[…{value.length} items]</span>
          {comma}
        </span>
      );
    }

    return (
      <div>
        <CollapsibleHeader
          keyName={keyName}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          bracketOpen="["
          summary={`${value.length} item${value.length !== 1 ? "s" : ""}`}
        />
        {expanded ? (
          <>
            <div className="ml-4 border-l border-white/[0.04] pl-3">
              {value.map((item, i) => (
                <div key={i}>
                  <JsonNode
                    value={item}
                    depth={depth + 1}
                    defaultExpanded={defaultExpanded}
                    maxDepth={maxDepth}
                    isLast={i === value.length - 1}
                  />
                </div>
              ))}
            </div>
            <span className="text-gray-500">]{comma}</span>
          </>
        ) : (
          <span className="text-gray-500">]{comma}</span>
        )}
      </div>
    );
  }

  // Objects
  if (type === "object") {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return (
        <span>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-500">{"{}"}</span>
          {comma}
        </span>
      );
    }

    if (depth >= maxDepth) {
      return (
        <span>
          {keyName !== undefined && <KeyLabel name={keyName} />}
          <span className="text-gray-500">{"{"}…{entries.length} keys{"}"}</span>
          {comma}
        </span>
      );
    }

    return (
      <div>
        <CollapsibleHeader
          keyName={keyName}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          bracketOpen="{"
          summary={`${entries.length} key${entries.length !== 1 ? "s" : ""}`}
        />
        {expanded ? (
          <>
            <div className="ml-4 border-l border-white/[0.04] pl-3">
              {entries.map(([k, v], i) => (
                <div key={k}>
                  <JsonNode
                    value={v}
                    depth={depth + 1}
                    defaultExpanded={defaultExpanded}
                    maxDepth={maxDepth}
                    keyName={k}
                    isLast={i === entries.length - 1}
                  />
                </div>
              ))}
            </div>
            <span className="text-gray-500">{"}"}{comma}</span>
          </>
        ) : (
          <span className="text-gray-500">{"}"}{comma}</span>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <span>
      {keyName !== undefined && <KeyLabel name={keyName} />}
      <span className="text-gray-400">{String(value)}</span>
      {comma}
    </span>
  );
}

// ── Sub-components ───────────────────────────────────────

function KeyLabel({ name }: { name: string }) {
  return <span className="text-sky-400">&quot;{name}&quot;: </span>;
}

function CollapsibleHeader({
  keyName,
  expanded,
  onToggle,
  bracketOpen,
  summary,
}: {
  keyName?: string;
  expanded: boolean;
  onToggle: () => void;
  bracketOpen: string;
  summary: string;
}) {
  return (
    <span
      onClick={onToggle}
      className="cursor-pointer inline-flex items-center gap-0.5 hover:bg-white/[0.03] rounded px-0.5 -ml-0.5 select-none"
    >
      {expanded ? (
        <ChevronDown className="h-3 w-3 text-gray-600 shrink-0" />
      ) : (
        <ChevronRight className="h-3 w-3 text-gray-600 shrink-0" />
      )}
      {keyName !== undefined && <KeyLabel name={keyName} />}
      <span className="text-gray-500">{bracketOpen}</span>
      {!expanded && (
        <span className="text-gray-600 text-[10px] ml-1">{summary}</span>
      )}
    </span>
  );
}
