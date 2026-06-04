"use client";

interface TopBarProps {
  reachable: boolean;
  loading: boolean;
  lastUpdated: number | null;
  onRefresh: () => void;
}

function RefreshGlyph({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function TopBar({
  reachable,
  loading,
  lastUpdated,
  onRefresh
}: TopBarProps) {
  const updatedLabel =
    lastUpdated !== null
      ? new Date(lastUpdated).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      : "never";

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center justify-between px-5">
        <div className="flex items-baseline gap-3.5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-3.5 w-[3px] bg-accent shadow-[0_0_10px_rgba(99,102,241,0.7)]"
            />
            <span className="font-display text-[15px] font-semibold tracking-wordmark text-zinc-100">
              NETWRAITH
            </span>
          </div>
          <span className="hidden font-sans text-[11px] text-zinc-600 sm:inline">
            It watches the wire so you do not have to.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 md:flex">
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 ${
                reachable ? "bg-zinc-300" : "bg-zinc-700"
              }`}
              style={{ clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" }}
            />
            <span className="font-display text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">
              {reachable ? "Snapshot" : "Offline"}
            </span>
            <span className="font-mono text-[11px] text-zinc-600">
              {reachable ? `updated ${updatedLabel}` : "bridge unreachable"}
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="group flex items-center gap-2 border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 font-display text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus:outline-none focus-visible:border-accent focus-visible:text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-600"
          >
            <span className="text-zinc-500 group-hover:text-accent-soft">
              <RefreshGlyph spinning={loading} />
            </span>
            {loading ? "Reading" : "Refresh"}
          </button>
        </div>
      </div>
    </header>
  );
}
