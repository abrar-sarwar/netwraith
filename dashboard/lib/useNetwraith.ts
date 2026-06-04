"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Alert,
  BridgeMessage,
  BySeverity,
  ByCategory,
  Stats,
  TopTalker
} from "./types";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_URL ?? "http://localhost:4317";
const BRIDGE_WS = process.env.NEXT_PUBLIC_BRIDGE_WS ?? "ws://localhost:4317";

// Cap the rendered feed. The wire never stops; the screen has limits.
const MAX_ALERTS = 200;

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
  // src is "ip:port". For top talkers we aggregate on ip only. IPv4 only here,
  // which matches the engine contract, so a simple last-colon split is safe.
  const idx = src.lastIndexOf(":");
  return idx === -1 ? src : src.slice(0, idx);
}

function deriveSeverity(alerts: Alert[]): BySeverity {
  const out: BySeverity = { ...EMPTY_SEVERITY };
  for (const a of alerts) {
    if (a.severity in out) {
      out[a.severity] += 1;
    }
  }
  return out;
}

function deriveCategory(alerts: Alert[]): ByCategory {
  const out: ByCategory = { ...EMPTY_CATEGORY };
  for (const a of alerts) {
    if (a.category in out) {
      out[a.category] += 1;
    }
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
  connected: boolean;
  // Live counts derived from the alerts currently in view.
  bySeverity: BySeverity;
  byCategory: ByCategory;
  topTalkers: TopTalker[];
  // Authoritative totals from the bridge stats endpoint, when reachable.
  serverStats: Stats | null;
}

export function useNetwraith(): NetwraithState {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [serverStats, setServerStats] = useState<Stats | null>(null);

  // Ref mirror of connection so timers and handlers read fresh state without
  // re-subscribing.
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Backfill from REST first so the operator sees history on load even before
    // the socket opens. Failures here are quiet by design.
    async function backfill() {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/alerts`, {
          cache: "no-store"
        });
        if (res.ok) {
          const data: { alerts?: Alert[] } = await res.json();
          if (mountedRef.current && Array.isArray(data.alerts)) {
            setAlerts(data.alerts.slice(0, MAX_ALERTS));
          }
        }
      } catch {
        // Bridge down. Stay quiet, the UI shows a waiting state.
      }
      try {
        const res = await fetch(`${BRIDGE_URL}/api/stats`, {
          cache: "no-store"
        });
        if (res.ok) {
          const data: Stats = await res.json();
          if (mountedRef.current) {
            setServerStats(data);
          }
        }
      } catch {
        // Quiet.
      }
    }

    function connect() {
      let ws: WebSocket;
      try {
        ws = new WebSocket(BRIDGE_WS);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        let parsed: BridgeMessage;
        try {
          parsed = JSON.parse(event.data as string) as BridgeMessage;
        } catch {
          return;
        }
        if (parsed.type === "snapshot") {
          // Snapshot is newest-first already. Trust the contract, then cap.
          setAlerts(parsed.alerts.slice(0, MAX_ALERTS));
        } else if (parsed.type === "alert") {
          const incoming = parsed.alert;
          setAlerts((prev) => {
            const next = [incoming, ...prev];
            if (next.length > MAX_ALERTS) {
              next.length = MAX_ALERTS;
            }
            return next;
          });
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        // Let onclose drive reconnection. Do not surface a raw error.
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    }

    function scheduleReconnect() {
      if (!mountedRef.current) return;
      if (reconnectRef.current) return;
      reconnectRef.current = setTimeout(() => {
        reconnectRef.current = null;
        if (mountedRef.current) {
          connect();
        }
      }, 2500);
    }

    backfill();
    connect();

    // Refresh authoritative stats on a calm interval. The derived counts cover
    // the live view; this keeps the server totals honest over time.
    const statsTimer = setInterval(async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/stats`, {
          cache: "no-store"
        });
        if (res.ok) {
          const data: Stats = await res.json();
          if (mountedRef.current) {
            setServerStats(data);
          }
        }
      } catch {
        // Quiet.
      }
    }, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(statsTimer);
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
    };
  }, []);

  const bySeverity = useMemo(() => deriveSeverity(alerts), [alerts]);
  const byCategory = useMemo(() => deriveCategory(alerts), [alerts]);
  const topTalkers = useMemo(() => deriveTopTalkers(alerts), [alerts]);

  return {
    alerts,
    connected,
    bySeverity,
    byCategory,
    topTalkers,
    serverStats
  };
}
