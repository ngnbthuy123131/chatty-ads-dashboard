const fs = require('fs');
const path = require('path');

const history = JSON.parse(fs.readFileSync(path.join(__dirname, 'ads-data', 'history.json'), 'utf8'));
const dataJson = JSON.stringify(history);

const MONTHS_ORDER = ['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02'];
const MONTH_LABELS = {'2025-09':"Sep '25",'2025-10':"Oct '25",'2025-11':"Nov '25",'2025-12':"Dec '25",'2026-01':"Jan '26",'2026-02':"Feb '26"};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chatty Ads Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f1117;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}
  .header{background:#1a1d27;border-bottom:2px solid #FFD200;padding:16px 24px;display:flex;align-items:center;gap:12px}
  .header h1{font-size:20px;font-weight:700;color:#FFD200}
  .header span{color:#888;font-size:13px}
  .tabs{display:flex;gap:0;border-bottom:1px solid #2a2d3a;padding:0 24px;background:#1a1d27}
  .tab{padding:14px 20px;cursor:pointer;font-size:14px;font-weight:500;color:#888;border-bottom:2px solid transparent;transition:all 0.2s}
  .tab:hover{color:#ccc}
  .tab.active{color:#FFD200;border-bottom-color:#FFD200}
  .content{padding:24px;max-width:1400px;margin:0 auto}
  .tab-pane{display:none}
  .tab-pane.active{display:block}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
  .kpi-card{background:#1a1d27;border-radius:12px;padding:20px;border:1px solid #2a2d3a}
  .kpi-card .label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
  .kpi-card .value{font-size:28px;font-weight:700;color:#FFD200}
  .kpi-card .sub{font-size:12px;color:#666;margin-top:4px}
  .charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
  .chart-card{background:#1a1d27;border-radius:12px;padding:20px;border:1px solid #2a2d3a}
  .chart-card.full{grid-column:1/-1}
  .chart-card h3{font-size:14px;font-weight:600;color:#ccc;margin-bottom:16px}
  .chart-wrap{position:relative;height:240px}
  select,input{background:#0f1117;border:1px solid #2a2d3a;color:#e0e0e0;padding:8px 12px;border-radius:8px;font-size:14px;outline:none}
  select:focus,input:focus{border-color:#FFD200}
  .controls{display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap}
  .controls label{font-size:13px;color:#888}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{text-align:left;padding:10px 12px;background:#0f1117;color:#888;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #2a2d3a;position:sticky;top:0}
  tbody tr{border-bottom:1px solid #1e2130}
  tbody tr:hover{background:#1e2130}
  tbody td{padding:10px 12px;color:#ccc}
  .table-wrap{background:#1a1d27;border-radius:12px;border:1px solid #2a2d3a;overflow:hidden;max-height:480px;overflow-y:auto}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
  .badge-exact{background:#1A0A7A22;color:#8888ff;border:1px solid #1A0A7A}
  .badge-broad{background:#6C5CE722;color:#b88fff;border:1px solid #6C5CE7}
  .badge-camp1{background:#FF636322;color:#ff9999;border:1px solid #FF6363}
  .badge-camp2{background:#FFD20022;color:#FFD200;border:1px solid #FFD200}
  .badge-camp3{background:#00C9A722;color:#00ffcc;border:1px solid #00C9A7}
  .badge-camp4{background:#6C5CE722;color:#b88fff;border:1px solid #6C5CE7}
  .delta-pos{color:#00e676}
  .delta-neg{color:#ff5252}
  .delta-neu{color:#888}
  .search-box{width:100%;max-width:380px}
  .section-title{font-size:16px;font-weight:600;color:#ccc;margin-bottom:16px;margin-top:8px}
  .no-data{text-align:center;color:#555;padding:40px;font-size:14px}
  .bid-chips{display:flex;gap:4px;flex-wrap:wrap}
  .bid-chip{background:#1e2130;border:1px solid #2a2d3a;border-radius:4px;padding:1px 6px;font-size:11px;color:#888}
  .changes-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
  .change-card{background:#1a1d27;border-radius:12px;padding:20px;border:1px solid #2a2d3a}
  .change-card h3{font-size:14px;font-weight:600;color:#ccc;margin-bottom:12px}
  .change-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e2130;font-size:13px}
  .change-row:last-child{border:none}
  @media(max-width:768px){.kpi-row{grid-template-columns:1fr 1fr}.charts-grid{grid-template-columns:1fr}.changes-grid{grid-template-columns:1fr}}
</style>
</head>
<body>

<div class="header">
  <h1>🟡 Chatty Ads Dashboard</h1>
  <span>Sep 2025 – Feb 2026 · 4 Campaigns · Historical View</span>
</div>

<div class="tabs">
  <div class="tab active" onclick="switchTab('overview')">📈 Overview</div>
  <div class="tab" onclick="switchTab('campaign')">🎯 By Campaign</div>
  <div class="tab" onclick="switchTab('keywords')">🔑 Keywords</div>
  <div class="tab" onclick="switchTab('changes')">🔄 Changes</div>
</div>

<div class="content">

<!-- OVERVIEW -->
<div id="tab-overview" class="tab-pane active">
  <div class="kpi-row" id="kpi-row"></div>
  <div class="charts-grid">
    <div class="chart-card full"><h3>Monthly Spend by Campaign ($)</h3><div class="chart-wrap"><canvas id="chartSpend"></canvas></div></div>
    <div class="chart-card"><h3>Monthly Installs by Campaign</h3><div class="chart-wrap"><canvas id="chartInstalls"></canvas></div></div>
    <div class="chart-card"><h3>CPI Trend by Campaign ($)</h3><div class="chart-wrap"><canvas id="chartCPI"></canvas></div></div>
  </div>
</div>

<!-- BY CAMPAIGN -->
<div id="tab-campaign" class="tab-pane">
  <div class="controls">
    <label>Campaign:</label>
    <select id="campSelect" onchange="renderCampaignTab()">
      <option value="camp2">Competitor</option>
      <option value="camp3">Broad 4 Countries</option>
      <option value="camp4">Exact Other Countries</option>
      <option value="camp1">VN</option>
    </select>
    <label>Month:</label>
    <select id="campMonthSelect" onchange="renderCampaignKeywords()">
      <option value="all">All Months</option>
    </select>
  </div>
  <div class="charts-grid">
    <div class="chart-card"><h3>Monthly Spend ($)</h3><div class="chart-wrap"><canvas id="chartCampSpend"></canvas></div></div>
    <div class="chart-card"><h3>Monthly Installs &amp; CPI</h3><div class="chart-wrap"><canvas id="chartCampInstalls"></canvas></div></div>
  </div>
  <p class="section-title">Top Keywords</p>
  <div class="table-wrap"><table><thead><tr><th>Keyword</th><th>Match</th><th>Installs</th><th>Spend</th><th>CPI</th><th>Impressions</th><th>Bid</th><th>Top Countries</th></tr></thead><tbody id="campKwBody"></tbody></table></div>
</div>

<!-- KEYWORDS -->
<div id="tab-keywords" class="tab-pane">
  <div class="controls">
    <input class="search-box" type="text" id="kwSearch" placeholder="Search keyword..." oninput="renderKeywords()">
    <label>Campaign:</label>
    <select id="kwCampFilter" onchange="renderKeywords()">
      <option value="all">All</option>
      <option value="camp1">VN</option>
      <option value="camp2">Competitor</option>
      <option value="camp3">Broad 4 Countries</option>
      <option value="camp4">Exact Other Countries</option>
    </select>
  </div>
  <div class="table-wrap"><table><thead><tr><th>Keyword</th><th>Match</th><th>Campaign</th><th>Best Month</th><th>Total Installs</th><th>Total Spend</th><th>Avg CPI</th><th>Bid History</th></tr></thead><tbody id="kwBody"></tbody></table></div>
</div>

<!-- CHANGES -->
<div id="tab-changes" class="tab-pane">
  <div class="controls">
    <label>Compare:</label>
    <select id="monthA" onchange="renderChanges()">
      <option value="2025-09">Sep '25</option>
      <option value="2025-10">Oct '25</option>
      <option value="2025-11">Nov '25</option>
      <option value="2025-12" selected>Dec '25</option>
    </select>
    <span style="color:#888">vs</span>
    <select id="monthB" onchange="renderChanges()">
      <option value="2025-10">Oct '25</option>
      <option value="2025-11">Nov '25</option>
      <option value="2025-12">Dec '25</option>
      <option value="2026-01">Jan '26</option>
      <option value="2026-02" selected>Feb '26</option>
    </select>
  </div>
  <div id="changesContent"></div>
</div>

</div>

<script>
const RAW = ${dataJson};
const MONTHS = ${JSON.stringify(MONTHS_ORDER)};
const MONTH_LABELS = ${JSON.stringify(MONTH_LABELS)};
const CAMPS = ['camp1','camp2','camp3','camp4'];
const CAMP_NAMES = {camp1:'VN',camp2:'Competitor',camp3:'Broad 4 Countries',camp4:'Exact Other Countries'};
const COLORS = {camp1:'#FF6363',camp2:'#FFD200',camp3:'#00C9A7',camp4:'#6C5CE7'};
const CAMP_BADGE = {camp1:'badge-camp1',camp2:'badge-camp2',camp3:'badge-camp3',camp4:'badge-camp4'};

let charts = {};
function destroyChart(id) { if(charts[id]){charts[id].destroy();delete charts[id];} }

function fmt$(n){ return '$'+Number(n).toFixed(2); }
function fmtN(n){ return Number(n).toLocaleString(); }

function getMonthData(camp, month) {
  return RAW.campaigns[camp]?.months[month] || null;
}

function getAllMonthsData(camp) {
  return MONTHS.map(m => RAW.campaigns[camp]?.months[m] || {totalSpend:0,totalInstalls:0,cpi:0,keywords:[]});
}

// ---- OVERVIEW ----
function renderOverview() {
  // KPI
  let totalSpend=0, totalInstalls=0, bestMonthSpend=0, bestMonth='';
  CAMPS.forEach(c => {
    MONTHS.forEach(m => {
      const d = getMonthData(c,m);
      if(d){ totalSpend+=d.totalSpend; totalInstalls+=d.totalInstalls; }
    });
  });
  // best month by total installs
  let bestMonthInstalls=0;
  MONTHS.forEach(m => {
    let mi=0;
    CAMPS.forEach(c=>{ const d=getMonthData(c,m); if(d) mi+=d.totalInstalls; });
    if(mi>bestMonthInstalls){bestMonthInstalls=mi;bestMonth=m;}
  });
  const avgCPI = totalInstalls > 0 ? totalSpend/totalInstalls : 0;

  document.getElementById('kpi-row').innerHTML = \`
    <div class="kpi-card"><div class="label">Total Spend</div><div class="value">\${fmt$(totalSpend)}</div><div class="sub">Sep '25 – Feb '26</div></div>
    <div class="kpi-card"><div class="label">Total Installs</div><div class="value">\${fmtN(totalInstalls)}</div><div class="sub">All campaigns</div></div>
    <div class="kpi-card"><div class="label">Avg CPI</div><div class="value">\${fmt$(avgCPI)}</div><div class="sub">All campaigns combined</div></div>
    <div class="kpi-card"><div class="label">Best Month</div><div class="value">\${MONTH_LABELS[bestMonth]||'-'}</div><div class="sub">\${bestMonthInstalls} installs</div></div>
  \`;

  // Spend chart (stacked bar)
  destroyChart('chartSpend');
  const ctxS = document.getElementById('chartSpend').getContext('2d');
  charts['chartSpend'] = new Chart(ctxS, {
    type:'bar',
    data:{
      labels: MONTHS.map(m=>MONTH_LABELS[m]),
      datasets: CAMPS.map(c=>({
        label: CAMP_NAMES[c],
        data: MONTHS.map(m=>{const d=getMonthData(c,m);return d?d.totalSpend:0;}),
        backgroundColor: COLORS[c]+'99',
        borderColor: COLORS[c],
        borderWidth:1
      }))
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#888',font:{size:11}}}},scales:{x:{stacked:true,ticks:{color:'#666'}},y:{stacked:true,ticks:{color:'#666',callback:v=>'$'+v},grid:{color:'#1e2130'}}}}
  });

  // Installs line
  destroyChart('chartInstalls');
  const ctxI = document.getElementById('chartInstalls').getContext('2d');
  charts['chartInstalls'] = new Chart(ctxI, {
    type:'line',
    data:{
      labels: MONTHS.map(m=>MONTH_LABELS[m]),
      datasets: CAMPS.map(c=>({
        label: CAMP_NAMES[c],
        data: MONTHS.map(m=>{const d=getMonthData(c,m);return d?d.totalInstalls:0;}),
        borderColor: COLORS[c], backgroundColor: COLORS[c]+'22',
        tension:0.4, pointRadius:4, fill:false
      }))
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#888',font:{size:11}}}},scales:{x:{ticks:{color:'#666'}},y:{ticks:{color:'#666'},grid:{color:'#1e2130'}}}}
  });

  // CPI line
  destroyChart('chartCPI');
  const ctxC = document.getElementById('chartCPI').getContext('2d');
  charts['chartCPI'] = new Chart(ctxC, {
    type:'line',
    data:{
      labels: MONTHS.map(m=>MONTH_LABELS[m]),
      datasets: CAMPS.filter(c=>c!=='camp1').map(c=>({
        label: CAMP_NAMES[c],
        data: MONTHS.map(m=>{const d=getMonthData(c,m);return (d&&d.totalInstalls>0)?d.cpi:null;}),
        borderColor: COLORS[c], backgroundColor: COLORS[c]+'22',
        tension:0.4, pointRadius:4, fill:false, spanGaps:true
      }))
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#888',font:{size:11}}}},scales:{x:{ticks:{color:'#666'}},y:{ticks:{color:'#666',callback:v=>'$'+v},grid:{color:'#1e2130'}}}}
  });
}

// ---- CAMPAIGN TAB ----
function renderCampaignTab() {
  const camp = document.getElementById('campSelect').value;
  const monthSel = document.getElementById('campMonthSelect');
  monthSel.innerHTML = '<option value="all">All Months</option>' +
    MONTHS.map(m=>\`<option value="\${m}">\${MONTH_LABELS[m]}</option>\`).join('');

  const mdata = getAllMonthsData(camp);

  destroyChart('chartCampSpend');
  const ctxS = document.getElementById('chartCampSpend').getContext('2d');
  charts['chartCampSpend'] = new Chart(ctxS, {
    type:'bar',
    data:{
      labels: MONTHS.map(m=>MONTH_LABELS[m]),
      datasets:[{label:'Spend',data:mdata.map(d=>d.totalSpend),backgroundColor:COLORS[camp]+'99',borderColor:COLORS[camp],borderWidth:1}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#666'}},y:{ticks:{color:'#666',callback:v=>'$'+v},grid:{color:'#1e2130'}}}}
  });

  destroyChart('chartCampInstalls');
  const ctxI = document.getElementById('chartCampInstalls').getContext('2d');
  charts['chartCampInstalls'] = new Chart(ctxI, {
    type:'line',
    data:{
      labels: MONTHS.map(m=>MONTH_LABELS[m]),
      datasets:[
        {label:'Installs',data:mdata.map(d=>d.totalInstalls),borderColor:COLORS[camp],backgroundColor:COLORS[camp]+'22',tension:0.4,pointRadius:4,fill:true,yAxisID:'y'},
        {label:'CPI ($)',data:mdata.map(d=>d.totalInstalls>0?d.cpi:null),borderColor:'#888',borderDash:[4,4],tension:0.4,pointRadius:3,fill:false,yAxisID:'y2',spanGaps:true}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#888',font:{size:11}}}},scales:{x:{ticks:{color:'#666'}},y:{ticks:{color:'#666'},grid:{color:'#1e2130'}},y2:{position:'right',ticks:{color:'#666',callback:v=>'$'+v},grid:{display:false}}}}
  });

  renderCampaignKeywords();
}

function renderCampaignKeywords() {
  const camp = document.getElementById('campSelect').value;
  const month = document.getElementById('campMonthSelect').value;
  let keywords = [];

  if (month === 'all') {
    const kwMap = {};
    MONTHS.forEach(m => {
      const d = getMonthData(camp, m);
      if (!d) return;
      d.keywords.forEach(kw => {
        const key = kw.keyword+'|||'+kw.matchType;
        if (!kwMap[key]) kwMap[key] = {keyword:kw.keyword,matchType:kw.matchType,installs:0,spend:0,impressions:0,bid:0,countries:{}};
        kwMap[key].installs += kw.installs;
        kwMap[key].spend += kw.spend;
        kwMap[key].impressions += kw.impressions;
        kwMap[key].bid = Math.max(kwMap[key].bid, kw.bid);
        (kw.topCountries||[]).forEach(({cc,installs})=>{ kwMap[key].countries[cc]=(kwMap[key].countries[cc]||0)+installs; });
      });
    });
    keywords = Object.values(kwMap).sort((a,b)=>b.installs-a.installs).slice(0,50);
  } else {
    const d = getMonthData(camp, month);
    keywords = d ? d.keywords.slice(0,50) : [];
  }

  const tbody = document.getElementById('campKwBody');
  if (!keywords.length) { tbody.innerHTML='<tr><td colspan="8" class="no-data">No data</td></tr>'; return; }
  tbody.innerHTML = keywords.map(kw => {
    const cpi = kw.installs > 0 ? (kw.spend/kw.installs).toFixed(2) : '-';
    const topCC = (kw.topCountries||Object.entries(kw.countries||{}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([cc,n])=>({cc,installs:n}))).slice(0,3).map(x=>x.cc).join(', ');
    return \`<tr>
      <td>\${kw.keyword}</td>
      <td><span class="badge \${kw.matchType==='exact'?'badge-exact':'badge-broad'}">\${kw.matchType}</span></td>
      <td>\${kw.installs}</td>
      <td>\${fmt$(kw.spend)}</td>
      <td>\${cpi==='- '?'-':fmt$(cpi)}</td>
      <td>\${fmtN(kw.impressions)}</td>
      <td>\${fmt$(kw.bid)}</td>
      <td style="color:#888;font-size:12px">\${topCC||'-'}</td>
    </tr>\`;
  }).join('');
}

// ---- KEYWORDS ----
function renderKeywords() {
  const q = (document.getElementById('kwSearch').value||'').toLowerCase().trim();
  const campFilter = document.getElementById('kwCampFilter').value;

  const kwMap = {};
  CAMPS.forEach(camp => {
    if (campFilter !== 'all' && camp !== campFilter) return;
    MONTHS.forEach(m => {
      const d = getMonthData(camp, m);
      if (!d) return;
      d.keywords.forEach(kw => {
        if (q && !kw.keyword.includes(q)) return;
        const key = camp+'|||'+kw.keyword+'|||'+kw.matchType;
        if (!kwMap[key]) kwMap[key] = {camp,keyword:kw.keyword,matchType:kw.matchType,installs:0,spend:0,months:{},bids:[]};
        kwMap[key].installs += kw.installs;
        kwMap[key].spend += kw.spend;
        kwMap[key].months[m] = kw.installs;
        if (kw.bid > 0 && !kwMap[key].bids.includes(kw.bid)) kwMap[key].bids.push(kw.bid);
      });
    });
  });

  const rows = Object.values(kwMap).sort((a,b)=>b.installs-a.installs).slice(0,200);
  const tbody = document.getElementById('kwBody');
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="8" class="no-data">No results</td></tr>'; return; }

  tbody.innerHTML = rows.map(r => {
    const avgCPI = r.installs > 0 ? (r.spend/r.installs).toFixed(2) : '-';
    const bestM = Object.entries(r.months).sort((a,b)=>b[1]-a[1])[0];
    const bestMonth = bestM ? MONTH_LABELS[bestM[0]] : '-';
    const bidChips = r.bids.sort((a,b)=>a-b).map(b=>\`<span class="bid-chip">\${fmt$(b)}</span>\`).join('');
    return \`<tr>
      <td>\${r.keyword}</td>
      <td><span class="badge \${r.matchType==='exact'?'badge-exact':'badge-broad'}">\${r.matchType}</span></td>
      <td><span class="badge \${CAMP_BADGE[r.camp]}">\${CAMP_NAMES[r.camp]}</span></td>
      <td>\${bestMonth}</td>
      <td><strong style="color:#FFD200">\${r.installs}</strong></td>
      <td>\${fmt$(r.spend)}</td>
      <td>\${avgCPI==='-'?'-':fmt$(avgCPI)}</td>
      <td><div class="bid-chips">\${bidChips}</div></td>
    </tr>\`;
  }).join('');
}

// ---- CHANGES ----
function renderChanges() {
  const mA = document.getElementById('monthA').value;
  const mB = document.getElementById('monthB').value;
  const labelA = MONTH_LABELS[mA]||mA;
  const labelB = MONTH_LABELS[mB]||mB;

  let html = '<div class="changes-grid">';

  // Campaign-level summary
  html += \`<div class="change-card" style="grid-column:1/-1">
    <h3>Campaign Summary: \${labelA} → \${labelB}</h3>
    <table><thead><tr><th>Campaign</th><th>Spend \${labelA}</th><th>Spend \${labelB}</th><th>Delta</th><th>Installs \${labelA}</th><th>Installs \${labelB}</th><th>Delta</th><th>CPI \${labelA}</th><th>CPI \${labelB}</th></tr></thead><tbody>\`;

  CAMPS.forEach(camp => {
    const dA = getMonthData(camp,mA)||{totalSpend:0,totalInstalls:0,cpi:0};
    const dB = getMonthData(camp,mB)||{totalSpend:0,totalInstalls:0,cpi:0};
    const spendD = dB.totalSpend - dA.totalSpend;
    const instD = dB.totalInstalls - dA.totalInstalls;
    const cpiA = dA.cpi||0, cpiB = dB.cpi||0;
    html += \`<tr>
      <td><span class="badge \${CAMP_BADGE[camp]}">\${CAMP_NAMES[camp]}</span></td>
      <td>\${fmt$(dA.totalSpend)}</td>
      <td>\${fmt$(dB.totalSpend)}</td>
      <td class="\${spendD>0?'delta-pos':spendD<0?'delta-neg':'delta-neu'}">\${spendD>=0?'+':''}\${fmt$(spendD)}</td>
      <td>\${dA.totalInstalls}</td>
      <td>\${dB.totalInstalls}</td>
      <td class="\${instD>0?'delta-pos':instD<0?'delta-neg':'delta-neu'}">\${instD>=0?'+':''}\${instD}</td>
      <td>\${cpiA>0?fmt$(cpiA):'-'}</td>
      <td>\${cpiB>0?fmt$(cpiB):'-'}</td>
    </tr>\`;
  });
  html += '</tbody></table></div>';

  // Per campaign: keyword changes
  CAMPS.forEach(camp => {
    const dA = getMonthData(camp,mA);
    const dB = getMonthData(camp,mB);
    if (!dA && !dB) return;

    const kwA = {};
    (dA?.keywords||[]).forEach(k=>{ kwA[k.keyword+'|||'+k.matchType]=k; });
    const kwB = {};
    (dB?.keywords||[]).forEach(k=>{ kwB[k.keyword+'|||'+k.matchType]=k; });

    const newKws = Object.keys(kwB).filter(k=>!kwA[k]).slice(0,8);
    const dropKws = Object.keys(kwA).filter(k=>!kwB[k]).slice(0,8);
    const bidChanges = Object.keys(kwB).filter(k=>kwA[k]&&Math.abs(kwB[k].bid-kwA[k].bid)>0.01).slice(0,8);

    if (!newKws.length && !dropKws.length && !bidChanges.length) return;

    html += \`<div class="change-card"><h3>\${CAMP_NAMES[camp]}: Keyword Changes</h3>\`;
    if (newKws.length) {
      html += '<div style="margin-bottom:12px"><div style="font-size:11px;color:#00e676;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">🆕 New Keywords</div>';
      newKws.forEach(k=>{ const kw=kwB[k]; html+=\`<div class="change-row"><span>\${kw.keyword} <span class="badge \${kw.matchType==='exact'?'badge-exact':'badge-broad'}">\${kw.matchType}</span></span><span style="color:#888">\${fmt$(kw.bid)}</span></div>\`; });
      html += '</div>';
    }
    if (dropKws.length) {
      html += '<div style="margin-bottom:12px"><div style="font-size:11px;color:#ff5252;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">❌ Removed Keywords</div>';
      dropKws.forEach(k=>{ const kw=kwA[k]; html+=\`<div class="change-row"><span>\${kw.keyword} <span class="badge \${kw.matchType==='exact'?'badge-exact':'badge-broad'}">\${kw.matchType}</span></span><span style="color:#888">\${fmt$(kw.bid)}</span></div>\`; });
      html += '</div>';
    }
    if (bidChanges.length) {
      html += '<div><div style="font-size:11px;color:#FFD200;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">💰 Bid Changes</div>';
      bidChanges.forEach(k=>{ const a=kwA[k],b=kwB[k]; html+=\`<div class="change-row"><span>\${a.keyword}</span><span>\${fmt$(a.bid)} → <strong>\${fmt$(b.bid)}</strong></span></div>\`; });
      html += '</div>';
    }
    html += '</div>';
  });

  html += '</div>';
  document.getElementById('changesContent').innerHTML = html;
}

// ---- TAB SWITCHING ----
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i)=>{
    t.classList.toggle('active',['overview','campaign','keywords','changes'][i]===name);
  });
  document.querySelectorAll('.tab-pane').forEach(p=>{ p.classList.remove('active'); });
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='overview') renderOverview();
  if(name==='campaign') renderCampaignTab();
  if(name==='keywords') renderKeywords();
  if(name==='changes') renderChanges();
}

// INIT
renderOverview();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('✅ index.html written:', fs.statSync(path.join(__dirname, 'index.html')).size, 'bytes');
