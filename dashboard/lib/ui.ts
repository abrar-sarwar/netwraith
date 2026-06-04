// Presentation metadata for the data contract. Kept out of the components so the
// severity ramp and labels stay in one place and never drift between panels.

import type { Category, Proto, Severity } from "./types";

export interface SeverityMeta {
  label: string;
  color: string;
  rank: number; // higher is more severe, used for sorting
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: { label: "Critical", color: "var(--sev-critical)", rank: 5 },
  high: { label: "High", color: "var(--sev-high)", rank: 4 },
  medium: { label: "Medium", color: "var(--sev-medium)", rank: 3 },
  low: { label: "Low", color: "var(--sev-low)", rank: 2 },
  info: { label: "Info", color: "var(--sev-info)", rank: 1 }
};

export const CATEGORY_META: Record<Category, { label: string; note: string }> = {
  signature: { label: "Signature", note: "rule match" },
  scan: { label: "Scan", note: "port fan out" },
  flood: { label: "Flood", note: "volumetric" },
  anomaly: { label: "Anomaly", note: "behavioral" }
};

export const PROTO_LIST: Proto[] = ["tcp", "udp", "icmp"];

// src and dst arrive as "ip:port". Split on the last colon so IPv4 stays intact.
export function splitHostPort(value: string): { host: string; port: string } {
  const idx = value.lastIndexOf(":");
  if (idx === -1) return { host: value, port: "" };
  return { host: value.slice(0, idx), port: value.slice(idx + 1) };
}

// Render the capture timestamp as a calm UTC clock. Date is unavailable to the
// engine narrative, but the operator wants hh:mm:ss with milliseconds.
export function formatClock(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const ms = String(d.getUTCMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function formatStamp(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mo}-${da} ${formatClock(ts)}Z`;
}
