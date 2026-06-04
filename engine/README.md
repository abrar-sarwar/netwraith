# NETWRAITH Engine

It watches the wire so you do not have to.

The engine is the sensor: it pulls frames off an interface or a capture file,
decodes IPv4 TCP/UDP/ICMP, runs signature rules and three stateful heuristics
(SYN scan, SYN flood, ICMP sweep), and writes alerts as JSON Lines for the
bridge to serve.

## Build

With make:

```
make
```

That produces a `netwraith` binary in this directory. To start clean:

```
make clean && make
```

A CMake build is also provided:

```
cmake -B build && cmake --build build
```

The only external dependency is libpcap. If CMake cannot find it, the error
message names the install command for your platform.

## Run

Replay a capture file at full speed (no privileges required):

```
./netwraith -r capture.pcap -o netwraith.jsonl
```

Watch a live interface:

```
./netwraith -i en0 -o netwraith.jsonl
```

With neither `-i` nor `-r`, the engine auto-selects the first non-loopback
device.

Other flags:

- `-f <BPF filter>` apply a Berkeley Packet Filter (for example `tcp or icmp`)
- `-c <rules file>` signature rules (default `rules/default.rules`)
- `-o <jsonl out>` alert output path (default `netwraith.jsonl`)
- `-h` help

Stop a live session with Ctrl-C. The engine drains its queue, then prints a
short summary: packets seen and alerts fired by severity.

## Live capture privileges

Raw capture needs elevated rights. On Linux, grant the binary the capability
once instead of running the whole thing as root:

```
sudo setcap cap_net_raw,cap_net_admin+eip ./netwraith
```

On macOS, run with `sudo` or ensure your user can open BPF devices. If a live
open fails, the engine tells you exactly this and prints the setcap line.
