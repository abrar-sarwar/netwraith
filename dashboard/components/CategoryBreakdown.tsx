"use client";

import type { ByCategory, Category } from "@/lib/types";
import { CATEGORY_ORDER } from "@/lib/types";

interface CategoryBreakdownProps {
  byCategory: ByCategory;
}

const CATEGORY_LABEL: Record<Category, string> = {
  signature: "Signature",
  scan: "Scan",
  flood: "Flood",
  anomaly: "Anomaly"
};

export function CategoryBreakdown({ byCategory }: CategoryBreakdownProps) {
  const total = CATEGORY_ORDER.reduce((acc, c) => acc + byCategory[c], 0);

  return (
    <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/30">
      <div className="border-b border-zinc-800/80 px-4 py-2.5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Category Split
        </h2>
      </div>

      <div className="space-y-3 px-4 py-4">
        {CATEGORY_ORDER.map((cat) => {
          const value = byCategory[cat];
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={cat}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12px] text-zinc-400">
                  {CATEGORY_LABEL[cat]}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {value.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800/60">
                <div
                  className="h-full rounded-full bg-zinc-500/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
