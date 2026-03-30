# Chatty Ads Intelligence System

> Automated Shopify ads reporting, data storage, and live dashboard — maintained by Cleo 🌿 and Carla.

---

## 1. Overview

This system automates the entire Shopify ads reporting workflow for Chatty. Every week, it fetches keyword and campaign performance data from Shopify Partners, stores it in a Postgres database, rebuilds the live analytics dashboard, and delivers a summary report to Carla via Slack — all without manual intervention.

**Maintained by:** Cleo (AI assistant) + Carla (Product Marketing, Chatty)

---

## 2. Architecture

```
Shopify Partners
      │
      │  (scheduled CSV email export)
      ▼
   Gmail Inbox
      │
      │  weekly-ad-report.cjs reads + downloads CSVs
      ▼
  Local CSV Files
      │
      ├──► Supabase (Postgres)   ← persistent storage, all historical data
      │         │
      │         │  sync-from-supabase.cjs
      │         ▼
      │    history.json  →  index.html  →  GitHub Pages (live dashboard)
      │
      └──► Slack DM → Carla  (weekly analysis report)
```

**Tech stack:**
- **Runtime:** Node.js (scripts in `/scripts`)
- **Database:** Supabase (Postgres, REST API)
- **Dashboard:** GitHub Pages — static HTML rebuilt from database weekly
- **Notifications:** Slack API (Bot token)
- **Email fetch:** Gmail API (OAuth)

---

## 3. Data Sources

Shopify Partners exports two types of CSV reports:

| Type | Cadence | Content |
|---|---|---|
| **Keyword-level** | Weekly | Per-keyword breakdown: impressions, clicks, installs, spend, CPI, match type, country |
| **Campaign-level** | Monthly | Per-campaign aggregates: total spend, installs, clicks, CPA |

All active campaigns are tracked. CSV files are stored locally under:
- `ads-reports/` — keyword weekly exports
- `chatty-ads-dashboard/csv-raw/` — campaign monthly exports

**Key columns:** App Name, Ad Name, Keyword, Match Type, Country Code, Impressions, Clicks, Installs, Spend, CPI, CPC, CTR, Revenue, Return on Spend, Conversion Rate, Average Position

---

## 4. Automated Pipeline (Weekly)

**Trigger:** Every Monday at 8:00 AM Bangkok time (cron job)

**Script:** `scripts/weekly-ad-report.cjs`

### Steps:

**Step 1 — Fetch CSVs from Gmail**
- Connects to Gmail API using OAuth credentials
- Searches for Shopify Partners export emails received since last run
- Downloads attached CSV files to `ads-reports/`

**Step 2 — Analyze + Send Slack Report**
- Parses keyword performance data
- Identifies: top performers, wasted spend, bid recommendations, country breakdown
- Sends formatted analysis to Carla's Slack DM

**Step 3 — Import to Supabase**
- Runs `supabase-ads-setup.cjs`
- Inserts new rows into `chatty_ads` table
- **Skips duplicates** — checks existing rows before inserting (safe to run multiple times)

**Step 4 — Rebuild Dashboard**
- Runs `sync-from-supabase.cjs`
- Fetches all data from Supabase → rebuilds `ads-data/history.json`
- Runs `build-dashboard.cjs` → generates fresh `index.html`
- Git commits + pushes to GitHub → dashboard updates live

**Step 5 — Slack confirm**
- Sends completion message to Carla: "✅ Pipeline complete — dashboard updated"

---

## 5. Live Dashboard

**URL:** https://ngnbthuy123131.github.io/chatty-ads-dashboard/

**How to read it:**
- Select campaign and month from dropdowns
- View spend, installs, CPI trend over time
- Drill into keyword-level breakdown per month

**Data refresh:** Updates automatically every Monday after the pipeline runs. Data is always as fresh as the last weekly Shopify Partners export.

---

## 6. Supabase Database

**Project:** `pqelecofqzrlysvapomd` (Tokyo region)
**Table:** `chatty_ads`
**Total rows:** ~39,000+ (as of March 2026), growing weekly

### Key columns:
```sql
app_name, ad_name, start_date, end_date, keyword, match_type,
country_code, impressions, clicks, installs, spend, cpi, cpc,
ctr, revenue, return_on_spend, conversion_rate, status
```

### Sample queries:
```sql
-- Top keywords by installs (last 30 days)
SELECT keyword, SUM(installs) as total_installs, SUM(spend) as total_spend
FROM chatty_ads
WHERE start_date >= NOW() - INTERVAL '30 days'
GROUP BY keyword
ORDER BY total_installs DESC
LIMIT 20;

-- Spend by country
SELECT country_code, SUM(spend) as total_spend, SUM(installs) as installs
FROM chatty_ads
GROUP BY country_code
ORDER BY total_spend DESC;

-- Monthly CPI trend
SELECT DATE_TRUNC('month', start_date) as month,
       SUM(spend) / NULLIF(SUM(installs), 0) as cpi
FROM chatty_ads
GROUP BY 1
ORDER BY 1;
```

### Manually import new CSVs:
1. Drop CSV file(s) into `ads-reports/` or `chatty-ads-dashboard/csv-raw/`
2. Run: `node scripts/supabase-ads-setup.cjs`
3. Then rebuild dashboard: `node chatty-ads-dashboard/sync-from-supabase.cjs`

---

## 7. Scripts Reference

| Script | Location | What it does |
|---|---|---|
| `weekly-ad-report.cjs` | `scripts/` | Full pipeline — fetch + analyze + import + dashboard + Slack |
| `supabase-ads-setup.cjs` | `scripts/` | Import CSVs to Supabase only (with duplicate check) |
| `sync-from-supabase.cjs` | `chatty-ads-dashboard/` | Fetch from Supabase → rebuild dashboard → push to GitHub |
| `build-dashboard.cjs` | `chatty-ads-dashboard/` | Build `index.html` from `ads-data/history.json` |

### Run manually:
```bash
# Full pipeline
node scripts/weekly-ad-report.cjs

# Import new CSVs only
node scripts/supabase-ads-setup.cjs

# Rebuild dashboard only (no new import)
node chatty-ads-dashboard/sync-from-supabase.cjs
```

---

## 8. How to Add a New Campaign

1. Make sure Shopify Partners is configured to send CSV exports for the new campaign to Gmail
2. The pipeline will auto-detect and import on the next Monday run
3. To map the campaign to a dashboard tab, update the `getCampKey()` function in `sync-from-supabase.cjs`:
```js
function getCampKey(adName) {
  if (adName.includes('your-new-campaign-keyword')) return 'camp5';
  // ...
}
```
4. Add the new campaign entry to `build-dashboard.cjs` template section

---

## 9. Troubleshooting

| Issue | Likely cause | Fix |
|---|---|---|
| Pipeline runs but no new data | Gmail API didn't find new export emails | Check if Shopify sent the export; re-run after email arrives |
| Duplicate rows warning | CSV already imported | Safe to ignore — duplicate check prevents actual duplicates |
| Dashboard not updating | Git push failed (token expired) | Regenerate GitHub PAT and update `.gh-token` file |
| Supabase connection error | Project paused (free tier auto-pauses after 1 week inactive) | Go to supabase.com → restore project → re-run script |
| `PGRST205` error | Table doesn't exist | Run CREATE TABLE SQL in Supabase SQL Editor |

---

## 10. Credentials & Config

All sensitive values are stored locally (not committed to Git):

| File | Contains |
|---|---|
| `.gh-token` | GitHub Personal Access Token (gitignored) |
| `scripts/` env vars | Supabase anon key, Slack bot token, Gmail OAuth |

> ⚠️ Never commit credential files. The `.gitignore` already excludes them.

---

*Last updated: March 2026 — Cleo 🌿*
