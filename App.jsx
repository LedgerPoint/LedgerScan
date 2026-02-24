import { useState, useCallback } from "react";

const TICKER_UNIVERSE = [
  "RDDT","IONQ","SOUN","BBAI","GTLB","CFLT","DDOG","ALAB","SMAR","MGNI",
  "RKLB","LUNR","ASTS","ACHR","JOBY",
  "RXRX","ACLX","TGTX","NVAX","CRVS",
  "DAVE","AFRM","HOOD","IREN","PAYO",
  "ENVX","CHPT","STEM","BLNK","NKLA",
  "S","QLYS","TENB","VRNS",
  "BRZE","FRSH","WEAV",
  "CART","SG","XPOF",
  "MARA","RIOT","CLSK","CORZ",
  "GENI","SKLZ",
  "MP","GATO",
  "OPEN","HOUS",
  "VFS","LAUR","KPLT",
];

const SECTOR_MAP = {
  RDDT:"Social Media", IONQ:"Quantum Tech", SOUN:"Voice AI", BBAI:"Gov AI",
  GTLB:"DevOps SaaS", CFLT:"Data Cloud", DDOG:"Cloud Monitor", ALAB:"AI Connectivity",
  SMAR:"SaaS", MGNI:"AdTech", RKLB:"Space Launch", LUNR:"Lunar Space",
  ASTS:"Space Telecom", ACHR:"eVTOL", JOBY:"eVTOL",
  RXRX:"AI Drug Disc", ACLX:"Cell Therapy", TGTX:"Autoimmune",
  NVAX:"Vaccines", CRVS:"Oncology",
  DAVE:"Neobank", AFRM:"Buy Now Pay Later", HOOD:"Retail Broker", IREN:"Crypto Mining",
  PAYO:"Cross-Border Pay",
  ENVX:"Battery Tech", CHPT:"EV Charging", STEM:"Energy Storage",
  BLNK:"EV Charging", NKLA:"EV Trucks",
  S:"Cybersecurity", QLYS:"Cloud Security", TENB:"Cybersecurity", VRNS:"Data Security",
  BRZE:"Customer Engagement", FRSH:"Customer Service SaaS", WEAV:"Payments SaaS",
  CART:"Grocery Delivery", SG:"Fast Casual", XPOF:"Fitness",
  MARA:"Bitcoin Mining", RIOT:"Bitcoin Mining", CLSK:"Bitcoin Mining", CORZ:"Cloud Mining",
  GENI:"Sports Data", SKLZ:"Gaming",
  MP:"Rare Earth", GATO:"Silver Mining",
  OPEN:"PropTech", HOUS:"Real Estate",
  VFS:"EV Vietnam", LAUR:"EdTech", KPLT:"Fintech",
};

async function fmp(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params });
  const res = await fetch(`/api/fmp?${qs}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return data;
}

function scoreStock(s) {
  let value = 0, growth = 0, discovery = 0;
  const ps = s.priceToSalesRatio, pe = s.peRatio;
  const rev = s.revGrowth, cap = s.marketCap;

  if (ps && ps > 0) {
    if (ps < 1) value += 15;
    else if (ps < 3) value += 12;
    else if (ps < 6) value += 8;
    else if (ps < 12) value += 4;
  }
  if (pe && pe > 0 && pe < 500) {
    if (pe < 12) value += 15;
    else if (pe < 20) value += 10;
    else if (pe < 35) value += 5;
  } else { value += 3; }

  if (rev != null) {
    if (rev > 1.5) growth += 20;
    else if (rev > 0.8) growth += 15;
    else if (rev > 0.4) growth += 10;
    else if (rev > 0.15) growth += 5;
    else if (rev < 0) growth -= 5;
  }

  if (!cap || cap < 300e6) discovery += 7;
  else if (cap < 1e9) discovery += 4;
  else if (cap < 2e9) discovery += 2;
  discovery += 8;

  return {
    total: Math.max(0, Math.min(100, value + growth + discovery)),
    scoreValue: Math.max(0, value),
    scoreGrowth: Math.max(0, growth),
    scoreDiscovery: Math.max(0, discovery),
  };
}

const fmtCap = v => !v ? "N/A" : v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
const fmtPct = v => v == null ? "N/A" : v >= 0 ? `+${(v*100).toFixed(0)}%` : `${(v*100).toFixed(0)}%`;
const fmtNum = v => (v && v > 0 && v < 999) ? `${v.toFixed(1)}x` : "—";

function MiniBar({ value, max, color, label }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ flex:1 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
        <span style={{ fontSize:10, color:"#888" }}>{label}</span>
        <span style={{ fontSize:10, color, fontWeight:600 }}>{value}</span>
      </div>
      <div style={{ height:5, borderRadius:3, background:"#e9ecf0", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.7s ease" }} />
      </div>
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, color, background:bg, marginRight:4, marginBottom:4, fontFamily:"'DM Mono',monospace", border:`1px solid ${color}33` }}>
      {label}
    </span>
  );
}

const CONVICTION = {
  HIGH:   { color:"#22c55e", bg:"rgba(34,197,94,0.1)",  label:"✓ Strong Buy" },
  MEDIUM: { color:"#f59e0b", bg:"rgba(245,158,11,0.1)", label:"◎ Worth Watching" },
  LOW:    { color:"#ef4444", bg:"rgba(239,68,68,0.1)",  label:"⚠ High Risk" },
};

export default function LedgerScan() {
  const [filters, setFilters]     = useState({ sector:"all", minScore:0, capFilter:"all" });
  const [results, setResults]     = useState([]);
  const [scanned, setScanned]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [loadMsg, setLoadMsg]     = useState("");
  const [error, setError]         = useState(null);
  const [expanded, setExpanded]   = useState({});
  const [analyses, setAnalyses]   = useState({});
  const [analyzing, setAnalyzing] = useState({});
  const [showGuide, setShowGuide] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const runScan = useCallback(async () => {
    setLoading(true); setError(null); setResults([]);
    setExpanded({}); setAnalyses({}); setScanned(false);
    try {
      const batches = [];
      for (let i = 0; i < TICKER_UNIVERSE.length; i += 20)
        batches.push(TICKER_UNIVERSE.slice(i, i + 20));

      setLoadMsg(`Fetching live data for ${TICKER_UNIVERSE.length} stocks...`);

      const batchResults = await Promise.all(
        batches.map(batch => {
          const t = batch.join(",");
          return Promise.all([
            fmp(`profile/${t}`).catch(() => []),
            fmp(`quote/${t}`).catch(() => []),
          ]);
        })
      );

      setLoadMsg("Scoring and ranking...");
      const profileMap = {}, quoteMap = {};
      batchResults.forEach(([profiles, quotes]) => {
        if (Array.isArray(profiles)) profiles.forEach(p => { profileMap[p.symbol] = p; });
        if (Array.isArray(quotes))   quotes.forEach(q => { quoteMap[q.symbol] = q; });
      });

      let merged = TICKER_UNIVERSE.map(ticker => {
        const p = profileMap[ticker] || {};
        const q = quoteMap[ticker] || {};
        if (!p.symbol && !q.symbol) return null;
        const stock = {
          ticker,
          name: p.companyName || ticker,
          sector: p.sector || SECTOR_MAP[ticker] || "Unknown",
          industry: p.industry || "",
          exchange: p.exchangeShortName || "",
          price: q.price || p.price || 0,
          marketCap: p.mktCap || q.marketCap || 0,
          beta: p.beta || null,
          description: p.description || null,
          change: q.changesPercentage || null,
          priceToSalesRatio: p.priceToSalesRatio || null,
          peRatio: p.pe || null,
          revGrowth: p.revenueGrowth || null,
        };
        return { ...stock, ...scoreStock(stock) };
      }).filter(Boolean);

      if (filters.sector !== "all") {
        merged = merged.filter(s =>
          (s.sector || "").toLowerCase().includes(filters.sector.toLowerCase()) ||
          (SECTOR_MAP[s.ticker] || "").toLowerCase().includes(filters.sector.toLowerCase())
        );
      }
      if (filters.capFilter !== "all") {
        merged = merged.filter(s => {
          const c = s.marketCap;
          if (filters.capFilter === "micro") return c > 0 && c < 300e6;
          if (filters.capFilter === "small") return c >= 300e6 && c < 2e9;
          if (filters.capFilter === "mid")   return c >= 2e9 && c < 10e9;
          if (filters.capFilter === "large") return c >= 10e9;
          return true;
        });
      }
      merged = merged.filter(s => s.total >= filters.minScore && s.price > 0)
                     .sort((a, b) => b.total - a.total);

      if (!merged.length) throw new Error("No results matched your filters — try broadening them.");
      setResults(merged);
      setScanned(true);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setLoading(false); setLoadMsg("");
  }, [filters]);

  const analyseStock = async (stock) => {
    const open = !expanded[stock.ticker];
    setExpanded(p => ({ ...p, [stock.ticker]: open }));
    if (!open || analyses[stock.ticker]) return;
    setAnalyzing(p => ({ ...p, [stock.ticker]: true }));

    const prompt = `You are a friendly investment analyst explaining a stock to a beginner.
Return ONLY valid JSON, no markdown, no extra text.

Stock: ${stock.ticker} — ${stock.name}
Sector: ${stock.sector} | Market Cap: ${fmtCap(stock.marketCap)} | Price: $${stock.price}
Revenue Growth: ${fmtPct(stock.revGrowth)} | P/S: ${fmtNum(stock.priceToSalesRatio)} | P/E: ${fmtNum(stock.peRatio)}
Beta: ${stock.beta ?? "Unknown"}
${stock.description ? "Description: " + stock.description.slice(0,300) : ""}

{
  "plainEnglishSummary": "2-3 sentences, simple language, what they do and why interesting",
  "whyItCouldGrow": ["reason 1","reason 2","reason 3","reason 4"],
  "mainRisks": ["risk 1","risk 2","risk 3"],
  "verdict": "Buy / Watch / Avoid",
  "timeHorizon": "e.g. 1-2 years",
  "potentialUpside": "e.g. +40% in a good scenario",
  "conviction": "HIGH or MEDIUM or LOW",
  "beginnerTip": "one practical tip for a new investor"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{ role:"user", content:prompt }] })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type==="text")?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setAnalyses(p => ({ ...p, [stock.ticker]: parsed }));
    } catch {
      setAnalyses(p => ({ ...p, [stock.ticker]: { plainEnglishSummary:"Analysis unavailable.", whyItCouldGrow:["N/A"], mainRisks:["N/A"], verdict:"N/A", timeHorizon:"N/A", potentialUpside:"N/A", conviction:"LOW", beginnerTip:"" }}));
    }
    setAnalyzing(p => ({ ...p, [stock.ticker]: false }));
  };

  const topPick = results[0];

  return (
    <div style={{ minHeight:"100vh", background:"#f0f2f7", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;600&family=Playfair+Display:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .card{background:white;border:1px solid #e2e6ef;border-radius:16px;}
        .stock-row{background:white;border:1px solid #e2e6ef;border-radius:16px;margin-bottom:10px;overflow:hidden;transition:box-shadow 0.2s,border-color 0.2s;}
        .stock-row:hover{box-shadow:0 4px 20px rgba(0,0,0,0.07);border-color:#c5cde0;}
        .row-main{display:grid;grid-template-columns:60px 1fr auto auto;align-items:center;gap:16px;padding:16px 20px;cursor:pointer;}
        .analysis-body{border-top:1px solid #f0f2f7;padding:22px 20px;background:#fafbfd;animation:fadeIn 0.2s ease;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .filter-select{border:1.5px solid #dde2ed;border-radius:10px;padding:9px 12px;font-family:'DM Sans',sans-serif;font-size:13px;color:#374151;background:white;outline:none;transition:border-color 0.2s;cursor:pointer;}
        .filter-select:focus{border-color:#6366f1;}
        .scan-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;padding:10px 28px;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 14px rgba(99,102,241,0.35);white-space:nowrap;}
        .scan-btn:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(99,102,241,0.45);}
        .scan-btn:disabled{background:#d1d5db;box-shadow:none;transform:none;cursor:not-allowed;}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;border:1.5px solid #e2e6ef;background:white;font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:#6b7280;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
        .pill:hover{border-color:#6366f1;color:#6366f1;}
        .pill.active{border-color:#6366f1;color:#6366f1;background:#f0efff;}
        .metric-chip{display:flex;flex-direction:column;align-items:center;padding:8px 12px;background:#f8fafc;border:1px solid #edf0f7;border-radius:10px;min-width:60px;text-align:center;}
        .spinner{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 12px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:680px){.row-main{grid-template-columns:48px 1fr;}.hide-mobile{display:none!important;}}
      `}</style>

      <div style={{ background:"#0f0f1a", borderBottom:"1px solid #1e2235", padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:900, color:"white" }}>Ledger<span style={{ color:"#818cf8" }}>Scan</span></div>
          <div style={{ fontSize:11, color:"#4b5280", marginTop:1, fontFamily:"'DM Mono',monospace" }}>
            LIVE · {TICKER_UNIVERSE.length} growth stocks · powered by FMP
            {lastUpdated && <span style={{ marginLeft:8, color:"#22c55e" }}>· Updated {lastUpdated}</span>}
          </div>
        </div>
        <button className="pill" style={{ background:"transparent", borderColor:"#2d3158", color:"#6b7280" }} onClick={() => setShowGuide(v=>!v)}>
          {showGuide ? "✕ Close" : "? How it works"}
        </button>
      </div>

      <div style={{ maxWidth:960, margin:"0 auto", padding:"24px 18px" }}>

        {showGuide && (
          <div className="card" style={{ padding:"22px", marginBottom:18 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#1e1b4b", marginBottom:14 }}>How LedgerScan works</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:14, marginBottom:18 }}>
              {[
                { icon:"📡", title:"Live market data", text:`Tracks ${TICKER_UNIVERSE.length} hand-picked growth companies with real prices and fundamentals from Financial Modeling Prep.` },
                { icon:"📊", title:"Scores 0–100", text:"Each stock scored on Value (cheap?), Growth (growing fast?), and Discovery (still under the radar?)." },
                { icon:"🤖", title:"AI analyst breakdown", text:"Click any stock for plain-English analysis — what they do, why they might grow, key risks, and a beginner tip." },
                { icon:"⚠️", title:"Ideas, not advice", text:"LedgerScan surfaces ideas. Always research yourself and consider a financial advisor before investing." },
              ].map(c => (
                <div key={c.title} style={{ background:"#f8fafc", borderRadius:12, padding:14 }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
                  <div style={{ fontWeight:600, fontSize:13, color:"#1e1b4b", marginBottom:4 }}>{c.title}</div>
                  <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.6 }}>{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ padding:"18px 20px", marginBottom:18 }}>
          <div style={{ fontWeight:600, fontSize:14, color:"#1e1b4b", marginBottom:14 }}>Scan filters <span style={{ fontWeight:400, fontSize:12, color:"#9ca3af" }}>· live data from FMP</span></div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={{ fontSize:10, color:"#9ca3af", fontWeight:600, letterSpacing:"0.5px" }}>SECTOR</label>
              <select className="filter-select" value={filters.sector} onChange={e=>setFilters(p=>({...p,sector:e.target.value}))}>
                <option value="all">All sectors</option>
                <option value="tech">Tech / AI</option>
                <option value="space">Space & Aerospace</option>
                <option value="biotech">Biotech & Health</option>
                <option value="fintech">Fintech</option>
                <option value="ev">EV & Clean Energy</option>
                <option value="cyber">Cybersecurity</option>
                <option value="saas">SaaS / Cloud</option>
                <option value="crypto">Crypto / Mining</option>
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={{ fontSize:10, color:"#9ca3af", fontWeight:600, letterSpacing:"0.5px" }}>COMPANY SIZE</label>
              <select className="filter-select" value={filters.capFilter} onChange={e=>setFilters(p=>({...p,capFilter:e.target.value}))}>
                <option value="all">Any size</option>
                <option value="micro">Tiny (&lt;$300M) — highest risk/reward</option>
                <option value="small">Small ($300M–$2B)</option>
                <option value="mid">Mid ($2B–$10B)</option>
                <option value="large">Large ($10B+)</option>
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={{ fontSize:10, color:"#9ca3af", fontWeight:600, letterSpacing:"0.5px" }}>MIN SCORE</label>
              <select className="filter-select" value={filters.minScore} onChange={e=>setFilters(p=>({...p,minScore:+e.target.value}))}>
                <option value={0}>Show all</option>
                <option value={20}>20+ only</option>
                <option value={35}>35+ interesting</option>
                <option value={50}>50+ strong</option>
                <option value={65}>65+ top picks</option>
              </select>
            </div>
            <button className="scan-btn" onClick={runScan} disabled={loading}>
              {loading ? "Scanning…" : "🔍 Scan Live Market"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:12, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#dc2626" }}>⚠ {error}</div>
        )}

        {loading && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div className="spinner" />
            <div style={{ fontSize:14, fontWeight:500, color:"#374151" }}>{loadMsg}</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:6 }}>Pulling real prices and fundamentals from FMP</div>
          </div>
        )}

        {!loading && scanned && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:14 }}>
            <div>
              <span style={{ fontWeight:700, fontSize:16, color:"#1e1b4b" }}>{results.length} companies found</span>
              <span style={{ fontSize:12, color:"#9ca3af", marginLeft:8 }}>· sorted by LedgerScan score</span>
            </div>
            <div style={{ fontSize:11, color:"#6b7280", background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"5px 12px" }}>
              💡 Click any row for a full AI breakdown
            </div>
          </div>
        )}

        {!loading && scanned && topPick && topPick.total >= 40 && (
          <div style={{ background:"linear-gradient(135deg,#f0f0ff,#faf0ff)", border:"1.5px solid #c4b5fd", borderRadius:14, padding:"14px 20px", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:28 }}>⭐</div>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:"#4f46e5" }}>Top Pick: {topPick.ticker} — {topPick.name}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
                Scored <strong>{topPick.total}/100</strong>.
                {topPick.revGrowth > 0 && ` Revenue up ${fmtPct(topPick.revGrowth)} YoY.`}
                {topPick.priceToSalesRatio && topPick.priceToSalesRatio < 5 && ` P/S of ${topPick.priceToSalesRatio.toFixed(1)}x looks attractive.`}
              </div>
            </div>
          </div>
        )}

        {!loading && scanned && results.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:"#9ca3af" }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🔎</div>
            <div style={{ fontSize:14, fontWeight:500, color:"#374151" }}>No results matched your filters</div>
          </div>
        )}

        {!loading && results.map((stock, idx) => {
          const isOpen = expanded[stock.ticker];
          const analysis = analyses[stock.ticker];
          const isAnalysing = analyzing[stock.ticker];
          const scoreColor = stock.total >= 60 ? "#22c55e" : stock.total >= 35 ? "#6366f1" : "#f59e0b";
          const rankColors = ["#f59e0b","#94a3b8","#cd7f32"];

          return (
            <div key={stock.ticker} className="stock-row">
              <div className="row-main" onClick={() => analyseStock(stock)}>
                <div style={{ width:52, height:52, borderRadius:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:`${scoreColor}15`, border:`2px solid ${scoreColor}40`, color:scoreColor, fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:20 }}>
                  {stock.total}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:15, fontWeight:600, color:"#1e1b4b" }}>{stock.ticker}</span>
                    <span style={{ fontSize:13, color:"#6b7280", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>{stock.name}</span>
                    {idx < 3 && <span style={{ fontSize:9, background:rankColors[idx]+"22", color:rankColors[idx], border:`1px solid ${rankColors[idx]}44`, borderRadius:20, padding:"1px 6px", fontWeight:700 }}>#{idx+1}</span>}
                    {stock.change != null && <span style={{ fontSize:11, fontWeight:600, color:stock.change>=0?"#22c55e":"#ef4444" }}>{stock.change>=0?"+":""}{stock.change?.toFixed(2)}%</span>}
                  </div>
                  <div style={{ marginTop:4, display:"flex", flexWrap:"wrap" }}>
                    <Badge label={stock.sector} color="#6366f1" bg="rgba(99,102,241,0.07)" />
                    {stock.exchange && <Badge label={stock.exchange} color="#6b7280" bg="#f3f4f6" />}
                    {stock.marketCap > 0 && <Badge label={fmtCap(stock.marketCap)} color="#6b7280" bg="#f3f4f6" />}
                    {stock.revGrowth > 0.4 && <Badge label={`🚀 ${fmtPct(stock.revGrowth)} rev`} color="#22c55e" bg="rgba(34,197,94,0.07)" />}
                    {stock.marketCap > 0 && stock.marketCap < 500e6 && <Badge label="🔭 Micro cap" color="#8b5cf6" bg="rgba(139,92,246,0.07)" />}
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:8, maxWidth:320 }}>
                    <MiniBar value={stock.scoreValue} max={30} color="#6366f1" label="Value" />
                    <MiniBar value={stock.scoreGrowth} max={40} color="#22c55e" label="Growth" />
                    <MiniBar value={stock.scoreDiscovery} max={30} color="#f59e0b" label="Discovery" />
                  </div>
                </div>
                <div className="hide-mobile" style={{ display:"flex", gap:8 }}>
                  <div className="metric-chip">
                    <span style={{ fontSize:14, fontWeight:700, color:"#1e1b4b" }}>${stock.price?.toFixed(2)}</span>
                    <span style={{ fontSize:10, color:"#9ca3af", marginTop:1 }}>Price</span>
                  </div>
                  <div className="metric-chip">
                    <span style={{ fontSize:14, fontWeight:700, color:stock.revGrowth>0.3?"#22c55e":stock.revGrowth<0?"#ef4444":"#f59e0b" }}>{fmtPct(stock.revGrowth)}</span>
                    <span style={{ fontSize:10, color:"#9ca3af", marginTop:1 }}>Rev Growth</span>
                  </div>
                  <div className="metric-chip">
                    <span style={{ fontSize:14, fontWeight:700, color:"#6366f1" }}>{fmtNum(stock.priceToSalesRatio)}</span>
                    <span style={{ fontSize:10, color:"#9ca3af", marginTop:1 }}>P/S</span>
                  </div>
                  <div className="metric-chip">
                    <span style={{ fontSize:14, fontWeight:700, color:"#374151" }}>{fmtNum(stock.peRatio)}</span>
                    <span style={{ fontSize:10, color:"#9ca3af", marginTop:1 }}>P/E</span>
                  </div>
                </div>
                <button className={`pill ${isOpen?"active":""}`} style={{ fontSize:11, padding:"6px 12px" }}
                  onClick={e=>{e.stopPropagation();analyseStock(stock);}}>
                  {isAnalysing ? "Loading…" : isOpen ? "▲ Close" : "▼ AI Breakdown"}
                </button>
              </div>

              {isOpen && (
                <div className="analysis-body">
                  {isAnalysing && (
                    <div style={{ textAlign:"center", padding:"28px 0" }}>
                      <div className="spinner" />
                      <div style={{ fontSize:13, color:"#6b7280" }}>Analysing {stock.ticker}…</div>
                    </div>
                  )}
                  {analysis && !isAnalysing && (() => {
                    const conv = CONVICTION[analysis.conviction] || CONVICTION.LOW;
                    return (
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", background:conv.bg, border:`1px solid ${conv.color}44`, borderRadius:12, padding:"12px 16px", marginBottom:16 }}>
                          <span style={{ fontWeight:700, color:conv.color, fontSize:14 }}>{conv.label}</span>
                          <span style={{ fontSize:13, color:"#374151" }}>· {analysis.verdict}</span>
                          <span style={{ fontSize:12, color:"#6b7280", marginLeft:"auto" }}>{analysis.potentialUpside} · {analysis.timeHorizon}</span>
                        </div>
                        <div style={{ background:"white", border:"1px solid #e5e9f0", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                          <div style={{ fontSize:10, color:"#9ca3af", fontWeight:600, letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:6 }}>What is this company?</div>
                          <div style={{ fontSize:13, color:"#374151", lineHeight:1.7 }}>{analysis.plainEnglishSummary}</div>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                          <div style={{ background:"white", border:"1px solid #e5e9f0", borderRadius:12, padding:"14px 16px" }}>
                            <div style={{ fontSize:10, color:"#22c55e", fontWeight:600, letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:10 }}>Why it could grow 📈</div>
                            {analysis.whyItCouldGrow?.map((r,i) => (
                              <div key={i} style={{ display:"flex", gap:8, marginBottom:8, fontSize:12, color:"#374151", lineHeight:1.5 }}>
                                <span style={{ color:"#22c55e", flexShrink:0, fontWeight:700 }}>✓</span>{r}
                              </div>
                            ))}
                          </div>
                          <div style={{ background:"white", border:"1px solid #e5e9f0", borderRadius:12, padding:"14px 16px" }}>
                            <div style={{ fontSize:10, color:"#ef4444", fontWeight:600, letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:10 }}>Main risks ⚠️</div>
                            {analysis.mainRisks?.map((r,i) => (
                              <div key={i} style={{ display:"flex", gap:8, marginBottom:8, fontSize:12, color:"#374151", lineHeight:1.5 }}>
                                <span style={{ color:"#ef4444", flexShrink:0, fontWeight:700 }}>!</span>{r}
                              </div>
                            ))}
                          </div>
                        </div>
                        {analysis.beginnerTip && (
                          <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:12, padding:"12px 16px", fontSize:12, color:"#92400e", lineHeight:1.6 }}>
                            <strong>💡 Tip for new investors:</strong> {analysis.beginnerTip}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {!scanned && !loading && (
          <div style={{ textAlign:"center", padding:"70px 20px" }}>
            <div style={{ fontSize:44, marginBottom:14 }}>📡</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#1e1b4b", marginBottom:8 }}>Ready to scan the live market</div>
            <div style={{ fontSize:13, color:"#9ca3af", maxWidth:420, margin:"0 auto 22px", lineHeight:1.6 }}>
              LedgerScan tracks {TICKER_UNIVERSE.length} hand-picked growth companies with real prices and fundamentals from Financial Modeling Prep.
            </div>
            <button className="scan-btn" onClick={runScan}>🔍 Scan Live Market Now</button>
          </div>
        )}

        <div style={{ marginTop:36, fontSize:11, color:"#9ca3af", lineHeight:1.7, padding:"14px 16px", background:"white", border:"1px solid #e5e9f0", borderRadius:12 }}>
          <strong style={{ color:"#6b7280" }}>⚠ Not financial advice.</strong> LedgerScan is an educational tool. Market data sourced from Financial Modeling Prep. Scores are algorithmic and do not constitute investment recommendations. Always do your own research and consult a financial advisor. Investing carries risk including possible loss of capital.
        </div>
      </div>
    </div>
  );
}
