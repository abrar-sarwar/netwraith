// parser.h - link-layer and L3/L4 decode for NETWRAITH.
// Hand-rolled, bounds-checked, no reliance on platform header offsets.
#ifndef NETWRAITH_PARSER_H
#define NETWRAITH_PARSER_H

#include <cstdint>

#include "netwraith.h"

namespace netwraith {

// Decode one captured frame into out.
//
//   data      pointer to the captured bytes
//   caplen    number of bytes actually captured (may be < the wire length)
//   linktype  pcap DLT_* link type of the capture
//   ts_ms     capture timestamp, already in epoch milliseconds
//   out       filled in on success
//
// Returns true only for IPv4 frames carrying TCP, UDP, or ICMP that survive
// every bounds check. Any truncation or unsupported encapsulation returns false.
bool parse_packet(const uint8_t* data, uint32_t caplen, int linktype,
                  int64_t ts_ms, PacketInfo& out);

}  // namespace netwraith

#endif  // NETWRAITH_PARSER_H
