#!/bin/bash
# ============================================================================
# MacLottery - Dual Bitcoin + Monero Mining Script for Apple Silicon
# BTC: MacMetal GPU Miner -> solo.ckpool.org
# XMR: XMRig CPU Miner -> pool.hashvault.pro (with failover)
# ============================================================================

set -uo pipefail

# --- Configuration ---
BTC_ADDRESS="${MACLOTTERY_BTC_ADDRESS:-YOUR_BTC_ADDRESS_HERE}"
BTC_WORKER="${MACLOTTERY_WORKER:-maclottery}"
BTC_POOL="${MACLOTTERY_BTC_POOL:-solo.ckpool.org:3333}"
BTC_MINER="$HOME/MacLottery/miner/MacMetalCLI"
BTC_LOG="$HOME/.maclottery/btc.log"

XMR_MINER="/opt/homebrew/bin/xmrig"
XMR_CONFIG="$HOME/MacLottery/miner/xmrig-config.json"
XMR_LOG="$HOME/.maclottery/xmr.log"

STATS_FILE="$HOME/.maclottery/stats.json"
STATS_INTERVAL=30
STATUS_INTERVAL=300  # 5 minutes
THERMAL_CHECK_INTERVAL=15

BTC_PID=""
XMR_PID=""
BTC_PAUSED=false
XMR_PAUSED=false
START_TIME=$(date +%s)
ORIGINAL_SLEEP_SETTINGS=""

# Ensure data directory exists
mkdir -p "$HOME/.maclottery"

# --- Logging ---
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# --- Cleanup on exit ---
cleanup() {
    log "Shutting down dual miner..."

    # Kill miners
    if [[ -n "$BTC_PID" ]] && kill -0 "$BTC_PID" 2>/dev/null; then
        kill "$BTC_PID" 2>/dev/null
        wait "$BTC_PID" 2>/dev/null || true
        log "BTC miner stopped (PID $BTC_PID)"
    fi

    if [[ -n "$XMR_PID" ]] && kill -0 "$XMR_PID" 2>/dev/null; then
        kill "$XMR_PID" 2>/dev/null
        wait "$XMR_PID" 2>/dev/null || true
        log "XMR miner stopped (PID $XMR_PID)"
    fi

    # Restore power settings
    log "Restoring power settings..."
    sudo -n pmset -a disablesleep 0 2>/dev/null || true
    sudo -n pmset -a sleep 1 2>/dev/null || true
    sudo -n pmset -a displaysleep 10 2>/dev/null || true
    defaults write NSGlobalDomain NSAppSleepDisabled -bool NO 2>/dev/null || true

    log "Dual miner stopped. Goodbye."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# --- System Optimizations ---
apply_power_settings() {
    log "Applying system optimizations..."
    sudo -n pmset -a disablesleep 1 2>/dev/null && \
    sudo -n pmset -a sleep 0 2>/dev/null && \
    sudo -n pmset -a displaysleep 0 2>/dev/null && \
    sudo -n pmset -a highpowermode 1 2>/dev/null || true
    sudo -n sysctl -w net.inet.tcp.delayed_ack=0 >/dev/null 2>&1 || true
    log "Power settings applied"
    defaults write NSGlobalDomain NSAppSleepDisabled -bool YES
}

# --- Start BTC Miner ---
start_btc() {
    if [[ ! -x "$BTC_MINER" ]]; then
        log "WARNING: BTC miner not found at $BTC_MINER"
        return 1
    fi
    log "Starting BTC miner -> $BTC_POOL"
    "$BTC_MINER" "$BTC_ADDRESS" --pool "$BTC_POOL" --worker "$BTC_WORKER" >> "$BTC_LOG" 2>&1 &
    BTC_PID=$!
    BTC_PAUSED=false
    log "BTC miner started (PID $BTC_PID)"
}

# --- Start XMR Miner ---
start_xmr() {
    if [[ ! -x "$XMR_MINER" ]]; then
        log "WARNING: XMR miner not found at $XMR_MINER"
        return 1
    fi
    if [[ ! -f "$XMR_CONFIG" ]]; then
        log "WARNING: XMR config not found at $XMR_CONFIG"
        return 1
    fi
    log "Starting XMR miner..."
    "$XMR_MINER" --config="$XMR_CONFIG" >> "$XMR_LOG" 2>&1 &
    XMR_PID=$!
    XMR_PAUSED=false
    log "XMR miner started (PID $XMR_PID)"
}

# --- Get Temperature ---
get_thermal_pressure() {
    # Returns thermal pressure level: Nominal, Moderate, Heavy, Trapping, Sleeping
    local level
    level=$(sudo -n powermetrics --samplers thermal -i 1000 -n 1 2>/dev/null \
        | grep -i "current pressure level" \
        | head -1 \
        | sed 's/.*: *//')
    echo "${level:-unknown}"
}

# --- Thermal Check ---
# Pressure levels: Nominal < Moderate < Heavy < Trapping < Sleeping
# Pause XMR at Trapping, pause BTC too at Sleeping
# Resume at Heavy or below
check_thermal() {
    local pressure
    pressure=$(get_thermal_pressure)

    if [[ "$pressure" == "unknown" ]]; then
        return
    fi

    if [[ "$pressure" == "Trapping" || "$pressure" == "Sleeping" ]]; then
        # Critical thermal — pause XMR first
        if [[ "$XMR_PAUSED" == false ]] && [[ -n "$XMR_PID" ]] && kill -0 "$XMR_PID" 2>/dev/null; then
            log "THERMAL: pressure=$pressure - pausing XMR miner"
            kill -STOP "$XMR_PID" 2>/dev/null || true
            XMR_PAUSED=true
        fi

        # If Sleeping, also pause BTC
        if [[ "$pressure" == "Sleeping" ]] && [[ "$BTC_PAUSED" == false ]] && [[ -n "$BTC_PID" ]] && kill -0 "$BTC_PID" 2>/dev/null; then
            log "THERMAL: pressure=Sleeping - pausing BTC miner too"
            kill -STOP "$BTC_PID" 2>/dev/null || true
            BTC_PAUSED=true
        fi
    else
        # Nominal/Moderate/Heavy — resume miners
        if [[ "$BTC_PAUSED" == true ]] && [[ -n "$BTC_PID" ]] && kill -0 "$BTC_PID" 2>/dev/null; then
            log "THERMAL: pressure=$pressure - resuming BTC miner"
            kill -CONT "$BTC_PID" 2>/dev/null || true
            BTC_PAUSED=false
        fi

        if [[ "$XMR_PAUSED" == true ]] && [[ -n "$XMR_PID" ]] && kill -0 "$XMR_PID" 2>/dev/null; then
            log "THERMAL: pressure=$pressure - resuming XMR miner"
            kill -CONT "$XMR_PID" 2>/dev/null || true
            XMR_PAUSED=false
        fi
    fi
}

# --- Monitor & Restart ---
check_and_restart() {
    # Check BTC miner
    if [[ -n "$BTC_PID" ]] && ! kill -0 "$BTC_PID" 2>/dev/null; then
        log "BTC miner crashed (was PID $BTC_PID) - restarting..."
        start_btc || true
    fi

    # Check XMR miner
    if [[ -n "$XMR_PID" ]] && ! kill -0 "$XMR_PID" 2>/dev/null; then
        log "XMR miner crashed (was PID $XMR_PID) - restarting..."
        start_xmr || true
    fi
}

# --- Write Stats JSON ---
write_stats() {
    local now
    now=$(date +%s)
    local uptime=$((now - START_TIME))
    local hours=$((uptime / 3600))
    local mins=$(( (uptime % 3600) / 60 ))
    local secs=$((uptime % 60))
    local uptime_str
    uptime_str=$(printf "%02d:%02d:%02d" "$hours" "$mins" "$secs")

    local pressure
    pressure=$(get_thermal_pressure)

    local btc_status="stopped"
    if [[ -n "$BTC_PID" ]] && kill -0 "$BTC_PID" 2>/dev/null; then
        if [[ "$BTC_PAUSED" == true ]]; then
            btc_status="paused_thermal"
        else
            btc_status="running"
        fi
    fi

    local xmr_status="stopped"
    if [[ -n "$XMR_PID" ]] && kill -0 "$XMR_PID" 2>/dev/null; then
        if [[ "$XMR_PAUSED" == true ]]; then
            xmr_status="paused_thermal"
        else
            xmr_status="running"
        fi
    fi

    # Extract hashrates from logs (last reported values)
    local btc_hashrate="unknown"
    local xmr_hashrate="unknown"

    if [[ -f "$BTC_LOG" ]]; then
        btc_hashrate=$(grep -oE '[0-9]+\.[0-9]+ MH/s' "$BTC_LOG" 2>/dev/null | tail -1 || echo "unknown")
    fi

    if [[ -f "$XMR_LOG" ]]; then
        xmr_hashrate=$(grep -oE 'speed [0-9]+\.[0-9]+ H/s' "$XMR_LOG" 2>/dev/null | tail -1 | grep -oE '[0-9]+\.[0-9]+ H/s' || echo "unknown")
    fi

    cat > "$STATS_FILE" <<STATS_EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "uptime": "$uptime_str",
    "uptime_seconds": $uptime,
    "thermal_pressure": "$pressure",
    "btc": {
        "status": "$btc_status",
        "pid": "${BTC_PID:-null}",
        "pool": "$BTC_POOL",
        "address": "$BTC_ADDRESS",
        "hashrate": "$btc_hashrate"
    },
    "xmr": {
        "status": "$xmr_status",
        "pid": "${XMR_PID:-null}",
        "hashrate": "$xmr_hashrate"
    }
}
STATS_EOF
}

# --- Print Status Line ---
print_status() {
    local now
    now=$(date +%s)
    local uptime=$((now - START_TIME))
    local hours=$((uptime / 3600))
    local mins=$(( (uptime % 3600) / 60 ))
    local uptime_str
    uptime_str=$(printf "%dh%02dm" "$hours" "$mins")

    local pressure
    pressure=$(get_thermal_pressure)

    local btc_hr="--"
    local xmr_hr="--"

    if [[ -f "$BTC_LOG" ]]; then
        btc_hr=$(grep -oE '[0-9]+\.[0-9]+ MH/s' "$BTC_LOG" 2>/dev/null | tail -1 || echo "--")
    fi
    if [[ -f "$XMR_LOG" ]]; then
        xmr_hr=$(grep -oE 'speed [0-9]+\.[0-9]+ H/s' "$XMR_LOG" 2>/dev/null | tail -1 | grep -oE '[0-9]+\.[0-9]+ H/s' || echo "--")
    fi

    log "STATUS | Uptime: $uptime_str | Thermal: $pressure | BTC: $btc_hr | XMR: $xmr_hr"
}

# ============================================================================
# Main
# ============================================================================

log "========================================"
log "  MacLottery - Dual Bitcoin + Monero Miner"
log "  BTC: $BTC_ADDRESS"
log "  Pool: $BTC_POOL"
log "========================================"

# Apply system power settings
apply_power_settings

# Start miners
start_btc || log "BTC miner failed to start (will retry)"
start_xmr || log "XMR miner failed to start (will retry)"

log "Miners running. Ctrl+C to stop."

# Main monitoring loop
LAST_STATS=0
LAST_STATUS=0
LAST_THERMAL=0

while true; do
    NOW=$(date +%s)

    # Check miners are alive and restart if crashed
    check_and_restart

    # Thermal check
    if (( NOW - LAST_THERMAL >= THERMAL_CHECK_INTERVAL )); then
        check_thermal
        LAST_THERMAL=$NOW
    fi

    # Write stats JSON
    if (( NOW - LAST_STATS >= STATS_INTERVAL )); then
        write_stats
        LAST_STATS=$NOW
    fi

    # Print status line
    if (( NOW - LAST_STATUS >= STATUS_INTERVAL )); then
        print_status
        LAST_STATUS=$NOW
    fi

    sleep 5
done
