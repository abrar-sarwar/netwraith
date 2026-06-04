#!/usr/bin/env bash
#
# NETWRAITH demo runner.
# It watches the wire so you do not have to. This brings the whole rig up: it
# builds the engine, makes sure a capture exists, replays it to produce alerts,
# then starts the bridge that feeds the dashboard. No root required: replay only.
#
set -euo pipefail

# Resolve the repo root from this script's own location so the demo runs the
# same no matter where it is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

PCAP="captures/demo.pcap"
LOG="engine/netwraith.jsonl"

fail() {
    echo "NETWRAITH demo halted: $1" >&2
    exit 1
}

echo "[ NETWRAITH ] Standing up the demo. It watches the wire so you do not have to."

# Step 1: build the engine.
echo "[ NETWRAITH ] Building the engine ..."
make -C engine \
    || fail "engine build failed. Check that a C toolchain and libpcap headers are installed."

# Step 2: ensure the capture exists. Generate it only if missing.
if [ ! -f "${PCAP}" ]; then
    echo "[ NETWRAITH ] No capture on disk. Forging ${PCAP} ..."
    python3 captures/generate_test_pcap.py \
        || fail "could not generate the demo capture. Is scapy installed (pip install scapy)?"
else
    echo "[ NETWRAITH ] Capture present: ${PCAP}. Using it as-is."
fi

# Step 3: replay the capture through the engine and write alerts to the log.
# The engine appends to the log (correct for a long lived live run), so reset it
# first to keep a one shot replay clean for the reviewer.
echo "[ NETWRAITH ] Replaying the wire. Watching for everything ..."
rm -f "${LOG}"
engine/netwraith -r "${PCAP}" -o "${LOG}" \
    || fail "engine replay failed against ${PCAP}."
echo "[ NETWRAITH ] Replay complete. Alerts written to ${LOG}."

# Step 4: start the bridge. It serves the engine's alerts to the dashboard.
echo "[ NETWRAITH ] Bringing up the bridge. The dashboard will see what the wire saw."
cd bridge || fail "bridge directory is missing."
npm install \
    || fail "npm install failed in bridge/. Check your Node.js install."
npm start \
    || fail "the bridge failed to start."
