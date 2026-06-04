"use client";

import type { BySeverity, Severity } from "@/lib/types";
import { SEVERITY_ORDER } from "@/lib/types";
import { SEVERITY_META } from "@/lib/ui";

interface StatCardsProps {
  total: number;
  bySeverity: BySeverity;
  activeSeverities: Severity[];
  onToggleSeverity: (s: Severity) => void;
}

export function StatCards({
  total,
  bySeverity,
  activeSeverities,
  onToggleSeverity
}: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <div className="panel relative px-4 py-3.5">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent/70 to-transparent"
        />
        <div className="font-display text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Total captured
        </div>
        <div className="tnum mt-2 font-display text-[28px] font-semibold leading-none text-zinc-50">
          {total.toLocaleString()}
        </div>
      </div>

      {SEVERITY_ORDER.map((sev) => {
        const meta = SEVERITY_META[sev];
        const value = bySeverity[sev];
        const active = activeSeverities.includes(sev);
        const dimmed = activeSeverities.length > 0 && !active;
        return (
          <button
            key={sev}
            type="button"
            onClick={() => onToggleSeverity(sev)}
            aria-pressed={active}
            className={`panel group relative px-4 py-3.5 text-left transition-colors focus:outline-none focus-visible:border-accent ${
              active ? "border-zinc-600" : "hover:border-zinc-700"
            } ${dimmed ? "opacity-55 hover:opacity-100" : ""}`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px transition-opacity"
              style={{
                backgroundColor: meta.color,
                opacity: active ? 0.95 : 0.32
              }}
            />
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2"
                style={{ backgroundColor: meta.color }}
              />
              <span className="font-display text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                {meta.label}
              </span>
            </div>
            <div
              className="tnum mt-2 font-display text-[28px] font-semibold leading-none"
              style={{ color: value > 0 ? meta.color : "#52525b" }}
            >
              {value.toLocaleString()}
            </div>
          </button>
        );
      })}
    </div>
  );
}
