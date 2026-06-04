"use client";

import type { TopTalker } from "@/lib/types";

interface TopTalkersProps {
  talkers: TopTalker[];
}

export function TopTalkers({ talkers }: TopTalkersProps) {
  const max = talkers.length > 0 ? talkers[0].count : 0;

  return (
    <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/30">
      <div className="border-b border-zinc-800/80 px-4 py-2.5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Top Talkers
        </h2>
      </div>

      {talkers.length === 0 ? (
        <p className="px-4 py-6 font-mono text-[12px] text-zinc-600">
          No source has spoken up yet.
        </p>
      ) : (
        <ol className="divide-y divide-zinc-900">
          {talkers.map((t, i) => {
            const pct = max > 0 ? Math.max(4, (t.count / max) * 100) : 0;
            return (
              <li key={t.ip} className="relative px-4 py-2">
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-zinc-800/40"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2.5">
                    <span className="w-4 shrink-0 font-mono text-[11px] tabular-nums text-zinc-600">
                      {i + 1}
                    </span>
                    <span className="truncate font-mono text-[12.5px] text-zinc-300">
                      {t.ip}
                    </span>
                  </div>
                  <span className="font-mono text-[12px] tabular-nums text-zinc-400">
                    {t.count.toLocaleString()}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
