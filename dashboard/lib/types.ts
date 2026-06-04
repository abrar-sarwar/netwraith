// Types mirror the NETWRAITH data contract exactly. The engine writes these
// fields, the bridge relays them, the dashboard renders them. Do not drift.

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Category = "signature" | "scan" | "flood" | "anomaly";

export type Proto = "tcp" | "udp" | "icmp";

export interface Alert {
  ts: number; // capture timestamp, epoch milliseconds
  severity: Severity;
  category: Category;
  rule_id: string;
  msg: string;
  src: string; // "ip:port"
  dst: string; // "ip:port"
  proto: Proto;
}

export interface BySeverity {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ByCategory {
  signature: number;
  scan: number;
  flood: number;
  anomaly: number;
}

export interface TopTalker {
  ip: string;
  count: number;
}

export interface Stats {
  total: number;
  by_severity: BySeverity;
  by_category: ByCategory;
  top_talkers: TopTalker[];
}

// WebSocket envelope shapes from the bridge.
export interface SnapshotMessage {
  type: "snapshot";
  alerts: Alert[];
}

export interface AlertMessage {
  type: "alert";
  alert: Alert;
}

export type BridgeMessage = SnapshotMessage | AlertMessage;

export const SEVERITY_ORDER: Severity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info"
];

export const CATEGORY_ORDER: Category[] = [
  "signature",
  "scan",
  "flood",
  "anomaly"
];
