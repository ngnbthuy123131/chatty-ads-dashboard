/**
 * sync-from-supabase.cjs
 * Fetches all ads data from Supabase → rebuilds history.json → rebuilds index.html → git push
 * Usage: node sync-from-supabase.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SUPABASE_URL = 'https://pqelecofqzrlysvapomd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZWxlY29mcXpybHlzdmFwb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTk0MzEsImV4cCI6MjA5MDM5NTQzMX0.BKRn9raFpHMbXlUHt1rce-IXkyiNIK3VEAsAtgeBY68';
const HEADERS = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` };
const DASHBOARD_DIR = __dirname;
const GH_TOKEN = process.env.GH_TOKEN || require('fs').readFileSync(require('path').join(__dirname, '.gh-token'), 'utf8').trim();

// Map ad_name patterns → campaign keys
function getCampKey(adName) {
  if (!adName) return null;
  const n = adName.toLowerCase();
  if (n.includes('vn')) return 'camp1';
  if (n.includes('competitor')) return 'camp2';
  if (n.includes('broad')) return 'camp3';
  if (n.includes('exact')) return 'camp4';
  return null;
}

function getCampName(campKey) {
  return { camp1: 'VN', camp2: 'Competitor - Broad', camp3: 'Main keyword - Broad', camp4: 'Main keywords - Exact' }[campKey] || campKey;
}

async function fetchAll() {
  let allRows = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chatty_ads?select=ad_name,start_date,keyword,match_type,impressions,clicks,installs,spend,bid,country_code&order=start_date.asc&limit=${limit}&offset=${offset}`,
      { headers: HEADERS }
    );
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    allRows = allRows.concat(rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return allRows;
}

function toMonthKey(dateStr) {
  if (!dateStr) return null;
  return dateStr.substring(0, 7); // "YYYY-MM"
}

function buildHistory(rows) {
  const campaigns = { camp1: { name: 'VN', months: {} }, camp2: { name: 'Competitor - Broad', months: {} }, camp3: { name: 'Main keyword - Broad', months: {} }, camp4: { name: 'Main keywords - Exact', months: {} } };

  for (const row of rows) {
    const campKey = getCampKey(row.ad_name);
    if (!campKey) continue;
    const month = toMonthKey(row.start_date);
    if (!month) continue;

    const camp = campaigns[campKey];
    if (!camp.months[month]) {
      camp.months[month] = { totalSpend: 0, totalInstalls: 0, totalClicks: 0, totalImpressions: 0, cpi: 0, keywords: [] };
    }
    const m = camp.months[month];

    // Find existing keyword entry
    let kw = m.keywords.find(k => k.keyword === row.keyword && k.matchType === row.match_type);
    if (!kw) {
      kw = { keyword: row.keyword, matchType: row.match_type, impressions: 0, clicks: 0, installs: 0, spend: 0, bid: row.bid || 0, countries: {}, cpi: 0, topCountries: '' };
      m.keywords.push(kw);
    }

    const imp = row.impressions || 0, clk = row.clicks || 0, inst = row.installs || 0, spd = parseFloat(row.spend) || 0;
    kw.impressions += imp;
    kw.clicks += clk;
    kw.installs += inst;
    kw.spend += spd;
    if (row.country_code) kw.countries[row.country_code] = (kw.countries[row.country_code] || 0) + inst;

    m.totalImpressions += imp;
    m.totalClicks += clk;
    m.totalInstalls += inst;
    m.totalSpend += spd;
  }

  // Compute CPI and topCountries
  for (const camp of Object.values(campaigns)) {
    for (const m of Object.values(camp.months)) {
      m.totalSpend = Math.round(m.totalSpend * 100) / 100;
      m.cpi = m.totalInstalls > 0 ? Math.round((m.totalSpend / m.totalInstalls) * 100) / 100 : 0;
      for (const kw of m.keywords) {
        kw.spend = Math.round(kw.spend * 100) / 100;
        kw.cpi = kw.installs > 0 ? Math.round((kw.spend / kw.installs) * 100) / 100 : 0;
        kw.topCountries = Object.entries(kw.countries).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c).join(', ');
      }
      // Sort keywords by spend desc
      m.keywords.sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
    }
  }

  return { campaigns, generatedAt: new Date().toISOString() };
}

async function main() {
  console.log('1. Fetching data from Supabase...');
  const rows = await fetchAll();
  console.log(`   ${rows.length} rows fetched`);

  console.log('2. Building history.json...');
  const history = buildHistory(rows);
  const histPath = path.join(DASHBOARD_DIR, 'ads-data', 'history.json');
  fs.writeFileSync(histPath, JSON.stringify(history, null, 2));
  console.log('   Saved to ads-data/history.json');

  console.log('3. Rebuilding index.html...');
  execSync(`node "${path.join(DASHBOARD_DIR, 'build-dashboard.cjs')}"`, { cwd: DASHBOARD_DIR, stdio: 'inherit' });

  console.log('4. Pushing to GitHub...');
  execSync('git add -A', { cwd: DASHBOARD_DIR });
  execSync(`git commit -m "Auto-sync: update ads data from Supabase ${new Date().toISOString().split('T')[0]}"`, { cwd: DASHBOARD_DIR });
  const remoteWithToken = `https://${GH_TOKEN}@github.com/ngnbthuy123131/chatty-ads-dashboard.git`;
  execSync(`git push "${remoteWithToken}" main`, { cwd: DASHBOARD_DIR });
  console.log('   Pushed to GitHub Pages ✅');
  console.log(`\n🎉 Dashboard updated: https://ngnbthuy123131.github.io/chatty-ads-dashboard/`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
