#!/bin/bash
# ============================================================================
# MacLottery - Build MacMetalCLI Bitcoin Miner
# Compiles the Metal GPU SHA256d miner from Swift source
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/MacMetalCLI.swift"
OUTPUT="$SCRIPT_DIR/MacMetalCLI"

echo "============================================"
echo "  MacLottery - Building MacMetalCLI Miner"
echo "============================================"
echo ""

# Check we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "ERROR: This miner only runs on macOS (requires Metal GPU)"
    exit 1
fi

# Check for Apple Silicon
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo "WARNING: This miner is optimized for Apple Silicon (arm64)"
    echo "  Detected architecture: $ARCH"
    echo "  Continuing anyway..."
    echo ""
fi

# Check source exists
if [[ ! -f "$SOURCE" ]]; then
    echo "ERROR: Source file not found: $SOURCE"
    exit 1
fi

# Check swiftc is available
if ! command -v swiftc &>/dev/null; then
    echo "ERROR: swiftc not found. Install Xcode Command Line Tools:"
    echo "  xcode-select --install"
    exit 1
fi

# Compile
echo "[1/2] Compiling MacMetalCLI.swift..."
swiftc "$SOURCE" \
    -o "$OUTPUT" \
    -O \
    -framework Metal \
    -framework Foundation \
    -framework CryptoKit

if [[ $? -ne 0 ]]; then
    echo ""
    echo "ERROR: Compilation failed!"
    exit 1
fi

chmod +x "$OUTPUT"
echo "  -> Built: $OUTPUT"
echo ""

# Run verification test
echo "[2/2] Running GPU verification test..."
echo ""
"$OUTPUT" --test

echo ""
echo "============================================"
echo "  Build complete!"
echo "  Binary: $OUTPUT"
echo "============================================"
