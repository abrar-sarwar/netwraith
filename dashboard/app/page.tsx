"use client";

import { useCallback, useMemo, useState } from "react";
import { useNetwraith } from "@/lib/useNetwraith";
import {
  EMPTY_FILTERS,
  applyFilters,
  hasAnyFilter,
  toggle,
  type Filters
} from "@/lib/filters";
import { SEVERITY_META } from "@/lib/ui";
import type { Category, Proto, Severity } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { StatCards } from "@/components/StatCards";
import { FilterBar } from "@/components/FilterBar";
import { AlertFeed, type SortKey, type SortDir } from "@/components/AlertFeed";
import { TopTalkers } from "@/components/TopTalkers";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";

export default function Page() {
  const {
    alerts,
    bySeverity,
    byCategory,
    topTalkers,
    serverStats,
    loading,
    reachable,
    lastUpdated,
    refresh
  } = useNetwraith();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("ts");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSeverity = useCallback(
    (s: Severity) =>
      setFilters((f) => ({ ...f, severities: toggle(f.severities, s) })),
    []
  );
  const toggleCategory = useCallback(
    (c: Category) =>
      setFilters((f) => ({ ...f, categories: toggle(f.categories, c) })),
    []
  );
  const toggleProto = useCallback(
    (p: Proto) => setFilters((f) => ({ ...f, protos: toggle(f.protos, p) })),
    []
  );
  const setQuery = useCallback(
    (q: string) => setFilters((f) => ({ ...f, query: q })),
    []
  );
  const pickSource = useCallback(
    (ip: string) =>
      setFilters((f) => ({ ...f, source: f.source === ip ? null : ip })),
    []
  );
  const clearSource = useCallback(
    () => setFilters((f) => ({ ...f, source: null })),
    []
  );
  const clearAll = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const visible = useMemo(() => {
    const filtered = applyFilters(alerts, filters);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "ts") return (a.ts - b.ts) * dir;
      const ra = SEVERITY_META[a.severity].rank;
      const rb = SEVERITY_META[b.severity].rank;
      if (ra !== rb) return (ra - rb) * dir;
      return b.ts - a.ts; // tie break: newest first
    });
  }, [alerts, filters, sortKey, sortDir]);

  const total = serverStats?.total ?? alerts.length;
  const hasFilters = hasAnyFilter(filters);

  return (
    <div id="app-root" className="min-h-screen">
      <TopBar
        reachable={reachable}
        loading={loading}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      <main className="mx-auto max-w-[1480px] px-5 pb-12 pt-20">
        <div className="reveal mb-2">
          <StatCards
            total={total}
            bySeverity={bySeverity}
            activeSeverities={filters.severities}
            onToggleSeverity={toggleSeverity}
          />
        </div>

        <div className="reveal mb-2" style={{ animationDelay: "70ms" }}>
          <FilterBar
            query={filters.query}
            onQuery={setQuery}
            activeProtos={filters.protos}
            onToggleProto={toggleProto}
            severities={filters.severities}
            categories={filters.categories}
            source={filters.source}
            onRemoveSeverity={toggleSeverity}
            onRemoveCategory={toggleCategory}
            onClearSource={clearSource}
            onClearAll={clearAll}
            visibleCount={visible.length}
            totalCount={alerts.length}
          />
        </div>

        <div
          className="reveal grid grid-cols-1 gap-2 lg:h-[calc(100vh-17.5rem)] lg:grid-cols-[1fr_21rem]"
          style={{ animationDelay: "140ms" }}
        >
          <AlertFeed
            alerts={visible}
            totalCount={alerts.length}
            reachable={reachable}
            loading={loading}
            hasFilters={hasFilters}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            onClearFilters={clearAll}
          />

          <aside className="quiet-scroll flex flex-col gap-2 lg:overflow-y-auto">
            <TopTalkers
              talkers={topTalkers}
              activeSource={filters.source}
              onPick={pickSource}
            />
            <CategoryBreakdown
              byCategory={byCategory}
              activeCategories={filters.categories}
              onToggle={toggleCategory}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
