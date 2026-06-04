"use client";

import type { Alert, Severity } from "@/lib/types";
import { SEVERITY_META, formatClock, splitHostPort } from "@/lib/ui";

export type SortKey = "ts" | "severity";
export type SortDir = "asc" | "desc";

interface AlertFeedProps {
  alerts: Alert[]; // already filtered and sorted by the page
  totalCount: number; // unfiltered count in the snapshot
  reachable: boolean;
  loading: boolean;
  hasFilters: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onClearFilters: () => void;
}

const GRID =
  "grid grid-cols-[7rem_5.5rem_6.75rem_8.5rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(15rem,1.7fr)]";

const SHORT: Record<Severity, string> = {
  critical: "CRIT",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  info: "INFO"
};

function Chevron({ dir }: { dir: SortDir }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: dir === "asc" ? "rotate(180deg)" : "none" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HostPort({ value, tone }: { value: string; tone: string }) {
  const { host, port } = splitHostPort(value);
  return (
    <span className="truncate font-mono text-[12px]">
      <span className={tone}>{host}</span>
      {port && <span className="text-zinc-600">:{port}</span>}
    </span>
  );
}

function SortHead({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  className
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 text-left font-display text-[9.5px] font-medium uppercase tracking-[0.18em] transition-colors focus:outline-none ${
        active ? "text-zinc-300" : "text-zinc-500 hover:text-zinc-300"
      } ${className ?? ""}`}
    >
      {label}
      <span className={active ? "text-accent-soft" : "text-transparent"}>
        <Chevron dir={sortDir} />
      </span>
    </button>
  );
}

function Row({ alert, index }: { alert: Alert; index: number }) {
  const meta = SEVERITY_META[alert.severity];
  const isCrit = alert.severity === "critical";
  return (
    <div
      className={`${GRID} reveal items-center border-b border-zinc-900/80 px-3 py-2 transition-colors hover:bg-zinc-800/25 ${
        isCrit ? "bg-accent/[0.045]" : ""
      }`}
      style={{
        borderLeft: `2px solid ${meta.color}`,
        animationDelay: index < 28 ? `${index * 13}ms` : "0ms"
      }}
    >
      <span className="tnum font-mono text-[12px] text-zinc-500">
        {formatClock(alert.ts)}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0"
          style={{ backgroundColor: meta.color }}
        />
        <span
          className="font-mono text-[11px] font-medium"
          style={{ color: meta.color }}
        >
          {SHORT[alert.severity]}
        </span>
      </span>
      <span className="truncate font-sans text-[11px] uppercase tracking-wide text-zinc-500">
        {alert.category}
      </span>
      <span className="truncate font-mono text-[12px] text-zinc-300">
        {alert.rule_id}
      </span>
      <HostPort value={alert.src} tone="text-zinc-200" />
      <HostPort value={alert.dst} tone="text-zinc-400" />
      <span
        className={`truncate font-sans text-[12.5px] ${
          isCrit ? "text-zinc-200" : "text-zinc-400"
        }`}
        title={alert.msg}
      >
        {alert.msg}
      </span>
    </div>
  );
}

function EmptyState({
  reachable,
  loading,
  totalCount,
  hasFilters,
  onClearFilters
}: {
  reachable: boolean;
  loading: boolean;
  totalCount: number;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  let line: string;
  if (loading && totalCount === 0) {
    line = "Reading the wire.";
  } else if (!reachable) {
    line = "Waiting for the engine. Bring up the bridge, then refresh.";
  } else if (hasFilters) {
    line = "Nothing matches the current filter.";
  } else {
    line = "The wire is quiet for now. Nothing has tripped a rule.";
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24">
      <p className="text-center font-mono text-[12.5px] text-zinc-600">{line}</p>
      {reachable && hasFilters && totalCount > 0 && (
        <button
          type="button"
          onClick={onClearFilters}
          className="border border-zinc-800 px-3 py-1.5 font-display text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function AlertFeed({
  alerts,
  totalCount,
  reachable,
  loading,
  hasFilters,
  sortKey,
  sortDir,
  onSort,
  onClearFilters
}: AlertFeedProps) {
  return (
    <section className="panel flex min-h-[26rem] flex-1 flex-col lg:min-h-0">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-300">
            Alerts
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-zinc-600">
            showing {alerts.length.toLocaleString()} of{" "}
            {totalCount.toLocaleString()}
          </span>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-zinc-700 sm:inline">
          reverse chronological
        </span>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          reachable={reachable}
          loading={loading}
          totalCount={totalCount}
          hasFilters={hasFilters}
          onClearFilters={onClearFilters}
        />
      ) : (
        <div className="quiet-scroll min-h-0 flex-1 overflow-auto">
          <div className="min-w-[64rem]">
            <div
              className={`${GRID} sticky top-0 z-10 items-center border-b border-zinc-800 bg-zinc-950/90 px-3 py-2 backdrop-blur`}
            >
              <SortHead
                label="Time"
                col="ts"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <SortHead
                label="Sev"
                col="severity"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
              <span className="font-display text-[9.5px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Category
              </span>
              <span className="font-display text-[9.5px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Rule
              </span>
              <span className="font-display text-[9.5px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Source
              </span>
              <span className="font-display text-[9.5px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Destination
              </span>
              <span className="font-display text-[9.5px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Message
              </span>
            </div>

            <div>
              {alerts.map((alert, i) => (
                <Row
                  key={`${alert.ts}-${alert.src}-${alert.rule_id}-${i}`}
                  alert={alert}
                  index={i}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
