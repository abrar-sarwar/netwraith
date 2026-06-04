"use client";

import type { ByCategory, Category } from "@/lib/types";
import { CATEGORY_ORDER } from "@/lib/types";
import { CATEGORY_META } from "@/lib/ui";

interface CategoryBreakdownProps {
  byCategory: ByCategory;
  activeCategories: Category[];
  onToggle: (c: Category) => void;
}

export function CategoryBreakdown({
  byCategory,
  activeCategories,
  onToggle
}: CategoryBreakdownProps) {
  const total = CATEGORY_ORDER.reduce((acc, c) => acc + byCategory[c], 0);

  return (
    <section className="panel">
      <div className="border-b border-zinc-800/80 px-4 py-2.5">
        <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-300">
          Category split
        </h2>
      </div>

      <div className="flex flex-col">
        {CATEGORY_ORDER.map((cat) => {
          const value = byCategory[cat];
          const pct = total > 0 ? (value / total) * 100 : 0;
          const active = activeCategories.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggle(cat)}
              aria-pressed={active}
              className={`group border-b border-zinc-900/80 px-4 py-2.5 text-left transition-colors last:border-b-0 focus:outline-none focus-visible:bg-zinc-800/30 ${
                active ? "bg-accent/[0.06]" : "hover:bg-zinc-800/20"
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`font-sans text-[12.5px] ${
                      active ? "text-accent-soft" : "text-zinc-300"
                    }`}
                  >
                    {CATEGORY_META[cat].label}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600">
                    {CATEGORY_META[cat].note}
                  </span>
                </span>
                <span className="tnum font-mono text-[11px] text-zinc-500">
                  {value.toLocaleString()}
                </span>
              </div>
              <div className="h-[5px] overflow-hidden bg-zinc-800/50">
                <div
                  className={active ? "h-full bg-accent/70" : "h-full bg-zinc-500/60"}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
