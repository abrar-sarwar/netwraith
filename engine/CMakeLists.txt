# NETWRAITH engine build.
# It watches the wire so you do not have to.
cmake_minimum_required(VERSION 3.16)
project(NETWRAITH CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_compile_options(-Wall -Wextra -Wpedantic)

# libpcap is the one external dependency. Locate the library explicitly.
find_library(PCAP_LIB pcap)
if(NOT PCAP_LIB)
    message(FATAL_ERROR
        "libpcap not found. Install the development package and retry:\n"
        "  Debian/Ubuntu : sudo apt-get install libpcap-dev\n"
        "  Fedora/RHEL   : sudo dnf install libpcap-devel\n"
        "  macOS         : xcode-select --install")
endif()

# Threads for the capture/worker pipeline.
find_package(Threads REQUIRED)

file(GLOB ENGINE_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")

add_executable(netwraith ${ENGINE_SOURCES})
target_include_directories(netwraith PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include")
target_link_libraries(netwraith PRIVATE ${PCAP_LIB} Threads::Threads)
