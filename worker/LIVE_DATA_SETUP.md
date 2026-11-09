# MACROSCOPE Live Data Gateway setup

The patched Worker can track approved U.S. economic series automatically without rebuilding the GitHub Pages site or regenerating `data/economic-calendar.json` for every release.

## Architecture

- **Groq secret:** stays in the Worker as `LLM_API_KEY`.
- **FRED secret:** stays in the Worker as `FRED_API_KEY`; it is never sent to the browser.
- **Keyless fallback:** if the FRED API key is absent or temporarily fails, the Worker tries FRED's public graph CSV download for the same approved series.
- **D1:** stores the latest observation, a first-seen history, detected revisions, and sync-run health.
- **Cron:** refreshes automatically during U.S. business/release hours plus a daily catch-up.
- **Static JSON:** remains a release-calendar/surprise-engine fallback. It is no longer required for every latest-data update.

## One-time Cloudflare setup

From `worker/`:

```bash
wrangler login
wrangler d1 create macroscope-data
```

Wrangler prints a database UUID. Add this block to `wrangler.toml` using that UUID:

```toml
[[d1_databases]]
binding = "MACROSCOPE_DB"
database_name = "macroscope-data"
database_id = "YOUR-D1-DATABASE-ID"
migrations_dir = "migrations"
```

Apply the schema:

```bash
wrangler d1 migrations apply macroscope-data --remote
```

Store secrets once:

```bash
wrangler secret put LLM_API_KEY
wrangler secret put FRED_API_KEY
```

`FRED_API_KEY` is recommended as the primary documented FRED API path, but the Worker has a keyless FRED CSV fallback for continuity.

Deploy:

```bash
wrangler deploy
```

The configured Cron Triggers then invoke the Worker's `scheduled()` handler automatically. The first request to `/api/data/latest` also bootstraps an empty D1 database, so you do not need to wait for the first cron run.

## Live endpoints

- `GET /api/data/status` — gateway/D1 health and last sync
- `GET /api/data/latest` — UI-compatible `officialData` snapshot
- `GET /api/data/latest?refresh=1` — refreshes first if the last sync is older than five minutes
- `GET /api/data/catalog` — approved series catalog
- `GET /api/data/series/<key>` — stored observation history
- `GET /api/data/revisions` — detected same-period revisions

## What remains static for now

`scripts/update_calendar.py` is intentionally retained. It still owns the richer release calendar, surprise engine, backtests, and historical release logic. The live Worker takes over **latest official observations** first. This minimizes regression risk.
