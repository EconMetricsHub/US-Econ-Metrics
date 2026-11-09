# US Economic Simulator and Tracker

A static browser application for macroeconomic scenarios, official-data tracking, portfolio stress, and economic news. Licensed under GPL-3.0; see LICENSE. Model results and news coefficients are scenario assumptions, not official forecasts or causal estimates.

## Run

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. No build step or package installation is required. Fonts, charts, PDF parsing and Markdown use external CDNs. For manual GitHub upload and fresh commit identity, see [docs/NEW_REPOSITORY.md](docs/NEW_REPOSITORY.md).

## Key-free news

**News Intelligence** reads these public sources:

- Federal Reserve releases
- BLS Consumer Price Index and Employment Situation releases
- BEA releases
- GDELT economic reporting

Source URLs are centralized in `data/news-sources.json`. The browser checks sources concurrently, omits credentials, and limits each request to 10 seconds. Browser CORS restrictions, outages or rate limits can prevent direct access. Available sources still work when others fail. The app merges live articles with the bundled snapshot and recent browser cache, shows per-source health, retains article publication dates, and labels saved content. Successful browser collections are cached for 15 minutes; **Refresh news** bypasses that cache.

A scheduled, key-free Python collector handles feeds that block direct browser requests. The included snapshot contains real official releases collected during validation; see its per-source dates and statuses. No example or fabricated news is inserted into the live feed. Official numeric FRED indicator snapshots remain unconfigured until you enable that optional service.

**Import JSON / RSS / Atom** or **Add headline** works even when upstream requests fail. JSON accepts an array or `{ "items": [...] }`:

```json
{
  "items": [{
    "title": "Oil prices surge after major supply disruption",
    "url": "https://example.org/article",
    "publishedAt": "2026-11-09T12:00:00Z",
    "category": "economy"
  }]
}
```

Only valid HTTP(S) article URLs are accepted. Official labels derive from the source URL's hostname, not an imported claim. The current official hostname allowlist is Fed/BLS/BEA; extending source families also requires updating that allowlist.

## One event, one reviewed assumption

The feed groups close headline matches published within 72 hours and release stories with the same topic and reporting period. Shared topics alone are insufficient. Clear opposite directions and different reporting periods remain separate. Every grouped source remains accessible. This is a conservative heuristic, not full semantic event detection. When it misses a relationship, use **Replace an existing event** in the review panel to link a story explicitly.

1. Select **Review local model effect** on an event.
2. Choose a small scenario prior or enter GDP/CPI effects (−1 to +1 percentage points) and duration (1–24 months). Only clear recent headlines get preset suggestions; ambiguous, old and undated headlines start manual.
3. Select **Preview model change** to calculate current → proposed GDP, CPI, rates, S&P index, recession score and portfolio outcomes using the existing equations and your holdings. Previewing does not alter the saved or active scenario.
4. Select **Apply previewed assumption** to accept. Edits or a changed scenario require a new preview. A related existing assumption is replaced, rather than counted again.
5. Use the **News assumption ledger** to inspect sources, coefficients, magnitude and timing; edit, disable, re-enable or remove an assumption. Undo/redo and existing scenario save/share/export tools retain news provenance.

Effects enter the existing temporary shock engine at 100% magnitude, low confidence (0.35), a one-month channel lag, peak at up to month 3, and decay 0.25. Advanced timing is editable in Events & Shocks. The preview uses the current evaluation month and horizon; a shock outside its active period may have no current effect. Portfolio outputs use the original factor model; they are stress estimates, not price targets.

Headlines never replace official observations. The application does not extract actual economic measurements or estimate causal coefficients from articles. Avoid counting the same release again through both a news assumption and the separate official release-surprise engine. Local imports/pasted context last for the current page session; save a scenario or export JSON to preserve applied assumptions.

**Optional AI scenario** retains the Worker interpretation path. It needs your own configured endpoint and provider service. News ingestion, grouping, local previews and the ledger do not need AI or an API key. No former account's endpoint is configured.

## Layout

```text
index.html                         Markup and ordered script/style references
assets/css/                        App, command center and news styles
assets/js/core/state.js            Defaults, presets and existing shock model
assets/js/core/model.js            Economic equations (unchanged by extraction)
assets/js/core/news-scenarios.js    Preview/apply bridge into the shock model
assets/js/news-client.js           Key-free fetching, feed parsing and validation
assets/js/news-events.js           Conservative event grouping
assets/js/services/                Optional AI and official-data services
assets/js/storage/                 Scenario save/load, share and undo/redo
assets/js/ui/                      Dashboard, news/ledger and other UI components
assets/js/app.js                   Bootstrap in explicit dependency order
assets/js/command-center.js        Existing command-center extension
data/                            Public snapshots, sources and slider registry
scripts/                           Optional news/FRED collectors
worker/                            Optional AI and official-data gateway
tests/                           News, collector and browser integration checks
.github/workflows/                 Validation, snapshots and Pages deployment
docs/                            Current setup, architecture and historical notes
LICENSE                            Original GPL-3.0 license
```

Modules use ordered classic scripts to retain the existing inline UI handlers; there is no bundler. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains boundaries and the compatibility model. Old patch payloads, installers, backups, active personal Worker configuration and Git metadata are excluded. Historical notes in `docs/history/` do not describe current setup.

## Deploy

Create an empty work-account repository and upload this folder's **contents**, including `.github/`. Set **Settings → Pages → GitHub Actions**, then run **Refresh data and deploy Pages**. The workflow validates tests, restores previous snapshots from Actions cache, collects news, optionally updates FRED, and deploys only the public app files. No bot commits are made. Scheduled runs happen every three hours, subject to GitHub delays. Cache retention is best effort; the checked-in snapshot is an additional fallback.

Add `FRED_API_KEY` only if you want official numeric observations refreshed. Worker features are optional; configure `worker/wrangler.toml.example` with your own resources and origin. Never commit provider secrets.

## Checks

Requires Node 22+ and Python 3.12+ for the development checks (the static app itself requires neither).

```sh
node --test tests/*.test.cjs worker/tests/live-data.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Optional browser integration uses Playwright with Chromium and a running local server:

```sh
node tests/browser-smoke.cjs
```

Install Playwright in your development environment if needed. Set `CHROMIUM_PATH` to an existing Chromium executable, or install the Playwright browser. Set `TEST_BASE_URL` for another server address. Browser tests intercept upstream requests with fixtures so provider outages do not make application checks unreliable. Actual source availability is separately documented in [docs/VALIDATION.md](docs/VALIDATION.md).
