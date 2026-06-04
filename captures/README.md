# captures

`demo.pcap` is a hand-built capture that exercises every NETWRAITH detection at
least once: the signature rules (SQL injection, directory traversal, a shell
string, EICAR, and the XMAS, NULL and FIN scan flag combinations, plus a lone
ICMP echo), the SYN port scan detector, the SYN flood detector, and the ICMP
sweep detector. Every packet is a full Ethernet frame and every timestamp is set
on purpose so each burst lands inside the window its detector is watching.

It is committed to the repository on purpose. Replaying a capture needs no root
and no special interface, so this is the recommended way to watch NETWRAITH work:
point the engine at the file and read the alerts it returns.

```
engine/netwraith -r captures/demo.pcap -o engine/netwraith.jsonl
```

To regenerate it from scratch (scapy required), run:

```
python3 captures/generate_test_pcap.py
```

The generator is deterministic. It uses a fixed time base, so a fresh run
produces the same capture every time.
