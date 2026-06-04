// emitter.h - alert sink for NETWRAITH: JSONL to disk, a status line to stdout.
#ifndef NETWRAITH_EMITTER_H
#define NETWRAITH_EMITTER_H

#include <fstream>
#include <string>

#include "netwraith.h"

namespace netwraith {

// Writes each alert as one JSON object per line to the configured path (append
// mode, flushed after every write) and prints a compact status line to stdout.
class AlertEmitter {
public:
    // Open path in append mode. Check ok() before relying on the file sink.
    explicit AlertEmitter(const std::string& path);

    // True if the output file opened successfully.
    bool ok() const { return out_.is_open(); }

    // Serialize one alert to the file and echo a human line to stdout.
    void emit(const Alert& a);

private:
    std::string   path_;
    std::ofstream out_;
};

}  // namespace netwraith

#endif  // NETWRAITH_EMITTER_H
