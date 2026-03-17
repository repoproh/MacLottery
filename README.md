# MacLottery

**Dual Bitcoin + Monero mining for Apple Silicon Macs.**

GPU mines BTC (lottery) via Metal shaders. CPU mines XMR (income) via RandomX. Live React dashboard tracks blocks, mempool, difficulty, thermals, and hashrates in real time.

<p align="center">
<img src="https://img.shields.io/badge/Apple_Silicon-M1%2FM2%2FM3%2FM4-f7931a?style=flat-square&logo=apple" />
<img src="https://img.shields.io/badge/BTC-Solo_Mining-f7931a?style=flat-square&logo=bitcoin" />
<img src="https://img.shields.io/badge/XMR-Pool_Mining-ff6600?style=flat-square&logo=monero" />
<img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
</p>

## The Idea

Your Mac is already on. Bitcoin solo mining is a lottery — 52,500 draws per year, jackpot ~$215K. Monero CPU mining generates small but real income that covers electricity. Net result: **free BTC lottery tickets funded by XMR earnings.**

| | BTC (GPU) | XMR (CPU) |
|---|---|---|
| **Algorithm** | SHA-256d via Metal | RandomX |
| **Type** | Solo mining (lottery) | Pool mining (income) |
| **M1 Hashrate** | ~58 MH/s | ~2,200 H/s |
| **Annual Odds** | ~0.008% per block win | Predictable daily payouts |
| **Jackpot** | ~$215K (3.125 BTC) | ~$0.02/day |

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/MacLottery.git
cd MacLottery
chmod +x scripts/install.sh
./scripts/install.sh
```

The installer will:
1. Verify Apple Silicon
2. Install dependencies (xmrig, optionally monero-cli)
3. Build the Metal GPU miner from source
4. Prompt for your BTC and XMR addresses
5. Set up auto-start on login

## Manual Setup

### 1. Build the BTC Miner

```bash
cd miner
chmod +x build.sh
./build.sh
./MacMetalCLI --test   # Verify GPU works
```

### 2. Configure XMR Mining

```bash
cp miner/xmrig-config.example.json miner/xmrig-config.json
# Edit xmrig-config.json — replace YOUR_XMR_ADDRESS_HERE with your address
```

Don't have a Monero wallet? Install monero-cli and create one:
```bash
brew install monero
monero-wallet-cli --generate-new-wallet=$HOME/.monero/mining-wallet --mnemonic-language=English
```

### 3. Start Mining

```bash
# Start both miners with monitoring
./scripts/dual-miner.sh

# Or install as auto-start service
cp scripts/com.maclottery.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.maclottery.plist
```

### 4. Launch Dashboard

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3456
```

## Dashboard

The live dashboard shows:

- **Blocks** — real-time block feed from mempool.space, block countdown timer, mempool stats, fee estimates, difficulty adjustment progress, mining pool distribution
- **Miner** — live status of both miners (hashrate, PID, uptime, thermal pressure)
- **Overview** — probability calculator, power costs, chip comparison
- **BTC/XMR** — detailed stats for each coin, pool comparisons
- **Optimize** — interactive checklist for maximizing uptime and hashrate
- **Commands** — quick reference for all CLI operations

## System Requirements

- macOS 13+ on Apple Silicon (M1/M2/M3/M4)
- Xcode Command Line Tools (`xcode-select --install`)
- Node.js 18+ (for dashboard)
- Homebrew (installer will set it up)

## Hashrate by Chip

| Chip | BTC (GPU) | XMR (CPU) | Power | Monthly Cost |
|------|-----------|-----------|-------|-------------|
| M1 | ~58 MH/s | ~2,280 H/s | ~55W | ~$3 |
| M1 Pro | ~120 MH/s | ~2,660 H/s | ~70W | ~$4 |
| M1 Max | ~240 MH/s | ~2,660 H/s | ~85W | ~$5 |
| M1 Ultra | ~480 MH/s | ~5,320 H/s | ~140W | ~$9 |
| M3 Pro | ~135 MH/s | ~3,000 H/s | ~65W | ~$4 |

## Architecture

```
MacLottery/
├── miner/           # BTC Metal GPU miner (Swift + Metal shaders)
├── dashboard/       # React live dashboard (Vite)
├── scripts/         # Launcher, installer, LaunchAgent
└── docs/            # Field guide and technical docs
```

The BTC miner uses Apple's Metal API to dispatch SHA-256d compute shaders on the GPU. Each batch processes 16M nonces in parallel. The stratum protocol connects to solo mining pools (CKPool, Public Pool).

XMRig handles Monero mining with RandomX on CPU cores, configured to leave 2 cores free for macOS.

The monitoring script watches both processes, auto-restarts on crash, checks thermal pressure (pauses miners if critical), and writes stats to JSON for the dashboard.

## Thermal Management

The script monitors macOS thermal pressure levels:
- **Nominal/Moderate** — full speed
- **Heavy** — normal for sustained mining on MacBook Air (fanless)
- **Trapping** — pauses XMR miner to reduce load
- **Sleeping** — pauses both miners until cool

> **Note:** MacBook Air has no fan. Expect "Heavy" thermal pressure under sustained dual mining. A MacBook Pro, Mac Mini, or Mac Studio will run cooler.

## Power Optimization

```bash
# Disable sleep (run once with sudo)
sudo pmset -a disablesleep 1 && sudo pmset -a sleep 0 && sudo pmset -a displaysleep 0

# Disable App Nap
defaults write NSGlobalDomain NSAppSleepDisabled -bool YES

# For passwordless thermal monitoring, add to sudoers:
echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/powermetrics, /usr/bin/pmset, /usr/sbin/sysctl" | sudo tee /etc/sudoers.d/maclottery
```

## The Math

At 58 MH/s vs ~908 EH/s network hashrate:
- Probability per block: 1 in ~15.7 billion
- Annual probability: ~0.008%
- Expected wait: ~30,000 years
- But someone wins every 10 minutes. Every hash is independent.

This is a $3/month lottery ticket with 52,500 drawings per year and a ~$215K jackpot. The XMR mining covers the electricity.

## Credits

- [mempool.space](https://mempool.space) — Bitcoin blockchain API
- [XMRig](https://github.com/xmrig/xmrig) — Monero CPU miner
- [HashVault](https://pool.hashvault.pro) — 0% fee XMR pool
- [Solo CKPool](https://solo.ckpool.org) — BTC solo mining pool

## License

MIT — see [LICENSE](LICENSE)

## Disclaimer

Mining cryptocurrency is legal but may not be profitable. Solo Bitcoin mining on consumer hardware is essentially a lottery. Monero pool mining generates minimal income. Running sustained compute loads on a MacBook Air (fanless) accelerates hardware wear. Not financial advice. Do your own research.
