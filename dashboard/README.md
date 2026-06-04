# NETWRAITH Dashboard

It watches the wire so you do not have to.

This is the surface: a quiet, dark operator console that renders what the engine
caught. It does not capture packets and it does not reason about them. It reads a
snapshot from the bridge and lets you work it: severity readouts, the loudest
sources, the category split, and a sortable, filterable table of every alert.

## What it talks to

The dashboard reads from the bridge over REST:

- `GET /api/alerts` for the current buffer, newest first.
- `GET /api/stats` for totals, severity, category, and top talkers.

It loads a snapshot on open and reloads on demand with the Refresh control. There
is no live socket: the operator reads, filters, and refreshes when they want the
next look. If the bridge is down, the status reads Offline, the table states that
it is waiting for the engine, and nothing breaks.

## Filtering

The console is a query tool. Everything narrows the table:

- Click a severity readout to filter to that severity. Click again to release it.
- Click a category in the split, or a source in top talkers, to scope the table.
- Toggle protocol (tcp, udp, icmp), or type into the search to match any ip, rule
  id, or message.
- Sort by time or severity from the column headers. Clear releases everything.

## Configure

Copy the example env file and adjust if the bridge does not live on the default.

```
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_BRIDGE_URL=http://localhost:4317
```

## Run

```
npm install
npm run dev
```

Then open http://localhost:3000 (the dev server picks the next free port if 3000
is taken). Start the engine and the bridge alongside it, then refresh.

## Build

```
npm run build
npm start
```

## Notes

- Dark mode is the default and only intended experience.
- Typography: Chakra Petch for the wordmark and readouts, IBM Plex Mono for data,
  IBM Plex Sans for chrome.
- One accent color, indigo, used sparingly: Critical severity, focus, and the
  active state of a control. Everything else is zinc, on purpose.
