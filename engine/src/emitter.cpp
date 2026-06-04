// emitter.cpp - JSONL to disk and a NETWRAITH status line to stdout.
#include "emitter.h"

#include <cstdio>
#include <ctime>
#include <iostream>
#include <string>

namespace netwraith {

namespace {

// Append a JSON string literal for s into dst: surrounding quotes plus a correct
// escaper. Hand-rolled to avoid pulling in a JSON library.
void append_json_string(std::string& dst, const std::string& s) {
    dst.push_back('"');
    for (unsigned char c : s) {
        switch (c) {
            case '"':  dst += "\\\""; break;
            case '\\': dst += "\\\\"; break;
            case '\b': dst += "\\b";  break;
            case '\f': dst += "\\f";  break;
            case '\n': dst += "\\n";  break;
            case '\r': dst += "\\r";  break;
            case '\t': dst += "\\t";  break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x",
                                  static_cast<unsigned>(c));
                    dst += buf;
                } else {
                    dst.push_back(static_cast<char>(c));
                }
        }
    }
    dst.push_back('"');
}

// Render epoch milliseconds as an ISO 8601 UTC timestamp, e.g.
// 2026-06-04T17:42:09.310Z.
std::string iso8601_utc(int64_t ts_ms) {
    const time_t secs = static_cast<time_t>(ts_ms / 1000);
    const int    millis = static_cast<int>(ts_ms % 1000);
    std::tm tmv{};
#if defined(_WIN32)
    gmtime_s(&tmv, &secs);
#else
    gmtime_r(&secs, &tmv);
#endif
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
                  tmv.tm_year + 1900, tmv.tm_mon + 1, tmv.tm_mday,
                  tmv.tm_hour, tmv.tm_min, tmv.tm_sec, millis);
    return std::string(buf);
}

std::string upper(const std::string& s) {
    std::string r = s;
    for (char& c : r) {
        if (c >= 'a' && c <= 'z') c = static_cast<char>(c - 'a' + 'A');
    }
    return r;
}

}  // namespace

AlertEmitter::AlertEmitter(const std::string& path)
    : path_(path), out_(path, std::ios::out | std::ios::app) {}

void AlertEmitter::emit(const Alert& a) {
    // Build the JSON line by hand, in the exact data-contract field order.
    std::string line;
    line.reserve(256);
    line += "{\"ts\":";
    line += std::to_string(a.timestamp_ms);
    line += ",\"severity\":";
    append_json_string(line, severity_to_string(a.severity));
    line += ",\"category\":";
    append_json_string(line, a.category);
    line += ",\"rule_id\":";
    append_json_string(line, a.rule_id);
    line += ",\"msg\":";
    append_json_string(line, a.msg);
    line += ",\"src\":";
    append_json_string(line, a.src);
    line += ",\"dst\":";
    append_json_string(line, a.dst);
    line += ",\"proto\":";
    append_json_string(line, a.proto);
    line += "}";

    if (out_.is_open()) {
        out_ << line << '\n';
        out_.flush();  // flush after each write so tailers see it immediately
    }

    // Status line to stdout in the NETWRAITH voice.
    std::cout << iso8601_utc(a.timestamp_ms) << "  "
              << upper(severity_to_string(a.severity)) << "  "
              << a.category << "  "
              << a.msg << "  "
              << a.src << " -> " << a.dst << '\n';
    std::cout.flush();
}

}  // namespace netwraith
