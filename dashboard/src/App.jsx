import { useState, useEffect, useRef, useCallback } from "react";

const BTC = {
  hashrate_ehs: 908,
  difficulty_t: 145.04,
  block_reward: 3.125,
  price: 68800,
  blocks_year: 52560,
  blocks_day: 144,
};

const XMR = {
  hashrate_mhs: 2800,
  block_reward: 0.6,
  price: 145,
  blocks_day: 720,
};

const CHIPS = {
  "M1 (8 GPU)":       { gpu: 8,  btc_mhs: 400,  xmr_hs: 2280, power: 55 },
  "M1 Pro (16 GPU)":  { gpu: 16, btc_mhs: 800,  xmr_hs: 2660, power: 70 },
  "M1 Max (32 GPU)":  { gpu: 32, btc_mhs: 1600, xmr_hs: 2660, power: 85 },
  "M1 Ultra (64 GPU)":{ gpu: 64, btc_mhs: 3200, xmr_hs: 5320, power: 140 },
  "M2 (10 GPU)":      { gpu: 10, btc_mhs: 500,  xmr_hs: 2500, power: 50 },
  "M3 Pro (18 GPU)":  { gpu: 18, btc_mhs: 900,  xmr_hs: 3000, power: 65 },
  "M4 Max (40 GPU)":  { gpu: 40, btc_mhs: 2200, xmr_hs: 3400, power: 80 },
};

const XMR_POOLS = [
  { name: "HashVault", host: "pool.hashvault.pro:443", fee: "0%", min: "0.003 XMR", region: "Global" },
  { name: "SupportXMR", host: "pool.supportxmr.com:443", fee: "0.6%", min: "0.1 XMR", region: "Global" },
  { name: "2Miners", host: "xmr.2miners.com:2222", fee: "1%", min: "0.01 XMR", region: "EU/US" },
  { name: "MoneroOcean", host: "gulf.moneroocean.stream:443", fee: "0%", min: "0.003 XMR", region: "Global" },
];

const BTC_POOLS = [
  { name: "Solo CKPool", host: "solo.ckpool.org:3333", fee: "2%", blocks: "299+", note: "OG" },
  { name: "Public Pool", host: "public-pool.io:21496", fee: "0%", blocks: "~30", note: "Free" },
  { name: "AtlasPool", host: "stratum.atlaspool.com", fee: "0%", blocks: "1", note: "New" },
];

function calc(chip) {
  const c = CHIPS[chip];
  const btc_prob = (c.btc_mhs * 1e6) / (BTC.hashrate_ehs * 1e18);
  const btc_odds = Math.round(1 / btc_prob);
  const btc_annual = 1 - Math.pow(1 - btc_prob, BTC.blocks_year);
  const btc_years = (1 / btc_prob) / BTC.blocks_day / 365;
  const btc_jackpot = BTC.block_reward * BTC.price;
  const xmr_daily_coins = (c.xmr_hs / (XMR.hashrate_mhs * 1e6)) * XMR.blocks_day * XMR.block_reward;
  const xmr_daily_usd = xmr_daily_coins * XMR.price;
  const xmr_monthly_usd = xmr_daily_usd * 30;
  const xmr_monthly_coins = xmr_daily_coins * 30;
  const xmr_yearly_usd = xmr_daily_usd * 365;
  const elec_monthly_kwh = (c.power / 1000) * 24 * 30;
  const elec_monthly_thb = elec_monthly_kwh * 4;
  const elec_monthly_usd = elec_monthly_thb / 34;
  const net_monthly = xmr_monthly_usd - elec_monthly_usd;
  return { btc_prob, btc_odds, btc_annual, btc_years, btc_jackpot, xmr_daily_coins, xmr_daily_usd, xmr_monthly_usd, xmr_monthly_coins, xmr_yearly_usd, elec_monthly_thb, elec_monthly_usd, net_monthly, ...c };
}

function HashStream() {
  const [h, setH] = useState([]);
  useEffect(() => {
    const t = setInterval(() => {
      const v = Array.from({ length: 8 }, () => (Math.random() * 16 | 0).toString(16)).join("");
      setH(p => [...p.slice(-8), { id: Date.now(), v }]);
    }, 120);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ fontFamily: "mono", fontSize: 10, color: "#f7931a30", overflow: "hidden", height: 20, display: "flex", gap: 6 }}>
      {h.map((x, i) => <span key={x.id} style={{ opacity: 0.15 + (i / h.length) * 0.85 }}>0x{x.v}</span>)}
    </div>
  );
}

function Stat({ label, value, sub, accent, small }) {
  return (
    <div style={{
      background: accent ? "rgba(247,147,26,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${accent ? "rgba(247,147,26,0.2)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 10, padding: small ? "12px 14px" : "16px 18px",
    }}>
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1.1, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: small ? 20 : 24, fontWeight: 700, color: accent ? "#f7931a" : "#e8e8e8", fontFamily: "'Fira Code', monospace", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#4a4a4a", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Bar({ val, max = 1, color = "#f7931a" }) {
  const pct = Math.min((val / max) * 100, 100);
  return (
    <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
      <div style={{ width: `${Math.max(pct, 0.3)}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: 3, boxShadow: `0 0 6px ${color}40` }} />
    </div>
  );
}

function LiveStatus({ stats }) {
  if (!stats) return (
    <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 12, color: "#555", textAlign: "center" }}>
      Waiting for stats.json...
    </div>
  );

  const thermalColor = {
    Nominal: "#4ade80", Moderate: "#facc15", Heavy: "#f97316", Trapping: "#ef4444", Sleeping: "#dc2626"
  }[stats.thermal_pressure] || "#555";

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 12px rgba(74,222,128,0.6)", animation: "pulse 2s ease-in-out infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80", textTransform: "uppercase", letterSpacing: 1 }}>Live</span>
        <span style={{ fontSize: 11, color: "#555" }}>Uptime: {stats.uptime}</span>
        <span style={{ fontSize: 11, color: thermalColor, marginLeft: "auto", fontWeight: 600 }}>Thermal: {stats.thermal_pressure}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{
          padding: "14px 16px", borderRadius: 10,
          background: "rgba(247,147,26,0.04)", border: "1px solid rgba(247,147,26,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#f7931a", fontWeight: 600 }}>BTC GPU Miner</span>
            <span style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
              background: stats.btc.status === "running" ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)",
              color: stats.btc.status === "running" ? "#4ade80" : "#ef4444",
            }}>{stats.btc.status.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#e8e8e8", fontFamily: "'Fira Code', monospace", marginTop: 4 }}>
            {stats.btc.hashrate || "--"}
          </div>
          <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>{stats.btc.pool} | PID {stats.btc.pid}</div>
        </div>
        <div style={{
          padding: "14px 16px", borderRadius: 10,
          background: "rgba(255,102,0,0.04)", border: "1px solid rgba(255,102,0,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#ff6600", fontWeight: 600 }}>XMR CPU Miner</span>
            <span style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
              background: stats.xmr.status === "running" ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)",
              color: stats.xmr.status === "running" ? "#4ade80" : "#ef4444",
            }}>{stats.xmr.status.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#e8e8e8", fontFamily: "'Fira Code', monospace", marginTop: 4 }}>
            {stats.xmr.hashrate !== "unknown" ? stats.xmr.hashrate : "--"}
          </div>
          <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>RandomX | PID {stats.xmr.pid}</div>
        </div>
      </div>
    </div>
  );
}

function Checklist() {
  const [ck, setCk] = useState({});
  const items = [
    { id: "metal", l: "Metal GPU miner installed", d: "MacMetal Miner", p: "HIGH" },
    { id: "xmrig", l: "XMRig installed (arm64)", d: "brew install xmrig", p: "HIGH" },
    { id: "power", l: "AC power connected", d: "Battery throttles everything", p: "HIGH" },
    { id: "sleep", l: "Sleep disabled", d: "pmset disablesleep 1", p: "HIGH" },
    { id: "appnap", l: "App Nap disabled", d: "NSAppSleepDisabled = YES", p: "MED" },
    { id: "hp", l: "High Power Mode on", d: "M1 Pro/Max only", p: "MED" },
    { id: "eth", l: "Wired ethernet", d: "Fewer stale shares", p: "LOW" },
    { id: "cool", l: "Adequate cooling", d: "Stand + airflow", p: "MED" },
    { id: "boot", l: "Auto-start on boot", d: "LaunchAgent configured", p: "MED" },
  ];
  const score = Object.values(ck).filter(Boolean).length;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "#777" }}>Optimization Score</span>
        <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: score >= 7 ? "#4ade80" : score >= 4 ? "#f7931a" : "#ef4444" }}>{score}/{items.length}</span>
      </div>
      <Bar val={score} max={items.length} color="#4ade80" />
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map(it => (
          <div key={it.id} onClick={() => setCk(p => ({ ...p, [it.id]: !p[it.id] }))} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
            background: ck[it.id] ? "rgba(74,222,128,0.04)" : "transparent",
            borderRadius: 5, cursor: "pointer",
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 3, flexShrink: 0,
              border: `2px solid ${ck[it.id] ? "#4ade80" : "#3a3a3a"}`,
              background: ck[it.id] ? "#4ade80" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{ck[it.id] && <span style={{ color: "#0a0a0a", fontSize: 10, fontWeight: 800 }}>✓</span>}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: ck[it.id] ? "#4ade80" : "#bbb", fontWeight: 500 }}>{it.l}</div>
              <div style={{ fontSize: 10, color: "#444" }}>{it.d}</div>
            </div>
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600,
              background: it.p === "HIGH" ? "rgba(239,68,68,0.12)" : it.p === "MED" ? "rgba(247,147,26,0.12)" : "rgba(255,255,255,0.04)",
              color: it.p === "HIGH" ? "#ef4444" : it.p === "MED" ? "#f7931a" : "#555",
            }}>{it.p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CmdBlock({ cmds }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {cmds.map(c => (
        <div key={c.l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
          <span style={{ fontSize: 11, color: "#555", width: 100, flexShrink: 0 }}>{c.l}</span>
          <code style={{ flex: 1, fontSize: 11, fontFamily: "'Fira Code', monospace", color: "#f7931a", background: "rgba(247,147,26,0.05)", padding: "5px 8px", borderRadius: 5 }}>{c.c}</code>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Live Blockchain Components (mempool.space API)
// ============================================================================

function useBlockchain() {
  const [blocks, setBlocks] = useState([]);
  const [mempool, setMempool] = useState(null);
  const [diffAdj, setDiffAdj] = useState(null);
  const [price, setPrice] = useState(null);
  const [hashrate, setHashrate] = useState(null);
  const [fees, setFees] = useState(null);
  const [flash, setFlash] = useState(false);
  const prevHeight = useRef(null);

  const fetchAll = useCallback(() => {
    fetch("https://mempool.space/api/v1/blocks/tip/height")
      .then(r => r.json())
      .then(h => fetch(`https://mempool.space/api/v1/blocks/${h}`))
      .then(r => r.json())
      .then(b => {
        if (prevHeight.current && b[0]?.height > prevHeight.current) {
          setFlash(true);
          setTimeout(() => setFlash(false), 3000);
        }
        prevHeight.current = b[0]?.height;
        setBlocks(b.slice(0, 10));
      })
      .catch(() => {});

    fetch("https://mempool.space/api/mempool")
      .then(r => r.json()).then(setMempool).catch(() => {});

    fetch("https://mempool.space/api/v1/difficulty-adjustment")
      .then(r => r.json()).then(setDiffAdj).catch(() => {});

    fetch("https://mempool.space/api/v1/prices")
      .then(r => r.json()).then(setPrice).catch(() => {});

    fetch("https://mempool.space/api/v1/mining/hashrate/1w")
      .then(r => r.json())
      .then(d => d.currentHashrate && setHashrate(d.currentHashrate))
      .catch(() => {});

    fetch("https://mempool.space/api/v1/fees/recommended")
      .then(r => r.json()).then(setFees).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  return { blocks, mempool, diffAdj, price, hashrate, fees, flash };
}

function timeAgo(ts) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtBTC(sats) {
  return (sats / 1e8).toFixed(3);
}

function fmtHash(h) {
  if (!h) return "--";
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  return `${(h / 1e12).toFixed(1)} TH/s`;
}

function BlockVisual({ block, isLatest }) {
  const txCount = block.tx_count || 0;
  const size = block.size || 0;
  const fullness = Math.min(size / 4000000, 1); // vs 4MB weight limit
  const feeSats = (block.extras?.totalFees || 0);
  const reward = (block.extras?.reward || 312500000);

  return (
    <div style={{
      background: isLatest ? "rgba(247,147,26,0.08)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isLatest ? "rgba(247,147,26,0.25)" : "rgba(255,255,255,0.05)"}`,
      borderRadius: 10, padding: "12px 14px",
      transition: "all 0.3s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isLatest && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f7931a", animation: "pulse 1.5s ease-in-out infinite" }} />}
          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Fira Code', monospace", color: isLatest ? "#f7931a" : "#e8e8e8" }}>
            #{block.height?.toLocaleString()}
          </span>
        </div>
        <span style={{ fontSize: 10, color: "#555" }}>{timeAgo(block.timestamp)}</span>
      </div>

      {/* Block fullness bar */}
      <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, marginBottom: 8 }}>
        <div style={{
          width: `${fullness * 100}%`, height: "100%", borderRadius: 2,
          background: fullness > 0.95 ? "linear-gradient(90deg, #ef4444, #f97316)" :
                      fullness > 0.7 ? "linear-gradient(90deg, #f7931a, #facc15)" :
                      "linear-gradient(90deg, #4ade80, #22d3ee)",
        }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, fontSize: 10 }}>
        <div>
          <div style={{ color: "#555" }}>TXs</div>
          <div style={{ color: "#bbb", fontFamily: "monospace", fontWeight: 600 }}>{txCount.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: "#555" }}>Reward</div>
          <div style={{ color: "#4ade80", fontFamily: "monospace", fontWeight: 600 }}>{fmtBTC(reward)} BTC</div>
        </div>
        <div>
          <div style={{ color: "#555" }}>Fees</div>
          <div style={{ color: "#facc15", fontFamily: "monospace", fontWeight: 600 }}>{fmtBTC(feeSats)} BTC</div>
        </div>
      </div>

      {block.extras?.pool?.name && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#666" }}>
          Mined by <span style={{ color: "#999", fontWeight: 600 }}>{block.extras.pool.name}</span>
          {" "}<span style={{ color: "#444" }}>| {(size / 1e6).toFixed(2)} MB</span>
        </div>
      )}
    </div>
  );
}

function BlockCountdown({ blocks }) {
  const [elapsed, setElapsed] = useState(0);
  const latestTs = blocks[0]?.timestamp;

  useEffect(() => {
    if (!latestTs) return;
    const tick = () => setElapsed(Math.floor(Date.now() / 1000 - latestTs));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [latestTs]);

  if (!latestTs) return null;

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const pct = Math.min(elapsed / 600, 1); // 10 min avg
  const overdue = elapsed > 600;

  return (
    <div style={{
      background: overdue ? "rgba(239,68,68,0.06)" : "rgba(247,147,26,0.04)",
      border: `1px solid ${overdue ? "rgba(239,68,68,0.15)" : "rgba(247,147,26,0.1)"}`,
      borderRadius: 10, padding: "14px 16px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
          Time Since Last Block
        </div>
        <div style={{
          fontSize: 24, fontWeight: 700, fontFamily: "'Fira Code', monospace",
          color: overdue ? "#ef4444" : elapsed > 300 ? "#facc15" : "#4ade80",
        }}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>
      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
        <div style={{
          width: `${Math.min(pct * 100, 100)}%`, height: "100%", borderRadius: 3,
          background: overdue ? "linear-gradient(90deg, #ef4444, #dc2626)" :
                      pct > 0.5 ? "linear-gradient(90deg, #facc15, #f97316)" :
                      "linear-gradient(90deg, #4ade80, #22d3ee)",
          transition: "width 1s linear",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#444" }}>
        <span>0 min</span>
        <span>~10 min avg</span>
        {overdue && <span style={{ color: "#ef4444" }}>OVERDUE</span>}
      </div>
    </div>
  );
}

function MempoolVisual({ mempool, fees }) {
  if (!mempool) return null;
  const count = mempool.count || 0;
  const vsize = mempool.vsize || 0;
  const blocksWorth = vsize / 1000000; // ~1MB per block

  return (
    <div style={{
      background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.12)",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>
        Mempool
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "#555" }}>Unconfirmed TXs</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#e8e8e8" }}>{count.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#555" }}>Blocks Worth</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#8b5cf6" }}>{blocksWorth.toFixed(1)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#555" }}>Size</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#e8e8e8" }}>{(vsize / 1e6).toFixed(1)} MB</div>
        </div>
      </div>
      {fees && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ padding: "6px 8px", background: "rgba(74,222,128,0.06)", borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#555" }}>Low Priority</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#4ade80" }}>{fees.hourFee} <span style={{ fontSize: 9, color: "#555" }}>sat/vB</span></div>
          </div>
          <div style={{ padding: "6px 8px", background: "rgba(250,204,21,0.06)", borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#555" }}>Medium</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#facc15" }}>{fees.halfHourFee} <span style={{ fontSize: 9, color: "#555" }}>sat/vB</span></div>
          </div>
          <div style={{ padding: "6px 8px", background: "rgba(239,68,68,0.06)", borderRadius: 6, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#555" }}>Next Block</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#ef4444" }}>{fees.fastestFee} <span style={{ fontSize: 9, color: "#555" }}>sat/vB</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function DifficultyGauge({ diffAdj, hashrate }) {
  if (!diffAdj) return null;

  const pct = (diffAdj.progressPercent || 0);
  const change = (diffAdj.difficultyChange || 0);
  const remaining = diffAdj.remainingBlocks || 0;
  const eta = diffAdj.estimatedRetargetDate ? new Date(diffAdj.estimatedRetargetDate) : null;

  return (
    <div style={{
      background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.12)",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#22d3ee", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
          Difficulty Adjustment
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: "monospace",
          color: change > 0 ? "#ef4444" : "#4ade80",
        }}>
          {change > 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
      </div>

      {/* Epoch progress bar */}
      <div style={{ position: "relative", width: "100%", height: 20, background: "rgba(255,255,255,0.04)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: "linear-gradient(90deg, #22d3ee, #8b5cf6)",
          borderRadius: 6,
          transition: "width 0.5s ease",
        }} />
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: "#fff",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          {pct.toFixed(1)}% — {remaining} blocks left
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 10 }}>
        <div>
          <span style={{ color: "#555" }}>Network Hashrate: </span>
          <span style={{ color: "#22d3ee", fontFamily: "monospace", fontWeight: 600 }}>{fmtHash(hashrate)}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ color: "#555" }}>ETA: </span>
          <span style={{ color: "#aaa", fontFamily: "monospace" }}>
            {eta ? `${eta.toLocaleDateString()} ${eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}

function MiningPoolChart({ blocks }) {
  if (!blocks.length) return null;

  const pools = {};
  blocks.forEach(b => {
    const name = b.extras?.pool?.name || "Unknown";
    pools[name] = (pools[name] || 0) + 1;
  });

  const sorted = Object.entries(pools).sort((a, b) => b[1] - a[1]);
  const colors = ["#f7931a", "#4ade80", "#22d3ee", "#8b5cf6", "#ef4444", "#facc15", "#f97316", "#ec4899"];

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>
        Last {blocks.length} Blocks — Pool Distribution
      </div>
      {/* Stacked bar */}
      <div style={{ display: "flex", width: "100%", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
        {sorted.map(([name, count], i) => (
          <div key={name} style={{
            width: `${(count / blocks.length) * 100}%`, height: "100%",
            background: colors[i % colors.length],
          }} title={`${name}: ${count}`} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
        {sorted.map(([name, count], i) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
            <span style={{ color: "#999" }}>{name}</span>
            <span style={{ color: "#555", fontFamily: "monospace" }}>({count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockchainTab({ chain, chip }) {
  const { blocks, mempool, diffAdj, price, hashrate, fees, flash } = chain;
  const c = CHIPS[chip];
  const livePrice = price?.USD || BTC.price;
  const jackpot = BTC.block_reward * livePrice;
  const liveHashEhs = hashrate ? hashrate / 1e18 : BTC.hashrate_ehs;
  const liveProb = (c.btc_mhs * 1e6) / (liveHashEhs * 1e18);
  const liveAnnual = 1 - Math.pow(1 - liveProb, BTC.blocks_year);

  return (
    <div>
      {/* Flash overlay on new block */}
      {flash && (
        <div style={{
          padding: "10px 16px", marginBottom: 12, borderRadius: 8,
          background: "linear-gradient(90deg, rgba(247,147,26,0.15), rgba(74,222,128,0.1))",
          border: "1px solid rgba(247,147,26,0.3)",
          fontSize: 13, fontWeight: 700, color: "#f7931a", textAlign: "center",
          animation: "pulse 0.5s ease-in-out",
        }}>
          NEW BLOCK FOUND — #{blocks[0]?.height?.toLocaleString()}
        </div>
      )}

      {/* Live network stats bar */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12,
      }}>
        <Stat label="BTC Price" value={`$${(livePrice).toLocaleString()}`} sub="Live" accent small />
        <Stat label="Jackpot" value={`$${(jackpot / 1000).toFixed(0)}K`} sub={`${BTC.block_reward} BTC`} small />
        <Stat label="Your Odds" value={`${(liveAnnual * 100).toFixed(4)}%`} sub="Annual (live diff)" small />
        <Stat label="Block Height" value={blocks[0]?.height?.toLocaleString() || "--"} sub={blocks[0] ? timeAgo(blocks[0].timestamp) : ""} small />
      </div>

      <BlockCountdown blocks={blocks} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <MempoolVisual mempool={mempool} fees={fees} />
        <DifficultyGauge diffAdj={diffAdj} hashrate={hashrate} />
      </div>

      <MiningPoolChart blocks={blocks} />

      {/* Recent blocks */}
      <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, margin: "16px 0 8px" }}>
        Recent Blocks
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {blocks.slice(0, 6).map((b, i) => (
          <BlockVisual key={b.id} block={b} isLatest={i === 0} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================

export default function App() {
  const [chip, setChip] = useState("M1 (8 GPU)");
  const [tab, setTab] = useState("blocks");
  const [stats, setStats] = useState(null);
  const chain = useBlockchain();
  const s = calc(chip);

  // Poll stats.json every 10 seconds
  useEffect(() => {
    const load = () => {
      fetch("/api/stats")
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setStats(d))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const tabs = [
    { id: "blocks", label: "Blocks" },
    { id: "live", label: "Miner" },
    { id: "overview", label: "Overview" },
    { id: "btc", label: "BTC" },
    { id: "xmr", label: "XMR" },
    { id: "optimize", label: "Optimize" },
    { id: "commands", label: "Commands" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", padding: "28px 20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&display=swap');
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f7931a", boxShadow: "0 0 20px rgba(247,147,26,0.5), 0 0 40px rgba(247,147,26,0.2)", animation: "pulse 2.5s ease-in-out infinite" }} />
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
              <span style={{ color: "#f7931a" }}>BTC</span> + <span style={{ color: "#ff6600" }}>XMR</span> Dual Mining Dashboard
            </h1>
          </div>
          <HashStream />
          <p style={{ color: "#444", fontSize: 12, margin: "4px 0 0" }}>GPU &rarr; BTC lottery &nbsp;|&nbsp; CPU &rarr; XMR income &nbsp;|&nbsp; Mac M1 Apple Silicon</p>
        </div>

        {/* Chip selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {Object.keys(CHIPS).map(c => (
            <button key={c} onClick={() => setChip(c)} style={{
              padding: "7px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: chip === c ? 600 : 400,
              border: `1px solid ${chip === c ? "#f7931a" : "rgba(255,255,255,0.07)"}`,
              background: chip === c ? "rgba(247,147,26,0.08)" : "rgba(255,255,255,0.02)",
              color: chip === c ? "#f7931a" : "#777",
            }}>{c}</button>
          ))}
        </div>

        {/* Headline stats */}
        <div style={{
          background: "linear-gradient(135deg, rgba(247,147,26,0.06), rgba(255,102,0,0.04))",
          border: "1px solid rgba(247,147,26,0.15)", borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>BTC Lottery</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#f7931a", fontFamily: "monospace" }}>{(s.btc_annual * 100).toFixed(4)}%</div>
              <div style={{ fontSize: 10, color: "#555" }}>annual chance</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>BTC Jackpot</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>${((BTC.block_reward * (chain.price?.USD || BTC.price)) / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 10, color: "#555" }}>{BTC.block_reward} BTC @ ${(chain.price?.USD || BTC.price).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>XMR Monthly</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#ff6600", fontFamily: "monospace" }}>${s.xmr_monthly_usd.toFixed(1)}</div>
              <div style={{ fontSize: 10, color: "#555" }}>{s.xmr_monthly_coins.toFixed(4)} XMR</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Net Profit</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.net_monthly >= 0 ? "#4ade80" : "#ef4444", fontFamily: "monospace" }}>
                {s.net_monthly >= 0 ? "+" : ""}${s.net_monthly.toFixed(1)}
              </div>
              <div style={{ fontSize: 10, color: "#555" }}>/month after electricity</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 16px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
              border: `1px solid ${tab === t.id ? "rgba(255,255,255,0.15)" : "transparent"}`,
              background: tab === t.id ? "rgba(255,255,255,0.06)" : "transparent",
              color: tab === t.id ? "#e8e8e8" : "#666",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 20 }}>

          {tab === "blocks" && <BlockchainTab chain={chain} chip={chip} />}

          {tab === "live" && <LiveStatus stats={stats} />}

          {tab === "overview" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
                <Stat label="BTC Hashrate" value={`${s.btc_mhs >= 1000 ? (s.btc_mhs / 1000).toFixed(1) + " GH/s" : s.btc_mhs + " MH/s"}`} sub="Metal GPU" small />
                <Stat label="XMR Hashrate" value={`${s.xmr_hs} H/s`} sub="RandomX CPU" small />
                <Stat label="Odds/Block" value={`1:${(s.btc_odds / 1e6).toFixed(1)}M`} sub="Every ~10 min" small />
                <Stat label="Expected Wait" value={`${s.btc_years >= 1000 ? (s.btc_years / 1000).toFixed(0) + "K yr" : s.btc_years.toFixed(0) + " yr"}`} sub="Statistical avg" small />
                <Stat label="Power Draw" value={`${s.power}W`} sub={`${Math.round(s.elec_monthly_thb)} THB/mo`} small />
                <Stat label="BTC Lottery" value="FREE" sub="Covered by XMR" small accent />
              </div>
              <div style={{ padding: "12px 16px", background: "rgba(247,147,26,0.04)", borderRadius: 8, fontSize: 12, color: "#888", lineHeight: 1.7 }}>
                <strong style={{ color: "#f7931a" }}>How it works:</strong> Your GPU runs Bitcoin SHA-256 hashes via Metal shaders — pure lottery, 52,500 draws/year. Simultaneously, your CPU mines Monero via RandomX pool mining — steady income that covers electricity. Net result: free BTC lottery tickets funded by XMR earnings.
              </div>
            </div>
          )}

          {tab === "btc" && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#f7931a", margin: "0 0 12px" }}>Bitcoin Solo Mining — GPU Lottery</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                <Stat label="Your Hashrate" value={`${s.btc_mhs >= 1000 ? (s.btc_mhs / 1000).toFixed(1) + " GH/s" : s.btc_mhs + " MH/s"}`} sub="Metal GPU" accent small />
                <Stat label="Network" value={`${BTC.hashrate_ehs} EH/s`} sub={`Diff: ${BTC.difficulty_t}T`} small />
                <Stat label="Annual Chance" value={`${(s.btc_annual * 100).toFixed(4)}%`} sub={`${BTC.blocks_year.toLocaleString()} blocks/yr`} accent small />
              </div>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Solo Pools</div>
              {BTC_POOLS.map(p => (
                <div key={p.name} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", marginBottom: 4, background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)", borderRadius: 6, fontSize: 12,
                }}>
                  <div><span style={{ color: "#ddd", fontWeight: 600 }}>{p.name}</span> <span style={{ color: "#444", fontFamily: "monospace", fontSize: 10 }}>{p.host}</span></div>
                  <div style={{ display: "flex", gap: 12, color: "#777", fontSize: 11 }}>
                    <span>Fee: <b style={{ color: p.fee === "0%" ? "#4ade80" : "#f7931a" }}>{p.fee}</b></span>
                    <span>Blocks: <b style={{ color: "#aaa" }}>{p.blocks}</b></span>
                    <span style={{ color: "#555" }}>{p.note}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "xmr" && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#ff6600", margin: "0 0 12px" }}>Monero Pool Mining — CPU Income</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                <Stat label="Daily" value={`${s.xmr_daily_coins.toFixed(5)} XMR`} sub={`$${s.xmr_daily_usd.toFixed(2)}`} small />
                <Stat label="Monthly" value={`${s.xmr_monthly_coins.toFixed(4)} XMR`} sub={`$${s.xmr_monthly_usd.toFixed(1)} / ${Math.round(s.xmr_monthly_usd * 34)} THB`} accent small />
                <Stat label="Yearly" value={`$${s.xmr_yearly_usd.toFixed(0)}`} sub={`${(s.xmr_daily_coins * 365).toFixed(2)} XMR`} small />
              </div>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Pool Mining Options</div>
              {XMR_POOLS.map(p => (
                <div key={p.name} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", marginBottom: 4, background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)", borderRadius: 6, fontSize: 12,
                }}>
                  <div><span style={{ color: "#ddd", fontWeight: 600 }}>{p.name}</span> <span style={{ color: "#444", fontFamily: "monospace", fontSize: 10 }}>{p.host}</span></div>
                  <div style={{ display: "flex", gap: 12, color: "#777", fontSize: 11 }}>
                    <span>Fee: <b style={{ color: p.fee === "0%" ? "#4ade80" : "#f7931a" }}>{p.fee}</b></span>
                    <span>Min: <b style={{ color: "#aaa" }}>{p.min}</b></span>
                    <span style={{ color: "#555" }}>{p.region}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: 10, background: "rgba(255,102,0,0.06)", borderRadius: 6, fontSize: 11, color: "#ff6600", lineHeight: 1.6 }}>
                <strong>Why Monero?</strong> RandomX is purpose-built for CPUs — no ASIC advantage. Apple Silicon arm64 runs it efficiently. Pool mining = predictable daily payouts. HashVault (0% fee, 0.003 XMR min payout) recommended.
              </div>
            </div>
          )}

          {tab === "optimize" && <Checklist />}

          {tab === "commands" && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#ccc", margin: "0 0 10px" }}>Dual Mining</h3>
              <CmdBlock cmds={[
                { l: "Start all", c: "~/dual-miner.sh" },
                { l: "BTC test", c: "~/.dual-miner/MacMetalCLI --test" },
                { l: "XMR manual", c: "xmrig --config=~/.dual-miner/xmrig-config.json" },
                { l: "Check status", c: "cat ~/.dual-miner/stats.json | python3 -m json.tool" },
                { l: "View BTC log", c: "tail -f ~/.dual-miner/btc.log" },
                { l: "View XMR log", c: "tail -f ~/.dual-miner/xmr.log" },
              ]} />
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#ccc", margin: "16px 0 10px" }}>System</h3>
              <CmdBlock cmds={[
                { l: "Disable sleep", c: "sudo pmset -a disablesleep 1 && sudo pmset -a sleep 0" },
                { l: "Kill App Nap", c: "defaults write NSGlobalDomain NSAppSleepDisabled -bool YES" },
                { l: "Thermals", c: "sudo powermetrics --samplers thermal,cpu_power,gpu_power -i 2000 -n 1" },
                { l: "Stop mining", c: "launchctl unload ~/Library/LaunchAgents/com.dual-miner.plist" },
                { l: "Start mining", c: "launchctl load ~/Library/LaunchAgents/com.dual-miner.plist" },
              ]} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", fontSize: 11, color: "#777", lineHeight: 1.6 }}>
          <strong style={{ color: "#ef4444" }}>Disclaimer:</strong> BTC solo mining is pure lottery — expected wait ~{s.btc_years.toFixed(0)} years at {s.btc_mhs} MH/s. XMR pool mining generates ~${s.xmr_monthly_usd.toFixed(1)}/mo. Electricity ~{Math.round(s.elec_monthly_thb)} THB/mo. Not financial advice.
        </div>
      </div>
    </div>
  );
}
