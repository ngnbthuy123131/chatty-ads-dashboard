const fs = require('fs');
const path = require('path');

const CSV_DIR = path.join(__dirname, 'csv-raw');
const OUT_DIR = path.join(__dirname, 'ads-data');
const OUT_FILE = path.join(OUT_DIR, 'history.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const CAMP_NAMES = {
  camp1: 'VN',
  camp2: 'Competitor',
  camp3: 'Broad 4 Countries',
  camp4: 'Exact Other Countries',
  camp5: 'FR',
  camp6: 'Exact IN'
};

const MONTH_MAP = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12'
};

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim(); });
    return row;
  }).filter(r => r['Keyword']);
}

function extractMeta(filename) {
  // Match camp1_september_2025 or camp1_september_2025---uuid
  const base = path.basename(filename, '.csv');
  const m = base.match(/^(camp\d+)_([a-z]+)_(\d{4})/);
  if (!m) return null;
  const camp = m[1];
  const monthName = m[2];
  const year = m[3];
  const monthNum = MONTH_MAP[monthName];
  if (!monthNum) return null;
  const monthKey = `${year}-${monthNum}`;
  return { camp, monthKey };
}

// data[camp][monthKey][keyword] = { impressions, clicks, installs, spend, bid, countries: {CC: installs} }
const data = {};

const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
console.log(`Processing ${files.length} files...`);

// Skip duplicate mislabeled file
const SKIP = ['camp1_march_2026---'];

for (const file of files) {
  if (SKIP.some(s => file.startsWith(s))) {
    console.log(`  Skipping (duplicate): ${file}`);
    continue;
  }

  const meta = extractMeta(file);
  if (!meta) {
    console.log(`  Skipping (no meta): ${file}`);
    continue;
  }
  const { camp, monthKey } = meta;

  if (!data[camp]) data[camp] = {};
  if (!data[camp][monthKey]) data[camp][monthKey] = {};

  const content = fs.readFileSync(path.join(CSV_DIR, file), 'utf8');
  const rows = parseCSV(content);

  for (const row of rows) {
    const keyword = (row['Keyword'] || '').toLowerCase().trim();
    const matchType = row['Match Type'] || '';
    const country = row['Country Code'] || '';
    const impressions = parseFloat(row['Impressions']) || 0;
    const clicks = parseFloat(row['Clicks']) || 0;
    const installs = parseFloat(row['Installs']) || 0;
    const spend = parseFloat(row['Spend']) || 0;
    const bid = parseFloat(row['Bid']) || 0;

    const key = `${keyword}|||${matchType}`;
    if (!data[camp][monthKey][key]) {
      data[camp][monthKey][key] = {
        keyword, matchType, impressions: 0, clicks: 0,
        installs: 0, spend: 0, bid: 0, countries: {}
      };
    }
    const kd = data[camp][monthKey][key];
    kd.impressions += impressions;
    kd.clicks += clicks;
    kd.installs += installs;
    kd.spend += spend;
    kd.bid = Math.max(kd.bid, bid);
    if (country) {
      kd.countries[country] = (kd.countries[country] || 0) + installs;
    }
  }
  console.log(`  ✓ ${file} → ${camp} ${monthKey} (${rows.length} rows)`);
}

// Build final structure
const result = { campaigns: {}, generatedAt: new Date().toISOString() };

for (const [camp, months] of Object.entries(data)) {
  result.campaigns[camp] = {
    name: CAMP_NAMES[camp] || camp,
    months: {}
  };

  for (const [monthKey, kwMap] of Object.entries(months)) {
    const keywords = Object.values(kwMap).map(kd => ({
      ...kd,
      spend: Math.round(kd.spend * 100) / 100,
      cpi: kd.installs > 0 ? Math.round((kd.spend / kd.installs) * 100) / 100 : 0,
      topCountries: Object.entries(kd.countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cc, n]) => ({ cc, installs: n }))
    }));

    const totalSpend = Math.round(keywords.reduce((s, k) => s + k.spend, 0) * 100) / 100;
    const totalInstalls = keywords.reduce((s, k) => s + k.installs, 0);
    const totalClicks = keywords.reduce((s, k) => s + k.clicks, 0);
    const totalImpressions = keywords.reduce((s, k) => s + k.impressions, 0);

    result.campaigns[camp].months[monthKey] = {
      totalSpend, totalInstalls, totalClicks, totalImpressions,
      cpi: totalInstalls > 0 ? Math.round((totalSpend / totalInstalls) * 100) / 100 : 0,
      keywords: keywords.sort((a, b) => b.installs - a.installs)
    };
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
console.log(`\n✅ Written to ${OUT_FILE}`);

// Summary
for (const [camp, cd] of Object.entries(result.campaigns)) {
  const months = Object.keys(cd.months).sort();
  const totalSpend = Object.values(cd.months).reduce((s, m) => s + m.totalSpend, 0);
  const totalInstalls = Object.values(cd.months).reduce((s, m) => s + m.totalInstalls, 0);
  console.log(`  ${camp} (${cd.name}): ${months.length} months | $${totalSpend.toFixed(2)} spend | ${totalInstalls} installs`);
}
