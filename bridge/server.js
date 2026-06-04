// NETWRAITH bridge.
// It watches the wire so you do not have to.
//
// This service tails the engine's JSON Lines log and relays it to the
// dashboard: a snapshot on connect, live alerts as they land, and two
// REST endpoints for backfill and aggregate stats. Minimal moving parts,
// one dependency (ws), and a poll loop that does not flinch when the log
// is rotated out from under it.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Configuration -------------------------------------------------------

const DEFAULT_LOG = path.resolve(__dirname, "..", "engine", "netwraith.jsonl");
const LOG_PATH = process.env.NETWRAITH_LOG
  ? path.resolve(process.env.NETWRAITH_LOG)
  : DEFAULT_LOG;
const PORT = Number.parseInt(process.env.PORT || "4317", 10);
const RING_CAPACITY = 500; // most recent N alerts retained for instant backfill
const POLL_INTERVAL_MS = 250;

// ---- In-memory state -----------------------------------------------------

// Ring buffer of recent alerts, stored oldest-first internally so appends
// are cheap. We emit newest-first by reversing on read.
const ring = [];

function pushAlert(alert) {
  ring.push(alert);
  if (ring.length > RING_CAPACITY) {
    ring.splice(0, ring.length - RING_CAPACITY);
  }
}

// Returns a newest-first copy of the ring buffer.
function snapshotNewestFirst() {
  return ring.slice().reverse();
}

// ---- Tailer --------------------------------------------------------------
//
// We poll the file size on an interval and read whatever bytes have been
// appended since last time. If the file shrinks (truncated or replaced),
// we reset our read offset to zero and re-read from the top. Partial trailing
// lines are buffered until their terminating newline arrives.

let readOffset = 0;
let lineBuffer = "";
let pollTimer = null;

function handleBytes(chunk) {
  lineBuffer += chunk;
  let newlineIndex;
  while ((newlineIndex = lineBuffer.indexOf("\n")) !== -1) {
    const rawLine = lineBuffer.slice(0, newlineIndex);
    lineBuffer = lineBuffer.slice(newlineIndex + 1);
    const line = rawLine.replace(/\r$/, "").trim();
    if (line.length === 0) continue;
    let alert;
    try {
      alert = JSON.parse(line);
    } catch {
      // Malformed or partial line: skip it without taking down the tailer.
      continue;
    }
    if (alert === null || typeof alert !== "object" || Array.isArray(alert)) {
      continue;
    }
    pushAlert(alert);
    broadcastAlert(alert);
  }
}

function pollOnce() {
  fs.stat(LOG_PATH, (statErr, stats) => {
    if (statErr) {
      // File not present yet (or vanished). Wait and retry on the next tick.
      // Reset offset so that when it reappears we read from the beginning.
      if (statErr.code === "ENOENT") {
        readOffset = 0;
        lineBuffer = "";
      }
      return;
    }

    const size = stats.size;

    if (size < readOffset) {
      // Truncated or replaced with a shorter file. Start over from the top.
      readOffset = 0;
      lineBuffer = "";
    }

    if (size === readOffset) {
      return; // nothing new
    }

    const stream = fs.createReadStream(LOG_PATH, {
      start: readOffset,
      end: size - 1,
      encoding: "utf8",
    });

    let assembled = "";
    stream.on("data", (d) => {
      assembled += d;
    });
    stream.on("error", () => {
      // Read failed (rotation race, permissions, etc). Leave offset alone and
      // try again next tick.
    });
    stream.on("end", () => {
      readOffset = size;
      handleBytes(assembled);
    });
  });
}

function startTailer() {
  // Prime any already-present content, then poll for appends.
  pollOnce();
  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
}

// ---- WebSocket -----------------------------------------------------------

function broadcastAlert(alert) {
  if (!wss) return;
  const payload = JSON.stringify({ type: "alert", alert });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

// ---- Stats ---------------------------------------------------------------

function computeStats() {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byCategory = { signature: 0, scan: 0, flood: 0, anomaly: 0 };
  const talkerCounts = new Map();

  for (const alert of ring) {
    const sev = alert.severity;
    if (Object.prototype.hasOwnProperty.call(bySeverity, sev)) {
      bySeverity[sev] += 1;
    }
    const cat = alert.category;
    if (Object.prototype.hasOwnProperty.call(byCategory, cat)) {
      byCategory[cat] += 1;
    }
    const src = alert.src;
    if (typeof src === "string" && src.length > 0) {
      // Strip the trailing ":port". Aggregate by source IP only.
      const colon = src.lastIndexOf(":");
      const ip = colon === -1 ? src : src.slice(0, colon);
      talkerCounts.set(ip, (talkerCounts.get(ip) || 0) + 1);
    }
  }

  const topTalkers = [...talkerCounts.entries()]
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: ring.length,
    by_severity: bySeverity,
    by_category: byCategory,
    top_talkers: topTalkers,
  };
}

// ---- HTTP ----------------------------------------------------------------

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && LOCALHOST_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    // No origin (curl) or non-localhost: permit localhost dev broadly.
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, body) {
  const text = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

const server = http.createServer((req, res) => {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/alerts") {
    sendJson(res, 200, { alerts: snapshotNewestFirst() });
    return;
  }

  if (req.method === "GET" && pathname === "/api/stats") {
    sendJson(res, 200, computeStats());
    return;
  }

  sendJson(res, 404, { error: "not found", path: pathname });
});

// ---- WebSocket server (shares the HTTP server) ---------------------------

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  // One snapshot on connect, newest-first, then live alerts via broadcast.
  const snapshot = JSON.stringify({
    type: "snapshot",
    alerts: snapshotNewestFirst(),
  });
  socket.send(snapshot);
});

// ---- Boot ----------------------------------------------------------------

server.listen(PORT, () => {
  // Quiet and matter of fact.
  console.log(`NETWRAITH bridge online. Port ${PORT}.`);
  console.log(`Watching the wire: ${LOG_PATH}`);
  if (!fs.existsSync(LOG_PATH)) {
    console.log("Log not present yet. Holding position until it appears.");
  }
  startTailer();
});

function shutdown() {
  console.log("NETWRAITH bridge standing down.");
  if (pollTimer) clearInterval(pollTimer);
  for (const client of wss.clients) {
    try {
      client.close();
    } catch {
      // ignore
    }
  }
  server.close(() => process.exit(0));
  // Failsafe: do not hang on lingering sockets.
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
