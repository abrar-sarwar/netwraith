// main.cpp - NETWRAITH entry point: capture, detect, emit.
// It watches the wire so you do not have to.
#include <pcap/pcap.h>

#include <atomic>
#include <condition_variable>
#include <csignal>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <deque>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "detector.h"
#include "emitter.h"
#include "netwraith.h"
#include "parser.h"

using namespace netwraith;

namespace {

// --- Global capture handle for the signal handler to break out of the loop. ---
pcap_t* g_handle = nullptr;

void on_signal(int) {
    if (g_handle != nullptr) {
        pcap_breakloop(g_handle);
    }
}

// --- Thread-safe alert queue handing work from capture to the worker. ---
class AlertQueue {
public:
    void push(std::vector<Alert>&& alerts) {
        if (alerts.empty()) return;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            for (auto& a : alerts) {
                queue_.push_back(std::move(a));
            }
        }
        cv_.notify_one();
    }

    // Signal the worker that no more alerts will arrive.
    void close() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            closed_ = true;
        }
        cv_.notify_all();
    }

    // Block until an alert is available or the queue is closed and drained.
    // Returns false only when closed and empty.
    bool pop(Alert& out) {
        std::unique_lock<std::mutex> lock(mutex_);
        cv_.wait(lock, [this] { return !queue_.empty() || closed_; });
        if (queue_.empty()) {
            return false;  // closed and drained
        }
        out = std::move(queue_.front());
        queue_.pop_front();
        return true;
    }

private:
    std::mutex              mutex_;
    std::condition_variable cv_;
    std::deque<Alert>       queue_;
    bool                    closed_ = false;
};

// --- State shared with the pcap callback. ---
struct CaptureContext {
    Detector*          detector = nullptr;
    AlertQueue*        queue    = nullptr;
    int                linktype = 0;
    std::atomic<uint64_t> packets{0};
};

void packet_callback(u_char* user, const struct pcap_pkthdr* hdr,
                     const u_char* bytes) {
    auto* ctx = reinterpret_cast<CaptureContext*>(user);
    ctx->packets.fetch_add(1, std::memory_order_relaxed);

    // pcap timestamps are seconds + microseconds. Fold to epoch milliseconds.
    const int64_t ts_ms = static_cast<int64_t>(hdr->ts.tv_sec) * 1000 +
                          static_cast<int64_t>(hdr->ts.tv_usec) / 1000;

    PacketInfo pkt;
    if (!parse_packet(reinterpret_cast<const uint8_t*>(bytes), hdr->caplen,
                      ctx->linktype, ts_ms, pkt)) {
        return;  // not an IPv4 TCP/UDP/ICMP frame, or truncated
    }

    // The detector lives only on this thread, so its state needs no lock.
    std::vector<Alert> alerts = ctx->detector->inspect(pkt);
    if (!alerts.empty()) {
        ctx->queue->push(std::move(alerts));
    }
}

void print_help(const char* prog) {
    std::cout
        << "NETWRAITH - it watches the wire so you do not have to.\n\n"
        << "Usage: " << prog << " [options]\n"
        << "  -i <interface>   capture live from this interface\n"
        << "  -r <pcap file>   replay a capture file at full speed\n"
        << "  -f <BPF filter>  apply a Berkeley Packet Filter expression\n"
        << "  -c <rules file>  signature rules (default rules/default.rules)\n"
        << "  -o <jsonl out>   alert output path (default netwraith.jsonl)\n"
        << "  -h               show this help and exit\n\n"
        << "With neither -i nor -r, the first non-loopback device is selected.\n";
}

// Pick the first non-loopback device, or empty on failure.
std::string auto_select_device() {
    char errbuf[PCAP_ERRBUF_SIZE] = {0};
    pcap_if_t* devs = nullptr;
    if (pcap_findalldevs(&devs, errbuf) != 0 || devs == nullptr) {
        return std::string();
    }
    std::string chosen;
    for (pcap_if_t* d = devs; d != nullptr; d = d->next) {
        if (d->flags & PCAP_IF_LOOPBACK) continue;
        if (d->name != nullptr) {
            chosen = d->name;
            break;
        }
    }
    // Fall back to whatever the first named device is if all looked loopback.
    if (chosen.empty()) {
        for (pcap_if_t* d = devs; d != nullptr; d = d->next) {
            if (d->name != nullptr) {
                chosen = d->name;
                break;
            }
        }
    }
    pcap_freealldevs(devs);
    return chosen;
}

}  // namespace

int main(int argc, char** argv) {
    std::string iface;
    std::string pcap_file;
    std::string bpf_filter;
    std::string rules_path = "rules/default.rules";
    std::string out_path   = "netwraith.jsonl";
    bool rules_explicit    = false;

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        auto need_value = [&](const char* flag) -> const char* {
            if (i + 1 >= argc) {
                std::cerr << "NETWRAITH: " << flag << " requires a value.\n";
                std::exit(2);
            }
            return argv[++i];
        };
        if (arg == "-i") {
            iface = need_value("-i");
        } else if (arg == "-r") {
            pcap_file = need_value("-r");
        } else if (arg == "-f") {
            bpf_filter = need_value("-f");
        } else if (arg == "-c") {
            rules_path = need_value("-c");
            rules_explicit = true;
        } else if (arg == "-o") {
            out_path = need_value("-o");
        } else if (arg == "-h" || arg == "--help") {
            print_help(argv[0]);
            return 0;
        } else {
            std::cerr << "NETWRAITH: unknown argument '" << arg << "'.\n";
            print_help(argv[0]);
            return 2;
        }
    }

    // Load detection rules. A missing file is fatal; an empty one is allowed
    // (heuristics still run). When -c is not given, the default file is resolved
    // first in the current directory, then next to the executable, so running
    // "engine/netwraith" from the repo root finds engine/rules/default.rules.
    Detector detector;
    int loaded = detector.load_rules(rules_path);
    if (loaded < 0 && !rules_explicit) {
        const std::string a = argv[0] ? argv[0] : "";
        const auto pos = a.find_last_of('/');
        if (pos != std::string::npos) {
            const std::string alt = a.substr(0, pos) + "/rules/default.rules";
            const int alt_loaded = detector.load_rules(alt);
            if (alt_loaded >= 0) {
                loaded = alt_loaded;
                rules_path = alt;
            }
        }
    }
    if (loaded < 0) {
        std::cerr << "NETWRAITH: could not open rules file '" << rules_path
                  << "'. Provide one with -c.\n";
        return 1;
    }
    std::cerr << "NETWRAITH: " << loaded << " signature rule(s) online.\n";

    char errbuf[PCAP_ERRBUF_SIZE] = {0};
    pcap_t* handle = nullptr;
    bool live = false;

    if (!pcap_file.empty()) {
        handle = pcap_open_offline(pcap_file.c_str(), errbuf);
        if (handle == nullptr) {
            std::cerr << "NETWRAITH: cannot open capture '" << pcap_file
                      << "': " << errbuf << "\n";
            return 1;
        }
        std::cerr << "NETWRAITH: replaying " << pcap_file << ".\n";
    } else {
        std::string dev = iface;
        if (dev.empty()) {
            dev = auto_select_device();
            if (dev.empty()) {
                std::cerr << "NETWRAITH: no capture device found. "
                          << "Specify one with -i or a file with -r.\n";
                return 1;
            }
            std::cerr << "NETWRAITH: auto-selected interface " << dev << ".\n";
        }
        handle = pcap_open_live(dev.c_str(), 65535, 1, 1000, errbuf);
        if (handle == nullptr) {
            std::cerr << "NETWRAITH: live capture on '" << dev
                      << "' failed: " << errbuf << "\n"
                      << "Live capture needs root or CAP_NET_RAW. Grant it with:\n"
                      << "  sudo setcap cap_net_raw,cap_net_admin+eip ./netwraith\n";
            return 1;
        }
        live = true;
        std::cerr << "NETWRAITH: watching " << dev << ".\n";
    }

    g_handle = handle;

    // Optional BPF filter.
    if (!bpf_filter.empty()) {
        struct bpf_program program;
        if (pcap_compile(handle, &program, bpf_filter.c_str(), 1,
                         PCAP_NETMASK_UNKNOWN) != 0) {
            std::cerr << "NETWRAITH: bad filter '" << bpf_filter
                      << "': " << pcap_geterr(handle) << "\n";
            pcap_close(handle);
            return 1;
        }
        if (pcap_setfilter(handle, &program) != 0) {
            std::cerr << "NETWRAITH: could not install filter: "
                      << pcap_geterr(handle) << "\n";
            pcap_freecode(&program);
            pcap_close(handle);
            return 1;
        }
        pcap_freecode(&program);
        std::cerr << "NETWRAITH: filter '" << bpf_filter << "' engaged.\n";
    }

    // Open the alert sink.
    AlertEmitter emitter(out_path);
    if (!emitter.ok()) {
        std::cerr << "NETWRAITH: cannot open output '" << out_path
                  << "' for append.\n";
        pcap_close(handle);
        return 1;
    }

    // Severity tally for the exit summary, owned by the worker thread.
    uint64_t by_sev[5] = {0, 0, 0, 0, 0};
    uint64_t alerts_total = 0;

    AlertQueue queue;
    CaptureContext ctx;
    ctx.detector = &detector;
    ctx.queue    = &queue;
    ctx.linktype = pcap_datalink(handle);

    // Worker thread: drain the queue and emit.
    std::thread worker([&]() {
        Alert a;
        while (queue.pop(a)) {
            emitter.emit(a);
            ++alerts_total;
            by_sev[static_cast<int>(a.severity)] += 1;
        }
    });

    // Install signal handlers now that the pipeline is wired up.
    std::signal(SIGINT, on_signal);
    std::signal(SIGTERM, on_signal);

    std::cerr << "NETWRAITH: online. Ctrl-C to stand down.\n";

    // Capture loop runs on this (main) thread; -1 means loop until EOF or break.
    const int rc = pcap_loop(handle, -1, packet_callback,
                             reinterpret_cast<u_char*>(&ctx));
    if (rc == PCAP_ERROR) {
        std::cerr << "NETWRAITH: capture error: " << pcap_geterr(handle) << "\n";
    }

    // No more packets will be parsed. Close the queue and let the worker drain.
    queue.close();
    worker.join();

    g_handle = nullptr;
    pcap_close(handle);

    const uint64_t seen = ctx.packets.load(std::memory_order_relaxed);
    std::cerr << "\nNETWRAITH: standing down.\n"
              << "  packets seen : " << seen << "\n"
              << "  alerts fired : " << alerts_total << "\n"
              << "    critical : " << by_sev[static_cast<int>(Severity::Critical)] << "\n"
              << "    high     : " << by_sev[static_cast<int>(Severity::High)]     << "\n"
              << "    medium   : " << by_sev[static_cast<int>(Severity::Medium)]   << "\n"
              << "    low      : " << by_sev[static_cast<int>(Severity::Low)]      << "\n"
              << "    info     : " << by_sev[static_cast<int>(Severity::Info)]     << "\n";

    if (live && seen == 0) {
        std::cerr << "  (no packets: the wire was quiet, or the filter was tight.)\n";
    }
    return 0;
}
