// netwraith.h - shared types for the NETWRAITH detection engine.
// It watches the wire so you do not have to.
#ifndef NETWRAITH_H
#define NETWRAITH_H

#include <cstdint>
#include <string>

namespace netwraith {

// Severity ladder. Lowercase string forms cross the data contract to the bridge.
enum class Severity { Info, Low, Medium, High, Critical };

// Map a severity to its lowercase JSON string ("info".."critical").
inline const char* severity_to_string(Severity s) {
    switch (s) {
        case Severity::Info:     return "info";
        case Severity::Low:      return "low";
        case Severity::Medium:   return "medium";
        case Severity::High:     return "high";
        case Severity::Critical: return "critical";
    }
    return "info";
}

// TCP flag bits, matching the on-the-wire layout of the TCP flags byte.
namespace tcp_flag {
    constexpr uint8_t FIN = 0x01;
    constexpr uint8_t SYN = 0x02;
    constexpr uint8_t RST = 0x04;
    constexpr uint8_t PSH = 0x08;
    constexpr uint8_t ACK = 0x10;
    constexpr uint8_t URG = 0x20;
}

// IP protocol numbers we care about.
namespace ip_proto {
    constexpr uint8_t ICMP = 1;
    constexpr uint8_t TCP  = 6;
    constexpr uint8_t UDP  = 17;
}

// One parsed packet. The payload pointer is non-owning and points into the
// capture buffer handed to the parser; it is valid only for the inspect call.
struct PacketInfo {
    std::string   src_ip;
    std::string   dst_ip;
    uint16_t      src_port   = 0;
    uint16_t      dst_port   = 0;
    uint8_t       protocol   = 0;   // ip_proto::TCP / UDP / ICMP
    uint8_t       tcp_flags  = 0;   // 0 for non-TCP
    uint32_t      payload_len = 0;
    const uint8_t* payload   = nullptr;  // non-owning
    int64_t       timestamp_ms = 0;      // epoch ms from the pcap header
};

// A signature rule loaded from the rules file.
struct Rule {
    std::string id;
    std::string proto;               // "tcp" | "udp" | "icmp" | "any"
    int         dst_port = -1;       // -1 means any
    std::string content;             // empty means no content match
    uint8_t     flags = 0;           // required TCP flags mask
    bool        match_null = false;  // true matches a TCP packet with zero flags
    Severity    severity = Severity::Medium;
    std::string msg;
};

// An alert ready to be emitted. Mirrors the data contract field set.
struct Alert {
    std::string rule_id;
    std::string msg;
    Severity    severity = Severity::Info;
    std::string src;        // "ip:port"
    std::string dst;        // "ip:port"
    std::string proto;      // "tcp" | "udp" | "icmp"
    int64_t     timestamp_ms = 0;
    std::string category;   // "signature" | "scan" | "flood" | "anomaly"
};

}  // namespace netwraith

#endif  // NETWRAITH_H
