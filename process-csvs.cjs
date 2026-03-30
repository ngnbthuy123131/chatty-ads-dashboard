/**
 * process-csvs.cjs
 * Reads all CSVs from csv-raw/, parses them, and outputs ads-data/history.json
 *
 * CSV naming convention (rename before running):
 *   [campaign-key]_[YYYY-MM].csv
 *   e.g. exact_2025-09.csv, broad_2025-09.csv, competitor_2025-09.csv, fr_2025-09.csv
 *
 * Campaign keys:
 *   exact      = Chatty - Main keywords - Exact | 20241016
 *   broad      = Chatty - Main keyword - Broad - 4 Countries | 20241106
 *   competitor = Chatty - Competitor - Broad | 20241210
 *   fr         = Chatty - Main keyword - Broad - FR | 20260309
 */

const fs   = require('fs');
const path = require('path');

const CSV_DIR  = path.join(__dirname, 'csv-raw');
const OUT_FILE = path.join(__dirname, 'ads-data', 'history.json');

const CAMPAIGN_NAMES = {
  exact:      'Main Keywords - Exact',
  broad:      'Broad - 4 Countries',
  competitor: 'Competitor - Broad',
  fr:         'Broad - FR',
};

function parseCSV(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
    return row;
  }).filter(r => r['Keyword'] && r['Keyword'].trim());
}

function aggregateRows(rows) {
  // Total metrics
  let totalSpend = 0, totalInstalls = 0, totalClicks = 0, totalImpressions = 0;

  // Keyword-level aggregation
  const kwMap = {};
  // Country-level aggregation
  const countryMap = {};

  for (const row of rows) {
    const kw         = (row['Keyword'] || '').toLowerCase().trim();
    const match      = (row['Match Type'] || row['Match type'] || '').toLowerCase();
    const country    = row['Country Code'] || row['Country'] || '';
    const installs   = parseFloat(row['Installs'] || 0);
    const spend      = parseFloat(row['Spend'] || 0);
    const impressions = parseFloat(row['Impressions'] || 0);
    const clicks     = parseFloat(row['Clicks'] || 0);
    const bid        = parseFloat(row['Bid'] || row['Bid Per Click'] || row['Bid per click'] || 0);
    const avgPos     = parseFloat(row['Average Position'] || row['Average position'] || 0);

    if (!kw) continue;

    const key = `${kw}||${match}`;
    if (!kwMap[key]) kwMap[key] = { kw, match, bid, installs: 0, spend: 0, impressions: 0, clicks: 0, avgPos: 0, posCount: 0, countries: {} };
    kwMap[key].installs    += installs;
    kwMap[key].spend       += spend;
    kwMap[key].impressions += impressions;
    kwMap[key].clicks      += clicks;
    if (avgPos > 0) { kwMap[key].avgPos += avgPos; kwMap[key].posCount++; }
    if (bid > 0 && kwMap[key].bid === 0) kwMap[key].bid = bid;
    if (installs > 0 && country) {
      kwMap[key].countries[country] = (kwMap[key].countries[country] || 0) + installs;
    }

    // Country totals
    if (country) {
      if (!countryMap[country]) countryMap[country] = { installs: 0, spend: 0 };
      countryMap[country].installs += installs;
      countryMap[country].spend    += spend;
    }

    totalSpend      += spend;
    totalInstalls   += installs;
    totalClicks     += clicks;
    totalImpressions += impressions;
  }

  const keywords = Object.values(kwMap).map(k => ({
    kw: k.kw,
    match: k.match,
    bid: k.bid,
    installs: Math.round(k.installs * 100) / 100,
    spend: Math.round(k.spend * 100) / 100,
    impressions: Math.round(k.impressions),
    clicks: Math.round(k.clicks),
    cpi: k.installs > 0 ? Math.round(k.spend / k.installs * 100) / 100 : null,
    avgPos: k.posCount > 0 ? Math.round(k.avgPos / k.posCount * 10) / 10 : null,
    countries: k.countries,
  })).sort((a, b) => b.installs - a.installs);

  const countries = Object.entries(countryMap)
    .map(([code, d]) => ({ code, installs: Math.round(d.installs * 100) / 100, spend: Math.round(d.spend * 100) / 100 }))
    .sort((a, b) => b.installs - a.installs);

  return {
    totalSpend:       Math.round(totalSpend * 100) / 100,
    totalInstalls:    Math.round(totalInstalls * 100) / 100,
    totalClicks:      Math.round(totalClicks),
    totalImpressions: Math.round(totalImpressions),
    avgCPI: totalInstalls > 0 ? Math.round(totalSpend / totalInstalls * 100) / 100 : null,
    keywords,
    countries,
  };
}

function main() {
  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  if (files.length === 0) {
    console.log('No CSV files found in csv-raw/');
    console.log('Place CSVs named like: exact_2025-09.csv, broad_2025-10.csv, etc.');
    return;
  }

  console.log(`Processing ${files.length} CSV files...`);

  // history[campaign][month] = aggregated data
  const history = {};
  const months  = new Set();

  for (const file of files) {
    const match = file.match(/^(exact|broad|competitor|fr)_(\d{4}-\d{2})\.csv$/i);
    if (!match) {
      console.log(`  ⚠️  Skipping (bad name): ${file} — rename to e.g. exact_2025-09.csv`);
      continue;
    }
    const [, campKey, month] = match;
    months.add(month);
    if (!history[campKey]) history[campKey] = {};

    const rows = parseCSV(path.join(CSV_DIR, file));
    history[campKey][month] = aggregateRows(rows);
    console.log(`  ✅ ${file}: ${rows.length} rows, $${history[campKey][month].totalSpend} spend, ${history[campKey][month].totalInstalls} installs`);
  }

  const output = {
    updatedAt:   new Date().toISOString(),
    campaignNames: CAMPAIGN_NAMES,
    months:      [...months].sort(),
    history,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Saved to ads-data/history.json (${files.length} files processed)`);
  console.log(`Months: ${[...months].sort().join(', ')}`);
  console.log(`Campaigns: ${Object.keys(history).join(', ')}`);
}

main();
