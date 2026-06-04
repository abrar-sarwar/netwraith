"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Alert, BySeverity, ByCategory, Stats, TopTalker } from "./types";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_URL ?? "http://localhost:4317";

const EMPTY_SEVERITY: BySeverity = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  info: 0
};

const EMPTY_CATEGORY: ByCategory = {
  signature: 0,
  scan: 0,
  flood: 0,
  anomaly: 0
};

function stripPort(src: string): string {
  // src is "ip:port". Top talkers aggregate on ip only. IPv4 only here, which
  // matches the engine contract, so a last colon split is safe.
  const idx = src.lastIndexOf(":");
  return idx === -1 ? src : src.slice(0, idx);
}

function deriveSeverity(alerts: Alert[]): BySeverity {
  const out: BySeverity = { ...EMPTY_SEVERITY };
  for (const a of alerts) {
    if (a.severity in out) out[a.severity] += 1;
  }
  return out;
}

function deriveCategory(alerts: Alert[]): ByCategory {
  const out: ByCategory = { ...EMPTY_CATEGORY };
  for (const a of alerts) {
    if (a.category in out) out[a.category] += 1;
  }
  return out;
}

function deriveTopTalkers(alerts: Alert[]): TopTalker[] {
  const counts = new Map<string, number>();
  for (const a of alerts) {
    const ip = stripPort(a.src);
    counts.set(ip, (counts.get(ip) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export interface NetwraithState {
  alerts: Alert[];
  bySeverity: BySeverity;
  byCategory: ByCategory;
  topTalkers: TopTalker[];
  serverStats: Stats | null;
  // Snapshot status, not a live wire. The operator loads, reads, refreshes.
  loading: boolean;
  reachable: boolean;
  lastUpdated: number | null;
  refresh: () => void;
}

export function useNetwraith(): NetwraithState {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [serverStats, setServerStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reachable, setReachable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    let ok = false;
    try {
      const res = await fetch(`${BRIDGE_URL}/api/alerts`, {
        cache: "no-store"
      });
      if (res.ok) {
        const data: { alerts?: Alert[] } = await res.json();
        if (mountedRef.current && Array.isArray(data.alerts)) {
          setAlerts(data.alerts);
          ok = true;
        }
      }
    } catch {
      // Bridge down. Stay quiet, the table shows a calm waiting state.
    }
    try {
      const res = await fetch(`${BRIDGE_URL}/api/stats`, {
        cache: "no-store"
      });
      if (res.ok) {
        const data: Stats = await res.json();
        if (mountedRef.current) setServerStats(data);
      }
    } catch {
      // Quiet.
    }
    if (mountedRef.current) {
      setReachable(ok);
      setLoading(false);
      if (ok) setLastUpdated(Date.now());
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const bySeverity = useMemo(() => deriveSeverity(alerts), [alerts]);
  const byCategory = useMemo(() => deriveCategory(alerts), [alerts]);
  const topTalkers = useMemo(() => deriveTopTalkers(alerts), [alerts]);

  return {
    alerts,
    bySeverity,
    byCategory,
    topTalkers,
    serverStats,
    loading,
    reachable,
    lastUpdated,
    refresh: load
  };
}
