/**
 * Keyword Opportunity Report
 * Cross-references: Shopify App Store rankings + BigQuery traffic + current ad keywords
 * Outputs actionable opportunities to Slack DM
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load Slack token from local config (not committed to git)
let SLACK_TOKEN = '';
try { SLACK_TOKEN = require('../ads-reports-config.json').slackToken; } catch(e) {}
if (!SLACK_TOKEN) { console.error('Set slackToken in ads-reports-config.json'); process.exit(1); }
const SLACK_CHANNEL = 'U06G6NV1WH0';

// CPI targets per campaign
const CPI_TARGETS = {
  camp1: { min: 2.5, target: 3.25, max: 4.0, name: 'VN' },
  camp2: { min: 2.2, target: 3.1,  max: 4.0, name: 'Competitor' },
  camp3: { min: 5.5, target: 7.0,  max: 8.5, name: 'Broad 4 Countries' },
  camp4: { min: 4.5, target: 6.0,  max: 7.5, name: 'Exact Other Countries' },
};

// Known ranked keywords (from rank tracker â€” update periodically)
// Format: keyword -> organic rank
const ORGANIC_RANKS = {
  'live chat': 1, 'ai chatbot': 1, 'chatbot': 1, 'ai chat': 1,
  'inbox': 2, 'chat': 2, 'livechat': 2,
  'help center': 3, 'faq': 5, 'customer support': 8,
  'helpdesk': 14, 'whatsapp': 17
};

function slackPost(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ channel: SLACK_CHANNEL, text, unfurl_links: false });
    const opts = {
      hostname: 'slack.com', path: '/api/chat.postMessage', method: 'POST',
      headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function fmt$(n) { return '$' + Number(n).toFixed(2); }

async function run() {
  // Load data
  const history = JSON.parse(fs.readFileSync(path.join(__dirname, 'ads-data', 'history.json'), 'utf8'));
  const bqPath = path.join(__dirname, '..', 'bq-metrics.json');
  const bq = fs.existsSync(bqPath) ? JSON.parse(fs.readFileSync(bqPath, 'utf8')) : null;
  const trafficKws = bq?.keywordTraffic || [];

  // Get all current ad keywords (latest month per campaign)
  const MONTHS = ['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02'];
  const lastMonth = MONTHS[MONTHS.length - 1];

  const adKeywords = new Set();
  const adKeywordMap = {}; // keyword -> {camp, bid, installs, spend, cpi}

  for (const [camp, cd] of Object.entries(history.campaigns)) {
    const d = cd.months[lastMonth];
    if (!d) continue;
    d.keywords.forEach(kw => {
      const k = kw.keyword.toLowerCase();
      adKeywords.add(k);
      if (!adKeywordMap[k] || kw.installs > (adKeywordMap[k].installs || 0)) {
        adKeywordMap[k] = { camp, campName: cd.name, bid: kw.bid, installs: kw.installs, spend: kw.spend, cpi: kw.cpi };
      }
    });
  }

  // --- OPPORTUNITY 1: High-traffic keywords NOT in ads ---
  const notBidding = trafficKws
    .filter(t => !adKeywords.has(t.keyword.toLowerCase()) && t.visits_30d >= 50)
    .sort((a, b) => b.visits_30d - a.visits_30d)
    .slice(0, 10);

  // --- OPPORTUNITY 2: Bidding on #1-#2 organic (probably redundant) ---
  const redundant = trafficKws
    .filter(t => {
      const rank = ORGANIC_RANKS[t.keyword.toLowerCase()];
      return rank && rank <= 2 && adKeywords.has(t.keyword.toLowerCase());
    });

  // --- OPPORTUNITY 3: Ranking #4-#10 + bidding (high ROI â€” ads push to top) ---
  const highROI = trafficKws
    .filter(t => {
      const rank = ORGANIC_RANKS[t.keyword.toLowerCase()];
      return rank && rank >= 4 && rank <= 10 && adKeywords.has(t.keyword.toLowerCase());
    })
    .sort((a, b) => b.visits_30d - a.visits_30d);

  // --- OPPORTUNITY 4: Ranking #4-#10 + NOT bidding (untapped) ---
  const untapped = trafficKws
    .filter(t => {
      const rank = ORGANIC_RANKS[t.keyword.toLowerCase()];
      return rank && rank >= 4 && rank <= 10 && !adKeywords.has(t.keyword.toLowerCase());
    })
    .sort((a, b) => b.visits_30d - a.visits_30d);

  // --- OPPORTUNITY 5: CPI analysis from latest month ---
  const overBudget = [], onTarget = [], underTarget = [];
  for (const [camp, cd] of Object.entries(history.campaigns)) {
    const d = cd.months[lastMonth];
    if (!d || !d.totalInstalls) continue;
    const target = CPI_TARGETS[camp];
    if (!target) continue;
    const cpi = d.cpi;
    if (cpi > target.max) overBudget.push({ camp, name: cd.name, cpi, target: target.target, spend: d.totalSpend, installs: d.totalInstalls });
    else if (cpi < target.min) underTarget.push({ camp, name: cd.name, cpi, target: target.target, spend: d.totalSpend, installs: d.totalInstalls });
    else onTarget.push({ camp, name: cd.name, cpi, target: target.target, spend: d.totalSpend, installs: d.totalInstalls });
  }

  // Build Slack message
  const lines = [];
  lines.push(`*ðŸ“Š Keyword Opportunity Report â€” Feb '26*`);
  lines.push(`_Cross-referencing ads, organic rankings, and App Store traffic_\n`);

  // CPI health check
  lines.push(`*ðŸŽ¯ CPI Health Check (Feb '26)*`);
  onTarget.forEach(c => lines.push(`  âœ… ${c.name}: ${fmt$(c.cpi)} â€” on target (${fmt$(c.target)})`));
  overBudget.forEach(c => lines.push(`  ðŸ”´ ${c.name}: ${fmt$(c.cpi)} â€” OVER budget (target ${fmt$(c.target)}) â€” reduce bids or pause weak keywords`));
  underTarget.forEach(c => lines.push(`  ðŸŸ¢ ${c.name}: ${fmt$(c.cpi)} â€” under target (${fmt$(c.target)}) â€” room to scale, raise bids`));

  if (highROI.length) {
    lines.push(`\n*ðŸš€ High ROI Ad Keywords (Ranking #4-10 + Already Bidding)*`);
    lines.push(`_These keywords rank mid-page organically â€” ads can push Chatty to #1_`);
    highROI.forEach(t => {
      const rank = ORGANIC_RANKS[t.keyword.toLowerCase()];
      const ad = adKeywordMap[t.keyword.toLowerCase()];
      lines.push(`  â€¢ *${t.keyword}* â€” Rank #${rank} | ${t.visits_30d} visits/mo | Ad: ${fmt$(ad?.bid || 0)} bid in ${ad?.campName || '?'}`);
    });
  }

  if (untapped.length) {
    lines.push(`\n*ðŸ’¡ Untapped Opportunities (Ranking #4-10, NOT bidding)*`);
    lines.push(`_High organic traffic but no ad coverage â€” consider adding_`);
    untapped.forEach(t => {
      const rank = ORGANIC_RANKS[t.keyword.toLowerCase()];
      lines.push(`  â€¢ *${t.keyword}* â€” Rank #${rank} | ${t.visits_30d} visits/mo | ${t.cvr_30d}% CVR`);
    });
  }

  if (notBidding.length) {
    lines.push(`\n*ðŸ” High-Traffic Keywords NOT in Ads*`);
    notBidding.slice(0, 6).forEach(t => {
      lines.push(`  â€¢ *${t.keyword}* â€” ${t.visits_30d} visits/mo | ${t.cvr_30d}% CVR â€” consider testing`);
    });
  }

  if (redundant.length) {
    lines.push(`\n*âš ï¸ Possibly Redundant (Rank #1-2 Organic + Paying for Ads)*`);
    redundant.forEach(t => {
      const ad = adKeywordMap[t.keyword.toLowerCase()];
      lines.push(`  â€¢ *${t.keyword}* â€” Rank #${ORGANIC_RANKS[t.keyword.toLowerCase()]} | Paying ${fmt$(ad?.bid || 0)}/click in ${ad?.campName || '?'} â€” organic already dominant`);
    });
  }

  lines.push(`\n_Dashboard: https://ngnbthuy123131.github.io/chatty-ads-dashboard/_`);

  const text = lines.join('\n');
  console.log(text);

  const result = await slackPost(text);
  console.log(result.ok ? 'âœ… Sent to Slack DM' : `âŒ Slack error: ${result.error}`);
}

run().catch(console.error);


