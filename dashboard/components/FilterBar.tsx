"use client";

import type { Category, Proto, Severity } from "@/lib/types";
import { PROTO_LIST, SEVERITY_META, CATEGORY_META } from "@/lib/ui";

interface FilterBarProps {
  query: string;
  onQuery: (q: string) => void;
  activeProtos: Proto[];
  onToggleProto: (p: Proto) => void;
  severities: Severity[];
  categories: Category[];
  source: string | null;
  onRemoveSeverity: (s: Severity) => void;
  onRemoveCategory: (c: Category) => void;
  onClearSource: () => void;
  onClearAll: () => void;
  visibleCount: number;
  totalCount: number;
}

function SearchGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export function FilterBar({
  query,
  onQuery,
  activeProtos,
  onToggleProto,
  severities,
  categories,
  source,
  onRemoveSeverity,
  onRemoveCategory,
  onClearSource,
  onClearAll,
  visibleCount,
  totalCount
}: FilterBarProps) {
  const hasChips =
    severities.length > 0 || categories.length > 0 || source !== null;
  const hasAny =
    hasChips || activeProtos.length > 0 || query.trim() !== "";

  return (
    <div className="panel flex flex-col gap-3 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-[200px] flex-1 items-center gap-2 border border-zinc-800 bg-zinc-950/40 px-3 py-2 focus-within:border-accent">
          <span className="text-zinc-600">
            <SearchGlyph />
          </span>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Filter by ip, rule, or message"
            spellCheck={false}
            className="w-full bg-transparent font-mono text-[12.5px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        </label>

        <div className="flex items-center gap-1">
          {PROTO_LIST.map((p) => {
            const active = activeProtos.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => onToggleProto(p)}
                aria-pressed={active}
                className={`border px-2.5 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors focus:outline-none focus-visible:border-accent ${
                  active
                    ? "border-zinc-600 bg-zinc-800/50 text-zinc-100"
                    : "border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-zinc-500">
            <span className="text-zinc-200">{visibleCount.toLocaleString()}</span>
            <span className="text-zinc-600"> / {totalCount.toLocaleString()}</span>
          </span>
          {hasAny && (
            <button
              type="button"
              onClick={onClearAll}
              className="border border-zinc-800 px-2.5 py-1.5 font-display text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus:outline-none focus-visible:border-accent"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {hasChips && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800/60 pt-3">
          <span className="mr-1 font-display text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-600">
            Active
          </span>
          {severities.map((s) => (
            <button
              key={`sev-${s}`}
              type="button"
              onClick={() => onRemoveSeverity(s)}
              className="group flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/50 py-1 pl-1.5 pr-1.5 text-[11px] text-zinc-300 transition-colors hover:border-zinc-700"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5"
                style={{ backgroundColor: SEVERITY_META[s].color }}
              />
              {SEVERITY_META[s].label}
              <span className="text-zinc-600 group-hover:text-zinc-300">
                <Cross />
              </span>
            </button>
          ))}
          {categories.map((c) => (
            <button
              key={`cat-${c}`}
              type="button"
              onClick={() => onRemoveCategory(c)}
              className="group flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/50 py-1 pl-2 pr-1.5 text-[11px] text-zinc-300 transition-colors hover:border-zinc-700"
            >
              {CATEGORY_META[c].label}
              <span className="text-zinc-600 group-hover:text-zinc-300">
                <Cross />
              </span>
            </button>
          ))}
          {source !== null && (
            <button
              type="button"
              onClick={onClearSource}
              className="group flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/50 py-1 pl-2 pr-1.5 font-mono text-[11px] text-zinc-300 transition-colors hover:border-zinc-700"
            >
              <span className="text-zinc-600">src</span>
              {source}
              <span className="text-zinc-600 group-hover:text-zinc-300">
                <Cross />
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
