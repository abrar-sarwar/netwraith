// detector.h - signature matching plus stateful heuristics for NETWRAITH.
#ifndef NETWRAITH_DETECTOR_H
#define NETWRAITH_DETECTOR_H

#include <cstdint>
#include <deque>
#include <map>
#include <string>
#include <vector>

#include "netwraith.h"

namespace netwraith {

// The detector owns every byte of its state in member fields. Encapsulating the
// heuristic windows in the class (rather than leaning on function-local statics)
// is the clean design: the lifetime is explicit, the state is testable, and a
// second detector instance never collides with the first.
class Detector {
public:
    // Parse the rules file at path. Returns the number of rules loaded, or -1 if
    // the file cannot be opened. Malformed individual lines are skipped.
    int load_rules(const std::string& path);

    // Inspect one packet: run every loaded signature, then the three heuristics.
    // Returns zero or more alerts. The detector mutates its own window state, so
    // it must be called from a single thread (the capture thread).
    std::vector<Alert> inspect(const PacketInfo& pkt);

    size_t rule_count() const { return rules_.size(); }

private:
    // A timestamped observation used by the sliding-window heuristics.
    struct Event {
        int64_t     ts_ms;
        uint16_t    port;    // SYN-scan: destination port
        std::string dst_ip;  // ICMP-sweep: destination IP
    };

    std::vector<Rule> rules_;

    // SYN port scan: per source IP, the recent distinct-port SYN observations.
    std::map<std::string, std::deque<Event>> syn_scan_;
    // SYN flood: per destination IP, the recent SYN timestamps from all sources.
    std::map<std::string, std::deque<int64_t>> syn_flood_;
    // ICMP sweep: per source IP, the recent distinct-destination echo requests.
    std::map<std::string, std::deque<Event>> icmp_sweep_;

    void run_signatures(const PacketInfo& pkt, std::vector<Alert>& out) const;
    void check_syn_scan(const PacketInfo& pkt, std::vector<Alert>& out);
    void check_syn_flood(const PacketInfo& pkt, std::vector<Alert>& out);
    void check_icmp_sweep(const PacketInfo& pkt, std::vector<Alert>& out);
};

}  // namespace netwraith

#endif  // NETWRAITH_DETECTOR_H
