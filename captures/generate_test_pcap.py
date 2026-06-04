#!/usr/bin/env python3
"""
NETWRAITH demo capture generator.

It watches the wire so you do not have to. This script forges the wire for it.

Writes captures/demo.pcap: a single, deterministic capture that exercises every
NETWRAITH detection at least once. Frames are full Ethernet (Ether/IP/...) so the
pcap link type is EN10MB, and every packet's timestamp is set explicitly so each
burst lands cleanly inside its detection window:

  - signature rules: single packets carrying a known-bad payload or scan flag combo
  - SCAN-SYN:  15+ distinct destination ports inside a 5 s window
  - FLOOD-SYN: 100+ SYN packets to one destination inside a 2 s window
  - SWEEP-ICMP: 15+ distinct destinations inside a 5 s window

Run with: python3 generate_test_pcap.py   (assuming scapy is installed)
"""

import os

from scapy.all import Ether, IP, TCP, UDP, ICMP, Raw, wrpcap

# Output lands next to this script regardless of the working directory.
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(HERE, "demo.pcap")

# A fixed epoch base keeps the capture byte-for-byte reproducible across runs.
# 2026-06-01 00:00:00 UTC.
BASE = 1748736000.0

# A stable MAC for both ends. Content is what the engine inspects, not the L2 addr.
SRC_MAC = "02:00:00:00:00:01"
DST_MAC = "02:00:00:00:00:02"

packets = []


def emit(pkt, when):
    """Stamp a packet's capture time and queue it for the pcap."""
    pkt.time = when
    packets.append(pkt)


# ---------------------------------------------------------------------------
# Signature singles.
# Each one trips a single content or flag signature rule. Times are scattered a
# few seconds apart so nothing here looks like a burst to the rate detectors.
# ---------------------------------------------------------------------------

# Signature: HTTP SQL injection. Payload carries the classic ' OR '1'='1 tautology.
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.10", dst="192.0.2.80")
    / TCP(sport=40000, dport=80, flags="PA", seq=1000)
    / Raw(load=b"GET /login?user=admin' OR '1'='1 HTTP/1.1\r\nHost: target\r\n\r\n"),
    BASE + 0,
)

# Signature: directory traversal. Payload carries ../../ path climbing.
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.11", dst="192.0.2.80")
    / TCP(sport=40001, dport=80, flags="PA", seq=2000)
    / Raw(load=b"GET /static/../../../../etc/passwd HTTP/1.1\r\nHost: target\r\n\r\n"),
    BASE + 1,
)

# Signature: shell string. Payload carries /bin/sh.
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.12", dst="192.0.2.81")
    / TCP(sport=40002, dport=80, flags="PA", seq=3000)
    / Raw(load=b"POST /upload HTTP/1.1\r\nHost: target\r\n\r\ncmd=/bin/sh -i\r\n"),
    BASE + 2,
)

# Signature: EICAR. Payload is the standard antivirus test string (not malware).
EICAR = (
    rb"X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
)
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.13", dst="192.0.2.81")
    / TCP(sport=40003, dport=8080, flags="PA", seq=4000)
    / Raw(load=EICAR),
    BASE + 3,
)

# Signature: XMAS scan. FIN, PSH and URG all lit, no payload.
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.14", dst="198.51.100.7")
    / TCP(sport=40004, dport=3389, flags="FPU", seq=5000),
    BASE + 4,
)

# Signature: NULL scan. No flags set at all, no payload.
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.15", dst="198.51.100.7")
    / TCP(sport=40005, dport=3389, flags=0, seq=6000),
    BASE + 5,
)

# Signature: FIN scan. FIN only, no payload.
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.16", dst="198.51.100.7")
    / TCP(sport=40006, dport=3389, flags="F", seq=7000),
    BASE + 6,
)

# Signature: lone ICMP echo request. Exercises the icmp signature rule.
emit(
    Ether(src=SRC_MAC, dst=DST_MAC)
    / IP(src="10.0.0.99", dst="198.51.100.50")
    / ICMP(type=8, code=0)
    / Raw(load=b"netwraith-icmp-probe"),
    BASE + 7,
)

# ---------------------------------------------------------------------------
# SYN flood burst. Trips FLOOD-SYN.
# 130 bare SYN packets at a single destination from 130 varied sources, all
# within a ~1.5 s span (well inside the 2 s flood window). Placed near base+10s.
# ---------------------------------------------------------------------------
FLOOD_BASE = BASE + 10.0
FLOOD_COUNT = 130
for i in range(FLOOD_COUNT):
    src_ip = "100.64.0.%d" % (i + 1)  # 100.64.0.1 .. 100.64.0.130
    when = FLOOD_BASE + (i * (1.5 / FLOOD_COUNT))  # spread across ~1.5 s
    emit(
        Ether(src=SRC_MAC, dst=DST_MAC)
        / IP(src=src_ip, dst="203.0.113.5")
        / TCP(sport=50000 + i, dport=80, flags="S", seq=10000 + i),
        when,
    )

# ---------------------------------------------------------------------------
# SYN port scan burst. Trips SCAN-SYN.
# 20 SYN packets from one source to one destination across 20 distinct ports
# (1000..1019), all within a ~0.5 s span (inside the 5 s scan window).
# Placed near base+30s so it does not overlap the flood window.
# ---------------------------------------------------------------------------
SCAN_BASE = BASE + 30.0
SCAN_COUNT = 20
for i in range(SCAN_COUNT):
    dport = 1000 + i  # 1000 .. 1019, 20 distinct ports
    when = SCAN_BASE + (i * (0.5 / SCAN_COUNT))  # spread across ~0.5 s
    emit(
        Ether(src=SRC_MAC, dst=DST_MAC)
        / IP(src="10.0.0.50", dst="198.51.100.10")
        / TCP(sport=51000 + i, dport=dport, flags="S", seq=20000 + i),
        when,
    )

# ---------------------------------------------------------------------------
# ICMP sweep. Trips SWEEP-ICMP.
# 20 echo requests from one source to 20 distinct destinations
# (192.0.2.1 .. 192.0.2.20), all within a ~0.5 s span (inside the 5 s window).
# Placed near base+50s so it does not overlap the scan window.
# ---------------------------------------------------------------------------
SWEEP_BASE = BASE + 50.0
SWEEP_COUNT = 20
for i in range(SWEEP_COUNT):
    dst_ip = "192.0.2.%d" % (i + 1)  # 192.0.2.1 .. 192.0.2.20
    when = SWEEP_BASE + (i * (0.5 / SWEEP_COUNT))  # spread across ~0.5 s
    emit(
        Ether(src=SRC_MAC, dst=DST_MAC)
        / IP(src="10.0.0.77", dst=dst_ip)
        / ICMP(type=8, code=0, id=0x4242, seq=i)
        / Raw(load=b"sweep"),
        when,
    )

# ---------------------------------------------------------------------------
# Write it out. Order by timestamp so the capture reads in wire order.
# ---------------------------------------------------------------------------
packets.sort(key=lambda p: float(p.time))
wrpcap(OUT_PATH, packets)

print(
    "NETWRAITH demo capture written: %d packets -> %s"
    % (len(packets), OUT_PATH)
)
