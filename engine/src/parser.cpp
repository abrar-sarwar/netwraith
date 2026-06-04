// parser.cpp - decode frames into PacketInfo with bounds checks at every layer.
#include "parser.h"

#include <arpa/inet.h>
#include <pcap/pcap.h>

#include <cstring>

namespace netwraith {

namespace {

// We define our own packed headers and memcpy into them rather than casting the
// capture buffer to a struct pointer. That keeps us honest about alignment and
// independent of whatever the platform headers happen to lay out.

#pragma pack(push, 1)

struct EthHeader {
    uint8_t  dst[6];
    uint8_t  src[6];
    uint16_t ethertype;  // network byte order
};

// Linux "cooked" capture header (DLT_LINUX_SLL), 16 bytes.
struct SllHeader {
    uint16_t packet_type;
    uint16_t arphrd_type;
    uint16_t addr_len;
    uint8_t  addr[8];
    uint16_t protocol;   // network byte order, an EtherType for IP
};

struct Ipv4Header {
    uint8_t  ver_ihl;        // high nibble version, low nibble IHL (32-bit words)
    uint8_t  tos;
    uint16_t total_len;
    uint16_t id;
    uint16_t flags_frag;
    uint8_t  ttl;
    uint8_t  protocol;
    uint16_t checksum;
    uint32_t src_addr;       // network byte order
    uint32_t dst_addr;       // network byte order
};

struct TcpHeader {
    uint16_t src_port;       // network byte order
    uint16_t dst_port;       // network byte order
    uint32_t seq;
    uint32_t ack;
    uint8_t  data_offset;    // high nibble is data offset in 32-bit words
    uint8_t  flags;          // FIN/SYN/RST/PSH/ACK/URG in the low six bits
    uint16_t window;
    uint16_t checksum;
    uint16_t urg_ptr;
};

struct UdpHeader {
    uint16_t src_port;       // network byte order
    uint16_t dst_port;       // network byte order
    uint16_t length;
    uint16_t checksum;
};

#pragma pack(pop)

constexpr uint16_t ETHERTYPE_IPV4 = 0x0800;

// Decode the IPv4 datagram (and its L4 payload) starting at ip_ptr. l3_len is
// the number of captured bytes available from ip_ptr onward.
bool parse_ipv4(const uint8_t* ip_ptr, uint32_t l3_len, PacketInfo& out) {
    if (l3_len < sizeof(Ipv4Header)) {
        return false;  // not even a fixed IPv4 header captured
    }

    Ipv4Header ip{};
    std::memcpy(&ip, ip_ptr, sizeof(ip));

    const uint8_t version = ip.ver_ihl >> 4;
    if (version != 4) {
        return false;
    }

    const uint32_t ihl_bytes = static_cast<uint32_t>(ip.ver_ihl & 0x0F) * 4;
    if (ihl_bytes < sizeof(Ipv4Header) || ihl_bytes > l3_len) {
        return false;  // bogus IHL or header runs past the captured bytes
    }

    char src_buf[INET_ADDRSTRLEN];
    char dst_buf[INET_ADDRSTRLEN];
    if (inet_ntop(AF_INET, &ip.src_addr, src_buf, sizeof(src_buf)) == nullptr ||
        inet_ntop(AF_INET, &ip.dst_addr, dst_buf, sizeof(dst_buf)) == nullptr) {
        return false;
    }
    out.src_ip.assign(src_buf);
    out.dst_ip.assign(dst_buf);
    out.protocol = ip.protocol;

    const uint8_t* l4_ptr = ip_ptr + ihl_bytes;
    const uint32_t l4_len = l3_len - ihl_bytes;

    if (ip.protocol == ip_proto::TCP) {
        if (l4_len < sizeof(TcpHeader)) {
            return false;
        }
        TcpHeader tcp{};
        std::memcpy(&tcp, l4_ptr, sizeof(tcp));

        const uint32_t doff_bytes = static_cast<uint32_t>(tcp.data_offset >> 4) * 4;
        if (doff_bytes < sizeof(TcpHeader) || doff_bytes > l4_len) {
            return false;  // bogus data offset or options run past capture
        }

        out.src_port  = ntohs(tcp.src_port);
        out.dst_port  = ntohs(tcp.dst_port);
        out.tcp_flags = tcp.flags & 0x3F;  // low six bits are the flags we track
        out.payload      = l4_ptr + doff_bytes;
        out.payload_len  = l4_len - doff_bytes;
        return true;
    }

    if (ip.protocol == ip_proto::UDP) {
        if (l4_len < sizeof(UdpHeader)) {
            return false;
        }
        UdpHeader udp{};
        std::memcpy(&udp, l4_ptr, sizeof(udp));

        out.src_port  = ntohs(udp.src_port);
        out.dst_port  = ntohs(udp.dst_port);
        out.tcp_flags = 0;
        out.payload      = l4_ptr + sizeof(UdpHeader);
        out.payload_len  = l4_len - sizeof(UdpHeader);
        return true;
    }

    if (ip.protocol == ip_proto::ICMP) {
        // ICMP has no ports. We still verify a minimal 8-byte ICMP header so a
        // truncated frame does not present a bogus zero-length payload as valid.
        constexpr uint32_t ICMP_MIN = 8;
        if (l4_len < ICMP_MIN) {
            return false;
        }
        out.src_port  = 0;
        out.dst_port  = 0;
        out.tcp_flags = 0;
        out.payload      = l4_ptr;
        out.payload_len  = l4_len;
        return true;
    }

    return false;  // not TCP, UDP, or ICMP
}

}  // namespace

bool parse_packet(const uint8_t* data, uint32_t caplen, int linktype,
                  int64_t ts_ms, PacketInfo& out) {
    if (data == nullptr) {
        return false;
    }

    out = PacketInfo{};
    out.timestamp_ms = ts_ms;

    const uint8_t* ip_ptr = nullptr;
    uint32_t       l3_len = 0;

    switch (linktype) {
        case DLT_EN10MB: {  // standard Ethernet, 14-byte header
            if (caplen < sizeof(EthHeader)) {
                return false;
            }
            EthHeader eth{};
            std::memcpy(&eth, data, sizeof(eth));
            if (ntohs(eth.ethertype) != ETHERTYPE_IPV4) {
                return false;  // not IPv4 (VLAN tags, IPv6, ARP, etc.)
            }
            ip_ptr = data + sizeof(EthHeader);
            l3_len = caplen - sizeof(EthHeader);
            break;
        }
        case DLT_LINUX_SLL: {  // Linux cooked capture, 16-byte header
            if (caplen < sizeof(SllHeader)) {
                return false;
            }
            SllHeader sll{};
            std::memcpy(&sll, data, sizeof(sll));
            if (ntohs(sll.protocol) != ETHERTYPE_IPV4) {
                return false;
            }
            ip_ptr = data + sizeof(SllHeader);
            l3_len = caplen - sizeof(SllHeader);
            break;
        }
        case DLT_RAW: {  // no link header, datagram starts at the IPv4 header
            ip_ptr = data;
            l3_len = caplen;
            break;
        }
        default:
            return false;  // link type we do not decode
    }

    return parse_ipv4(ip_ptr, l3_len, out);
}

}  // namespace netwraith
