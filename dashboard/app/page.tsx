"use client";

import { useNetwraith } from "@/lib/useNetwraith";
import { TopBar } from "@/components/TopBar";
import { StatCards } from "@/components/StatCards";
import { AlertFeed } from "@/components/AlertFeed";
import { TopTalkers } from "@/components/TopTalkers";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";

export default function Page() {
  const {
    alerts,
    connected,
    bySeverity,
    byCategory,
    topTalkers,
    serverStats
  } = useNetwraith();

  // Prefer the authoritative server total when the bridge is reachable, fall
  // back to the live view count otherwise. Severity cards stay on the live view
  // so they move with the feed.
  const total = serverStats?.total ?? alerts.length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar connected={connected} />

      <main className="mx-auto max-w-[1400px] px-5 pb-10 pt-20">
        <div className="mb-4">
          <StatCards total={total} bySeverity={bySeverity} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex min-h-[60vh] flex-col lg:h-[calc(100vh-180px)]">
            <AlertFeed alerts={alerts} connected={connected} />
          </div>

          <aside className="flex flex-col gap-4">
            <TopTalkers talkers={topTalkers} />
            <CategoryBreakdown byCategory={byCategory} />
          </aside>
        </div>
      </main>
    </div>
  );
}
