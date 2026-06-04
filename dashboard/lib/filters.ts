// The console is a query tool, not a stream. Every panel writes into this one
// filter shape and the table reads from it. Empty arrays mean no constraint.

import type { Alert, Category, Proto, Severity } from "./types";

export interface Filters {
  severities: Severity[];
  categories: Category[];
  protos: Proto[];
  source: string | null; // exact source ip, set by the top talkers panel
  query: string; // free text over ip, rule id, and message
}

export const EMPTY_FILTERS: Filters = {
  severities: [],
  categories: [],
  protos: [],
  source: null,
  query: ""
};

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function hasAnyFilter(f: Filters): boolean {
  return (
    f.severities.length > 0 ||
    f.categories.length > 0 ||
    f.protos.length > 0 ||
    f.source !== null ||
    f.query.trim() !== ""
  );
}

function stripPort(value: string): string {
  const idx = value.lastIndexOf(":");
  return idx === -1 ? value : value.slice(0, idx);
}

export function applyFilters(alerts: Alert[], f: Filters): Alert[] {
  const q = f.query.trim().toLowerCase();
  return alerts.filter((a) => {
    if (f.severities.length && !f.severities.includes(a.severity)) return false;
    if (f.categories.length && !f.categories.includes(a.category)) return false;
    if (f.protos.length && !f.protos.includes(a.proto)) return false;
    if (f.source && stripPort(a.src) !== f.source) return false;
    if (q) {
      const hay = `${a.src} ${a.dst} ${a.rule_id} ${a.msg} ${a.severity} ${a.category} ${a.proto}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
