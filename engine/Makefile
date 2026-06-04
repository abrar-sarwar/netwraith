# NETWRAITH engine Makefile.
# It watches the wire so you do not have to.

CXX      ?= g++
CXXFLAGS := -std=c++17 -Wall -Wextra -O2 -Iinclude
LDLIBS   := -lpcap -lpthread

BIN     := netwraith
SRCDIR  := src
SOURCES := $(wildcard $(SRCDIR)/*.cpp)
OBJECTS := $(SOURCES:.cpp=.o)

.PHONY: all clean

all: $(BIN)

$(BIN): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $(OBJECTS) -o $@ $(LDLIBS)

$(SRCDIR)/%.o: $(SRCDIR)/%.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(OBJECTS) $(BIN)
