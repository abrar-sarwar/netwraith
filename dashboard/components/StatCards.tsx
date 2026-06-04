"use client";

import type { BySeverity } from "@/lib/types";

interface StatCardsProps {
  total: number;
  bySeverity: BySeverity;
}

interface Cell {
  label: string;
  value: number;
  // Tone is communicated mostly through weight and a few muted colors.
  // Indigo is reserved for Critical only.
  tone: string;
}

export function StatCards({ total, bySeverity }: StatCardsProps) {
  const cells: Cell[] = [
    { label: "Critical", value: bySeverity.critical, tone: "text-accent-soft" },
    { label: "High", value: bySeverity.high, tone: "text-zinc-200" },
    { label: "Medium", value: bySeverity.medium, tone: "text-zinc-300" },
    { label: "Low", value: bySeverity.low, tone: "text-zinc-400" },
    { label: "Info", value: bySeverity.info, tone: "text-zinc-500" }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3.5">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500">
          Total
        </div>
        <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-zinc-100">
          {total.toLocaleString()}
        </div>
      </div>

      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3.5"
        >
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            {cell.label}
          </div>
          <div
            className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${cell.tone}`}
          >
            {cell.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
