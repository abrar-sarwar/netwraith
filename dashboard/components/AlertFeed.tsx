"use client";

import { useMemo } from "react";
import type { Alert, Severity } from "@/lib/types";

interface AlertFeedProps {
  alerts: Alert[];
  connected: boolean;
}

// Severity tone: weight and muted color carry most of the meaning.
// Indigo is reserved for Critical alone.
const SEVERITY_TAG: Record<Severity, string> = {
  critical: "border-accent/50 text-accent-soft",
  high: "border-zinc-600 text-zinc-200",
  medium: "border-zinc-700 text-zinc-300",
  low: "border-zinc-800 text-zinc-400",
  info: "border-zinc-800 text-zinc-500"
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "CRIT",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  info: "INFO"
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function AlertRow({ alert }: { alert: Alert }) {
  const isCrit = alert.severity === "critical";
  return (
    <li
      className={`animate-alert-in grid grid-cols-[auto_auto_1fr] gap-x-3 border-b border-zinc-900 px-4 py-2 ${
        isCrit ? "bg-accent/[0.04]" : ""
      }`}
    >
      <span className="tabular-nums text-zinc-600">{formatTs(alert.ts)}</span>
      <span
        className={`inline-flex h-[18px] items-center rounded border px-1.5 text-[10px] font-semibold uppercase tracking-wide ${
          SEVERITY_TAG[alert.severity]
        }`}
      >
        {SEVERITY_LABEL[alert.severity]}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="uppercase tracking-wide text-zinc-500">
            {alert.category}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{alert.rule_id}</span>
          <span className="text-zinc-700">{alert.proto}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-zinc-500">
          <span className="text-zinc-300">{alert.src}</span>
          <span className="text-zinc-700">{"->"}</span>
          <span className="text-zinc-400">{alert.dst}</span>
        </div>
        <div
          className={`mt-0.5 break-words ${
            isCrit ? "text-zinc-200" : "text-zinc-400"
          }`}
        >
          {alert.msg}
        </div>
      </div>
    </li>
  );
}

export function AlertFeed({ alerts, connected }: AlertFeedProps) {
  const rows = useMemo(() => alerts, [alerts]);

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-zinc-800/80 bg-zinc-900/30">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2.5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          Alert Feed
        </h2>
        <span className="font-mono text-[11px] tabular-nums text-zinc-600">
          {rows.length} shown
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-20">
          <p className="text-center font-mono text-[12.5px] text-zinc-600">
            {connected
              ? "The wire is quiet for now. Nothing has tripped a rule."
              : "Waiting for the engine. The feed will fill once the bridge answers."}
          </p>
        </div>
      ) : (
        <ul className="feed-scroll console flex-1 overflow-y-auto">
          {rows.map((alert, i) => (
            <AlertRow
              key={`${alert.ts}-${alert.src}-${alert.rule_id}-${i}`}
              alert={alert}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
