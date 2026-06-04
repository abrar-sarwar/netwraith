// detector.cpp - signature engine plus the three stateful heuristics.
#include "detector.h"

#include <algorithm>
#include <cctype>
#include <fstream>
#include <set>
#include <string>

namespace netwraith {

// --- Heuristic thresholds. Engine and capture generator must agree on these. ---

// SYN port scan: distinct destination ports from one source before we call it.
static constexpr int     SCAN_PORT_THRESHOLD   = 15;
// SYN port scan: sliding window, in capture-time milliseconds.
static constexpr int64_t SCAN_WINDOW_MS        = 5000;

// SYN flood: SYNs toward one destination (strictly more than this) before firing.
static constexpr int     FLOOD_SYN_THRESHOLD   = 100;
// SYN flood: sliding window, in capture-time milliseconds.
static constexpr int64_t FLOOD_WINDOW_MS       = 2000;

// ICMP sweep: distinct destinations from one source before we call it.
static constexpr int     SWEEP_DST_THRESHOLD   = 15;
// ICMP sweep: sliding window, in capture-time milliseconds.
static constexpr int64_t SWEEP_WINDOW_MS       = 5000;

// ICMP echo request type, used to scope the sweep heuristic to pings.
static constexpr uint8_t ICMP_ECHO_REQUEST     = 8;

namespace {

const char* proto_name(uint8_t protocol) {
    switch (protocol) {
        case ip_proto::TCP:  return "tcp";
        case ip_proto::UDP:  return "udp";
        case ip_proto::ICMP: return "icmp";
        default:             return "";
    }
}

std::string to_lower(std::string s) {
    for (char& c : s) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }
    return s;
}

std::string trim(const std::string& s) {
    size_t b = 0;
    size_t e = s.size();
    while (b < e && std::isspace(static_cast<unsigned char>(s[b]))) ++b;
    while (e > b && std::isspace(static_cast<unsigned char>(s[e - 1]))) --e;
    return s.substr(b, e - b);
}

Severity parse_severity(const std::string& raw) {
    const std::string s = to_lower(trim(raw));
    if (s == "info")     return Severity::Info;
    if (s == "low")      return Severity::Low;
    if (s == "medium")   return Severity::Medium;
    if (s == "high")     return Severity::High;
    if (s == "critical") return Severity::Critical;
    return Severity::Medium;  // default per spec
}

// Map a string of flag letters (F S R P A U) to a TCP flag bitmask.
uint8_t parse_flags(const std::string& letters) {
    uint8_t mask = 0;
    for (char c : letters) {
        switch (std::toupper(static_cast<unsigned char>(c))) {
            case 'F': mask |= tcp_flag::FIN; break;
            case 'S': mask |= tcp_flag::SYN; break;
            case 'R': mask |= tcp_flag::RST; break;
            case 'P': mask |= tcp_flag::PSH; break;
            case 'A': mask |= tcp_flag::ACK; break;
            case 'U': mask |= tcp_flag::URG; break;
            default: break;  // ignore stray characters
        }
    }
    return mask;
}

// Split a rules line "key=value [key=value ...]" into pairs. Values may be
// double quoted to contain spaces. Hand-rolled so quoting is fully under our
// control; std::quoted is deliberately avoided.
std::vector<std::pair<std::string, std::string>> tokenize(const std::string& line) {
    std::vector<std::pair<std::string, std::string>> pairs;
    size_t i = 0;
    const size_t n = line.size();

    while (i < n) {
        while (i < n && std::isspace(static_cast<unsigned char>(line[i]))) ++i;
        if (i >= n) break;

        // Read the key up to '=' or whitespace.
        std::string key;
        while (i < n && line[i] != '=' &&
               !std::isspace(static_cast<unsigned char>(line[i]))) {
            key.push_back(line[i++]);
        }
        if (key.empty()) {
            ++i;
            continue;
        }
        if (i >= n || line[i] != '=') {
            // Bare token with no '='. Record it with an empty value and move on.
            pairs.emplace_back(key, std::string());
            continue;
        }
        ++i;  // consume '='

        // Read the value: quoted (honoring \" and \\) or a bare run of non-space.
        std::string value;
        if (i < n && line[i] == '"') {
            ++i;  // opening quote
            while (i < n && line[i] != '"') {
                if (line[i] == '\\' && i + 1 < n) {
                    ++i;  // consume the backslash, take the next byte verbatim
                }
                value.push_back(line[i++]);
            }
            if (i < n && line[i] == '"') ++i;  // closing quote
        } else {
            while (i < n && !std::isspace(static_cast<unsigned char>(line[i]))) {
                value.push_back(line[i++]);
            }
        }
        pairs.emplace_back(key, value);
    }
    return pairs;
}

}  // namespace

int Detector::load_rules(const std::string& path) {
    std::ifstream in(path);
    if (!in.is_open()) {
        return -1;
    }

    rules_.clear();
    std::string line;
    while (std::getline(in, line)) {
        const std::string t = trim(line);
        if (t.empty() || t[0] == '#') {
            continue;  // blank line or comment
        }

        Rule rule;
        rule.proto = "any";
        bool saw_flags_key = false;

        for (const auto& kv : tokenize(line)) {
            const std::string& key = kv.first;
            const std::string& val = kv.second;
            if (key == "id") {
                rule.id = val;
            } else if (key == "proto") {
                rule.proto = to_lower(val);
            } else if (key == "dst_port") {
                try {
                    rule.dst_port = std::stoi(val);
                } catch (...) {
                    rule.dst_port = -1;
                }
            } else if (key == "content") {
                rule.content = val;
            } else if (key == "flags") {
                saw_flags_key = true;
                if (val.empty()) {
                    // An empty flags= means "match a NULL-flags TCP packet".
                    rule.match_null = true;
                } else {
                    rule.flags = parse_flags(val);
                }
            } else if (key == "match_null") {
                const std::string lv = to_lower(val);
                rule.match_null = (lv == "true" || lv == "1" || lv == "yes");
            } else if (key == "severity") {
                rule.severity = parse_severity(val);
            } else if (key == "msg") {
                rule.msg = val;
            }
            // Unknown keys are ignored on purpose.
        }
        (void)saw_flags_key;

        if (rule.id.empty()) {
            continue;  // a rule with no id is not usable; skip it
        }
        rules_.push_back(std::move(rule));
    }

    return static_cast<int>(rules_.size());
}

void Detector::run_signatures(const PacketInfo& pkt, std::vector<Alert>& out) const {
    const std::string pname = proto_name(pkt.protocol);

    for (const Rule& rule : rules_) {
        // 1) Protocol filter.
        if (rule.proto != "any" && rule.proto != pname) {
            continue;
        }
        // 2) Destination port filter.
        if (rule.dst_port != -1 && rule.dst_port != static_cast<int>(pkt.dst_port)) {
            continue;
        }
        // 3) Flags filter.
        if (rule.match_null) {
            if (pkt.protocol != ip_proto::TCP || pkt.tcp_flags != 0) {
                continue;
            }
        } else if (rule.flags != 0) {
            if ((pkt.tcp_flags & rule.flags) != rule.flags) {
                continue;
            }
        }
        // 4) Content filter (raw payload byte search).
        if (!rule.content.empty()) {
            if (pkt.payload == nullptr || pkt.payload_len == 0) {
                continue;
            }
            const uint8_t* begin = pkt.payload;
            const uint8_t* end   = pkt.payload + pkt.payload_len;
            const auto found = std::search(
                begin, end,
                reinterpret_cast<const uint8_t*>(rule.content.data()),
                reinterpret_cast<const uint8_t*>(rule.content.data()) +
                    rule.content.size());
            if (found == end) {
                continue;
            }
        }

        Alert a;
        a.rule_id      = rule.id;
        a.msg          = rule.msg;
        a.severity     = rule.severity;
        a.src          = pkt.src_ip + ":" + std::to_string(pkt.src_port);
        a.dst          = pkt.dst_ip + ":" + std::to_string(pkt.dst_port);
        a.proto        = pname;
        a.timestamp_ms = pkt.timestamp_ms;
        a.category     = "signature";
        out.push_back(std::move(a));
    }
}

void Detector::check_syn_scan(const PacketInfo& pkt, std::vector<Alert>& out) {
    // Count only TCP packets with SYN set and ACK clear (a connection attempt,
    // not a handshake reply).
    if (pkt.protocol != ip_proto::TCP) return;
    const bool syn_only = (pkt.tcp_flags & tcp_flag::SYN) &&
                          !(pkt.tcp_flags & tcp_flag::ACK);
    if (!syn_only) return;

    auto& events = syn_scan_[pkt.src_ip];
    events.push_back(Event{pkt.timestamp_ms, pkt.dst_port, std::string()});

    // Prune anything older than the window relative to this packet's timestamp.
    const int64_t cutoff = pkt.timestamp_ms - SCAN_WINDOW_MS;
    while (!events.empty() && events.front().ts_ms < cutoff) {
        events.pop_front();
    }

    // Count distinct destination ports still inside the window.
    std::set<uint16_t> ports;
    for (const Event& e : events) {
        ports.insert(e.port);
    }
    if (static_cast<int>(ports.size()) >= SCAN_PORT_THRESHOLD) {
        Alert a;
        a.rule_id      = "SCAN-SYN";
        a.msg          = pkt.src_ip + " is fanning across ports. SYN scan in progress.";
        a.severity     = Severity::High;
        a.src          = pkt.src_ip + ":" + std::to_string(pkt.src_port);
        a.dst          = pkt.dst_ip + ":" + std::to_string(pkt.dst_port);
        a.proto        = "tcp";
        a.timestamp_ms = pkt.timestamp_ms;
        a.category     = "scan";
        out.push_back(std::move(a));
        syn_scan_.erase(pkt.src_ip);  // reset this source so it does not spam
    }
}

void Detector::check_syn_flood(const PacketInfo& pkt, std::vector<Alert>& out) {
    // Count every TCP packet with SYN set toward a single destination, across
    // all sources.
    if (pkt.protocol != ip_proto::TCP) return;
    if (!(pkt.tcp_flags & tcp_flag::SYN)) return;

    auto& stamps = syn_flood_[pkt.dst_ip];
    stamps.push_back(pkt.timestamp_ms);

    const int64_t cutoff = pkt.timestamp_ms - FLOOD_WINDOW_MS;
    while (!stamps.empty() && stamps.front() < cutoff) {
        stamps.pop_front();
    }

    // Strictly more than the threshold fires.
    if (static_cast<int>(stamps.size()) > FLOOD_SYN_THRESHOLD) {
        Alert a;
        a.rule_id      = "FLOOD-SYN";
        a.msg          = pkt.dst_ip + " is drowning in SYNs. Flood detected.";
        a.severity     = Severity::Critical;
        a.src          = pkt.src_ip + ":" + std::to_string(pkt.src_port);
        a.dst          = pkt.dst_ip + ":" + std::to_string(pkt.dst_port);
        a.proto        = "tcp";
        a.timestamp_ms = pkt.timestamp_ms;
        a.category     = "flood";
        out.push_back(std::move(a));
        syn_flood_.erase(pkt.dst_ip);  // reset this destination so it does not spam
    }
}

void Detector::check_icmp_sweep(const PacketInfo& pkt, std::vector<Alert>& out) {
    if (pkt.protocol != ip_proto::ICMP) return;
    // Scope to echo requests: the first payload byte is the ICMP type.
    if (pkt.payload == nullptr || pkt.payload_len < 1) return;
    if (pkt.payload[0] != ICMP_ECHO_REQUEST) return;

    auto& events = icmp_sweep_[pkt.src_ip];
    events.push_back(Event{pkt.timestamp_ms, 0, pkt.dst_ip});

    const int64_t cutoff = pkt.timestamp_ms - SWEEP_WINDOW_MS;
    while (!events.empty() && events.front().ts_ms < cutoff) {
        events.pop_front();
    }

    std::set<std::string> dsts;
    for (const Event& e : events) {
        dsts.insert(e.dst_ip);
    }
    if (static_cast<int>(dsts.size()) >= SWEEP_DST_THRESHOLD) {
        Alert a;
        a.rule_id      = "SWEEP-ICMP";
        a.msg          = pkt.src_ip + " is pinging the neighborhood. ICMP sweep.";
        a.severity     = Severity::Medium;
        a.src          = pkt.src_ip + ":0";
        a.dst          = pkt.dst_ip + ":0";
        a.proto        = "icmp";
        a.timestamp_ms = pkt.timestamp_ms;
        a.category     = "anomaly";
        out.push_back(std::move(a));
        icmp_sweep_.erase(pkt.src_ip);  // reset this source so it does not spam
    }
}

std::vector<Alert> Detector::inspect(const PacketInfo& pkt) {
    std::vector<Alert> alerts;
    run_signatures(pkt, alerts);
    check_syn_scan(pkt, alerts);
    check_syn_flood(pkt, alerts);
    check_icmp_sweep(pkt, alerts);
    return alerts;
}

}  // namespace netwraith
