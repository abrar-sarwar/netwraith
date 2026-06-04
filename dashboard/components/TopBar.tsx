"use client";

interface TopBarProps {
  connected: boolean;
}

export function TopBar({ connected }: TopBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-semibold tracking-[0.28em] text-zinc-100">
            NETWRAITH
          </span>
          <span className="hidden text-xs text-zinc-500 sm:inline">
            It watches the wire so you do not have to.
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={
              connected
                ? "h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                : "h-2 w-2 rounded-full bg-zinc-700"
            }
          />
          <span
            className={
              connected
                ? "font-mono text-[11px] uppercase tracking-wider text-zinc-400"
                : "font-mono text-[11px] uppercase tracking-wider text-zinc-600"
            }
          >
            {connected ? "live" : "offline"}
          </span>
        </div>
      </div>
    </header>
  );
}
