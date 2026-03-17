# Bitcoin Solo Mining Optimizer for Mac M1 — Field Guide

## The Brutal Truth

Your M1 does ~350-500 MH/s via Metal GPU shaders. The Bitcoin network is doing **~908 EH/s** at difficulty **145T** (March 2026). That's roughly a **1 in 650,000 chance per block** on a base M1. With ~52,500 blocks per year, your annual probability of hitting one is approximately **0.008%**.

That said — solo miners on CKPool won blocks worth $200K-$370K multiple times in 2025-2026. Someone with 480 GH/s (a Bitaxe, not even a Mac) hit a block in March 2025. A miner renting just $75 of hashrate hit block 938,092 in February 2026. It's pure lottery, but tickets are cheap.

## What Actually Affects Your "Luck"

Bitcoin mining follows a **Poisson process** — every hash is independent. There is no "luck" modifier. But you can maximize the number of lottery tickets you buy per unit time:

### 1. Maximize Hashrate
- **Use Metal GPU acceleration** — native Apple Silicon GPU shaders (SHA256d) hit 350+ MH/s on base M1, up to 3+ GH/s on M1 Ultra
- **MacMetal Miner** (macmetalminer.com) — purpose-built Metal GPU miner, source available on GitHub
- **SoloMiner** (github.com/error2/SoloMiner) — free/open-source alternative, menu bar app
- **Batch exponent tuning** — controls hashes per GPU dispatch. Too small = GPU idle between dispatches. Too large = delayed share submission. Sweet spot:
  - M1 base (8 GPU cores): 2^21 (~2M hashes)
  - M1 Pro (16 cores): 2^22 (~4M hashes)
  - M1 Max (32 cores): 2^23 (~8M hashes)
  - M1 Ultra (64 cores): 2^24 (~16M hashes)

### 2. Maximize Uptime (Every Second Offline = A Lost Ticket)
- **Disable sleep**: `sudo pmset -a disablesleep 1 && sudo pmset -a sleep 0`
- **Disable App Nap**: `defaults write NSGlobalDomain NSAppSleepDisabled -bool YES`
- **Enable High Power Mode** (M1 Pro/Max only): System Settings → Battery
- **Auto-restart on crash**: The script monitors the miner PID and restarts automatically
- **Stay on AC power**: Battery mode throttles GPU significantly
- **LaunchDaemon**: Set up a plist to auto-start mining on boot

### 3. Thermal Management (Throttling Kills Hashrate)
- M1 GPU runs at ~30-50W while mining — very efficient
- Keep ambient temp below 30°C if possible
- Use a laptop stand with airflow (not a flat desk)
- Monitor with: `sudo powermetrics --samplers smc -i5 -n1`
- If GPU exceeds 95°C, macOS will thermal throttle and hashrate drops significantly
- The Mac Mini / Mac Studio have better sustained cooling than MacBooks

### 4. Pool Selection & Latency
- **Solo CKPool** (`solo.ckpool.org:3333`) — longest running, 299+ solo blocks facilitated, 2% fee
- **Public Pool** (`public-pool.io:21496`) — newer, 0% fee, open source
- **AtlasPool** — newer option, less track record
- Lower latency = faster share submission = slightly less stale work
- From Bangkok, CKPool and Public Pool should both be <200ms

### 5. Reduce Stale/Rejected Shares
- Every rejected share is a wasted lottery ticket
- Keep stratum connection stable (wired ethernet > WiFi)
- Use the pool with lowest latency from your location
- Monitor reject rate — should be <1%

## Hashrate Comparison Table

| Hardware | Est. Hashrate | Annual Block Probability |
|----------|--------------|------------------------|
| M1 base (8 GPU) | ~400 MH/s | ~0.008% |
| M1 Pro (16 GPU) | ~800 MH/s | ~0.016% |
| M1 Max (32 GPU) | ~1.6 GH/s | ~0.032% |
| M1 Ultra (64 GPU) | ~3.2 GH/s | ~0.064% |
| Bitaxe Gamma 602 | ~1.2 TH/s | ~0.024% |
| Antminer S21 (ASIC) | ~200 TH/s | ~4% |

## Cost Analysis (Bangkok, ~4 THB/kWh residential)

| Device | Power Draw | Monthly Cost (THB) | Monthly Cost (USD) |
|--------|-----------|--------------------|--------------------|
| M1 base mining | ~35W | ~100 THB | ~$3 |
| M1 Max mining | ~60W | ~175 THB | ~$5.50 |
| M1 Ultra mining | ~100W | ~290 THB | ~$9 |

Electricity cost is negligible. Your Mac is already on. This is genuinely "spare change" lottery mining.

## Quick Start

```bash
# 1. Clone the optimizer
git clone <your-repo> && cd btc-solo-miner

# 2. Check your system
chmod +x m1-mining-optimizer.sh
./m1-mining-optimizer.sh --check-only

# 3. See your odds
./m1-mining-optimizer.sh --stats-only

# 4. Start mining
./m1-mining-optimizer.sh --address bc1qYOURADDRESS --pool ckpool --worker bangkokminer
```

## Auto-Start on Boot (LaunchDaemon)

Create `~/Library/LaunchAgents/com.btc.solominer.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.btc.solominer</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/YOU/btc-solo-miner/m1-mining-optimizer.sh</string>
        <string>--address</string>
        <string>bc1qYOURADDRESS</string>
        <string>--pool</string>
        <string>ckpool</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOU/.btc-solo-miner/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOU/.btc-solo-miner/stderr.log</string>
</dict>
</plist>
```

Load with: `launchctl load ~/Library/LaunchAgents/com.btc.solominer.plist`

## The Bottom Line

This is a $3/month lottery ticket where each drawing happens every 10 minutes, 24/7/365. The expected value is negative — but so is every lottery ticket. The difference is you get 52,500 draws per year and the jackpot is ~$200K+. The script's job is to make sure you never miss a drawing.
