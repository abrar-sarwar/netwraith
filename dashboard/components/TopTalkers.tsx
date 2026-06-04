"use client";

import type { TopTalker } from "@/lib/types";

interface TopTalkersProps {
  talkers: TopTalker[];
  activeSource: string | null;
  onPick: (ip: string) => void;
}

export function TopTalkers({ talkers, activeSource, onPick }: TopTalkersProps) {
  const max = talkers.length > 0 ? talkers[0].count : 0;

  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2.5">
        <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-300">
          Top talkers
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-700">
          by source
        </span>
      </div>

      {talkers.length === 0 ? (
        <p className="px-4 py-6 font-mono text-[12px] text-zinc-600">
          No source has spoken up yet.
        </p>
      ) : (
        <ol>
          {talkers.map((t, i) => {
            const pct = max > 0 ? Math.max(5, (t.count / max) * 100) : 0;
            const active = activeSource === t.ip;
            return (
              <li key={t.ip}>
                <button
                  type="button"
                  onClick={() => onPick(t.ip)}
                  aria-pressed={active}
                  className={`relative flex w-full items-center justify-between gap-3 border-b border-zinc-900/80 px-4 py-2 text-left transition-colors focus:outline-none focus-visible:bg-zinc-800/30 ${
                    active ? "bg-accent/[0.07]" : "hover:bg-zinc-800/25"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 ${
                      active ? "bg-accent/20" : "bg-zinc-800/35"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex min-w-0 items-baseline gap-2.5">
                    <span className="w-3.5 shrink-0 font-mono text-[10px] tabular-nums text-zinc-600">
                      {i + 1}
                    </span>
                    <span
                      className={`truncate font-mono text-[12.5px] ${
                        active ? "text-accent-soft" : "text-zinc-300"
                      }`}
                    >
                      {t.ip}
                    </span>
                  </span>
                  <span className="tnum relative font-mono text-[12px] text-zinc-400">
                    {t.count.toLocaleString()}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
