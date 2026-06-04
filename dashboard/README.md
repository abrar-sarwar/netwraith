# NETWRAITH Dashboard

It watches the wire so you do not have to.

This is the surface. A quiet, dark console that renders what the engine sees:
live alerts, severity counts, the loudest sources, and the category split. It
does not capture packets and it does not reason about them. It listens to the
bridge and shows you the result.

## What it talks to

The dashboard reads from the bridge over two channels:

- REST, for backfill and authoritative stats:
  - `GET /api/alerts` for the current ring buffer, newest first.
  - `GET /api/stats` for totals, severity, category, and top talkers.
- WebSocket, for the live stream:
  - a `snapshot` message on connect, then one `alert` message per new line.

If the bridge is down, the live indicator dims, the feed states that it is
waiting for the engine, and nothing breaks. It reconnects on its own.

## Configure

Copy the example env file and adjust if the bridge does not live on the
defaults.

```
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_BRIDGE_URL=http://localhost:4317
NEXT_PUBLIC_BRIDGE_WS=ws://localhost:4317
```

## Run

```
npm install
npm run dev
```

Then open http://localhost:3000. Start the engine and the bridge alongside it
and the feed fills as the wire speaks.

## Build

```
npm run build
npm start
```

## Notes

- Dark mode is the default and only intended experience.
- The rendered feed is capped at 200 rows. The wire never stops; the screen has
  limits.
- One accent color, indigo, used sparingly: the live dot and Critical severity.
  Everything else is zinc, on purpose.
