# US Economic Simulator and Tracker

## [▶ Open the Live Simulator & Tracker](https://YOUR-WORK-ACCOUNT.github.io/YOUR-REPOSITORY/)

**Live site:** [https://YOUR-WORK-ACCOUNT.github.io/YOUR-REPOSITORY/](https://YOUR-WORK-ACCOUNT.github.io/YOUR-REPOSITORY/)

**US Economic Simulator and Tracker** is an open-source, browser-based U.S. macroeconomic scenario simulator, official-data tracker, and release-aware nowcasting dashboard.

It combines a large structural scenario model with regularly refreshed economic data, transparent release-surprise signals, shock modeling, and multi-horizon forecasts. The application is designed to run as a static GitHub Pages site while GitHub Actions securely updates the public data snapshot in the background.

> **Important:** This project is an educational and analytical model. Its forecasts, scenario outputs, recession-risk scores, shock effects, and transmission coefficients are not official forecasts, investment advice, policy recommendations, or causal estimates.




## v8.0 compact terminal UI

The v8.0 shell consolidates controls into a dense Bloomberg-style research terminal, adds persistent color/density customization, a collapsible navigation rail, and a configurable Scenario Studio reasoning slider (Low / Medium / High) while retaining server-side scenario validation. See `V8_TERMINAL_UI.md`.

## v7 AI counterfactual layer

The v7 extension turns the optional LLM layer into a constrained controller for MACROSCOPE rather than a free-form chatbot.

```text
Natural-language question / economic news
        ↓
Groq GPT-OSS 20B interprets the request
        ↓
Strict JSON scenario command
        ↓
Local slider-registry validation
        ↓
MACROSCOPE equations run the counterfactual
        ↓
Charts, portfolio stress results, and model outputs update
        ↓
The LLM explains the simulator-generated result
```

Key safeguards and additions:

- `data/slider-registry.json` contains **88 UI sliders**, their ranges, steps, units, economic meaning, region availability, allowed operations, downstream effects, source, and registry version.
- The registry also defines the structured shock channels and the Taylor Rule setting available to the AI layer.
- The Cloudflare Worker defaults to **Groq `openai/gpt-oss-20b`** and requests strict JSON-Schema output.
- The model cannot directly manipulate the DOM, run arbitrary browser code, or invent new slider IDs.
- The browser performs a second validation pass, previews the result, and requires an explicit **Run validated scenario** action.
- Temporary and lagged events use the existing structured-shock engine; persistent policy/state changes use normal slider changes.
- After execution, the Worker receives the baseline and counterfactual simulator outputs and provides a grounded explanation.
- PDF/news interpretation now routes through the same Worker; no LLM provider key is exposed in browser JavaScript.

See `V7_AI_COUNTERFACTUAL.md` and `worker/README.md` for setup.

## v5 intelligence layer

The v5 overhaul adds two optional live-intelligence features while preserving the static-site model:

- **Live News Intelligence**: an hourly GitHub Actions job queries GDELT DOC 2.0 for economic, U.S. political, and geopolitical headlines and writes `data/news-feed.json`.
- **AI Shock Studio**: a Duck.ai-style natural-language scenario composer that turns a user prompt or news headline into a reviewable structured shock. It requires an optional serverless bridge under `worker/` so API credentials never enter the static site.
- **Automatic Pages deployment**: every push to `main` deploys automatically, and the hourly scheduled run refreshes data and redeploys without manual intervention.

The original v5 AI Shock Studio has been superseded by the v7 counterfactual controller. AI-generated commands remain reviewable and are never applied until the user explicitly runs the validated scenario.

## What it does

The project brings three related tools into one interface:

1. **Economic tracker** — follows selected official U.S. macroeconomic indicators and scheduled releases.
2. **Scenario simulator** — lets users alter more than 70 economic, policy, market, institutional, and geopolitical assumptions.
3. **Release-aware nowcasting system** — compares newly released data with the model's pre-release expectation and translates surprises into transparent, temporary model shocks.

## Key features

### Live U.S. economic baseline

- Tracks a core set of official U.S. economic series through the FRED API
- Displays current values, prior observations, revisions, freshness, and provenance
- Anchors selected model outputs to observed GDP, inflation, Treasury yields, and mortgage rates
- Synchronizes compatible observations directly with model inputs
- Preserves user scenario deviations when the official baseline refreshes
- Shows upcoming major economic releases
- Includes GDP-driver attribution and a persistent macroeconomic risk monitor

### Scenario simulator

- **88 adjustable inputs**
- **1-year, 3-year, and 10-year** forecast horizons
- Monetary policy and interest rates
- Fiscal policy and public debt
- Taxes and transfers
- Labor markets and demographics
- Housing and construction
- Energy and commodities
- Trade and tariffs
- Infrastructure
- Productivity and innovation
- Financial markets and bond conditions
- Institutional and political-economy assumptions
- Geopolitical shocks
- Taylor Rule mode
- Country presets and comparisons
- Saved scenarios, sharing, undo/redo, JSON export, and CSV export

### Structured shock engine

The simulator supports temporary, persistent, and structural shocks with explicit timing behavior.

Shock controls include:

- Magnitude
- Onset
- Lag
- Peak timing
- Duration
- Decay
- State-dependent interactions
- Diminishing overlap weights to reduce double counting
- Shock-attribution inspection
- Custom shock construction

### Official-data synchronization

GitHub Actions downloads official observations using a repository-level `FRED_API_KEY` and writes a public JSON snapshot for the browser.

The application currently maps **16 official series**, covering:

- Real GDP growth
- Headline CPI
- Core CPI
- Unemployment
- Labor-force participation
- Nonfarm payroll change
- Effective federal funds rate
- Interest on reserve balances
- 2-year Treasury yield
- 10-year Treasury yield
- 30-year mortgage rate
- Housing starts
- WTI crude oil
- PCE inflation
- Advance retail sales
- Real personal-consumption growth

Individual series can fall back to the previous valid observation when a temporary data request fails, allowing the rest of the update to continue.

### Release-surprise and nowcasting engine

For selected releases, the tracker creates a simple pre-release expectation from recent observations, compares that expectation with the released value, and standardizes the miss using recent forecast error.

```text
Official release
      ↓
Pre-release model expectation
      ↓
Actual − Expected
      ↓
Normalize by recent forecast error
      ↓
Release-specific transmission channels
      ↓
Temporary effects on the economic outlook
```

The current release families include:

- Employment Situation
- Consumer Price Index
- Gross Domestic Product
- Retail Sales
- Personal Income and Outlays

The release engine records:

- Expected value
- Actual value
- Raw surprise
- Standardized surprise
- Historical forecast error
- Confidence
- Release version
- Shock duration and decay
- Model targets and coefficients
- Backtested MAE and RMSE
- Directional accuracy

Revisions replace prior versions of the same release signal rather than being applied as duplicate shocks.

## Forecast methodology

The current short-horizon release expectation is intentionally simple and auditable.

```text
Expected next value =
55% × most recent prior value
+ 30% × second prior value
+ 15% × third prior value
```

For a newly released observation:

```text
Raw surprise = Actual − Expected

Standardized surprise =
Raw surprise ÷ rolling historical RMSE
```

Standardized surprises are capped at **±3.0 standard deviations** to limit the impact of extreme observations, unstable early samples, and possible data errors.

Release-transmission coefficients are defined explicitly in `SURPRISE_SERIES_SPECS` in `scripts/update_calendar.py`. They are transparent expert-prior scenario coefficients rather than statistically estimated causal effects.

## Architecture

The application uses a static-site architecture so the FRED API key never needs to be exposed in browser code.

```text
FRED API
   ↓
GitHub Actions runner
   │  uses encrypted FRED_API_KEY
   ↓
data/economic-calendar.json
   ↓
Static GitHub Pages application
```

The browser consumes the generated JSON snapshot and never receives the API key.

## Repository structure

```text
.
├── .github/
│   └── workflows/
│       └── static.yml
├── data/
│   └── economic-calendar.json
├── scripts/
│   └── update_calendar.py
├── index.html
├── LICENSE
├── PHASE_B_OFFICIAL_DATA.md
└── README.md
```

Keep these paths at the repository root because the workflow and frontend expect this structure.

## Getting started

### 1. Fork or clone the repository

```bash
git clone <your-repository-url>
cd <repository-directory>
```

### 2. Create a FRED API key

A free API key can be requested from the Federal Reserve Bank of St. Louis:

<https://fred.stlouisfed.org/docs/api/api_key.html>

### 3. Add the API key to GitHub Actions

In the repository, open:

```text
Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

Create a secret named exactly:

```text
FRED_API_KEY
```

Do **not** place the key in `index.html`, committed JavaScript, or the public JSON snapshot.

### 4. Enable GitHub Pages

Open:

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

The included workflow both generates the economic-data snapshot and deploys the static site.

### 5. Run the workflow

Open the repository's **Actions** tab, select **Update economic calendar and deploy Pages**, and run the workflow manually once.

The workflow will:

1. Validate the repository structure.
2. Set up Python.
3. Download the FRED release calendar.
4. Download mapped official series.
5. Calculate release forecasts and historical forecast errors.
6. Generate versioned release-surprise signals.
7. Write `data/economic-calendar.json`.
8. Deploy the repository through GitHub Pages.

## Automatic updates

The included GitHub Actions workflow runs:

- On pushes to `main`
- On manual dispatch
- Once daily
- Several additional times on weekdays

Scheduled GitHub Actions runs are not guaranteed to execute at the exact scheduled minute. The generated data include a timestamp so users can judge snapshot freshness.

## Running locally

The data updater uses the Python standard library and does not require third-party Python packages.

### macOS or Linux

```bash
export FRED_API_KEY="your_fred_api_key"
python3 scripts/update_calendar.py
python3 -m http.server 8000
```

### Windows PowerShell

```powershell
$env:FRED_API_KEY="your_fred_api_key"
python scripts/update_calendar.py
python -m http.server 8000
```

Then open:

<http://localhost:8000>

Serving the repository through a local HTTP server is preferable to opening `index.html` directly because the application loads the generated JSON file.

## Generated data

The frontend reads:

```text
data/economic-calendar.json
```

The current generated schema contains three principal sections:

```json
{
  "events": [],
  "officialData": {},
  "surpriseEngine": {}
}
```

### `events`

Contains historical and upcoming economic releases, attached official observations, model forecasts, and release-surprise summaries.

### `officialData`

Contains mapped official observations and related metadata, including current values, prior periods, revisions where available, freshness, provenance, and model mappings.

### `surpriseEngine`

Contains active and decaying release signals, stable observation IDs, revision-aware version IDs, forecasts, standardized surprises, transmission channels, confidence values, timing parameters, and forecast-performance statistics.

## Revision handling

Release signals use stable IDs based on the series and observation period, for example:

```text
release-unemployment-2026-07-01
```

If the underlying observation is revised, the version changes while the stable release identity remains the same. The updater replaces the previous version rather than applying the revision as a second independent release shock.

## Resilience and data freshness

The updater is designed to avoid replacing a useful snapshot with an empty or partially failed request.

It can:

- Split calendar requests into smaller date windows
- Retry temporary timeouts and server errors
- Back off after rate limits
- Write generated JSON atomically
- Preserve a previous valid calendar after a temporary calendar failure
- Preserve prior observations when an individual series is unavailable
- Mark stale or fallback observations in the generated metadata

## Interpretation and limitations

This project is a **scenario-analysis and tracking tool**, not an econometric forecasting service.

Users should keep several limitations in mind:

- Scenario coefficients are model assumptions, not identified causal estimates.
- Release-surprise transmission coefficients are expert priors rather than estimated structural parameters.
- The weighted release forecast is deliberately simple and is not intended to replace professional consensus forecasts.
- Long-horizon results are conditional scenarios and become increasingly uncertain as the horizon expands.
- Recession risk is a deterministic model score rather than an official probability estimate.
- Official observations can be revised after their initial publication.
- Data availability and update timing depend on upstream providers.

The project's emphasis is on **transparency, experimentation, and traceable assumptions** rather than false precision.

## Data sources and attribution

This project uses the **FRED® API** provided by the Federal Reserve Bank of St. Louis. It is not endorsed or certified by the Federal Reserve Bank of St. Louis.

Economic series available through FRED may originate from the Federal Reserve, Bureau of Economic Analysis, Bureau of Labor Statistics, Census Bureau, Treasury, and other underlying providers. Individual series may have their own attribution, copyright, redistribution, or usage terms.

The project does not claim ownership of third-party economic data.

## License

The source code for **US Economic Simulator and Tracker** is licensed under the **GNU General Public License v3.0 (GPL-3.0)** unless otherwise noted. See [`LICENSE`](LICENSE) for the full license text.

The GPL applies to the project's original source code. It does **not** grant new rights to third-party datasets, economic series, trademarks, or other externally sourced material. Those remain subject to the terms of their respective owners and providers.

## Contributing

Issues, bug reports, model critiques, interface improvements, new scenario modules, additional data mappings, and pull requests are welcome.

For changes to model behavior, contributions are especially useful when they document:

- The economic mechanism being represented
- The variables affected
- The assumed direction and magnitude
- Timing and persistence
- Possible interactions or double-counting risks
- Sources or reasoning supporting the change

Transparent assumptions are a core design goal of the project.

## MACROSCOPE v6 additions

- **Portfolio Lab:** factor-based 12-month stress testing for a user-defined portfolio.
- **Scenario Tree:** probability-weighted branching analysis across up to six captured scenarios.
- **Ask MACROSCOPE:** LLM-backed explanations grounded in current model state, with a local no-backend fallback.
- **News → Shock → Portfolio:** headlines can be translated into reviewable shocks, then into macro and portfolio consequences.
- **Automatic Pages refresh/deploy:** the v5 GitHub Actions workflow remains the deployment path; pushes and the hourly schedule deploy without manual Pages publishing.

See `V6_OVERHAUL.md` for details and caveats.


## MACROSCOPE v7 additions

- **AI Counterfactual Studio:** natural-language questions become validated slider changes and/or structured shock commands.
- **Central slider registry:** 88 controls plus shock channels and Taylor Rule metadata are versioned in `data/slider-registry.json`.
- **Strict structured output:** the Worker is configured for Groq GPT-OSS 20B JSON Schema mode.
- **Automatic baseline → scenario explanation:** after MACROSCOPE runs the command, the LLM explains the simulator outputs rather than generating the numerical result itself.
- **News and PDF → scenario:** headlines and extracted PDF text can be interpreted through the same constrained command path.
- **No browser API secrets:** provider credentials remain only in the Cloudflare Worker secret store.

See `V7_AI_COUNTERFACTUAL.md` for the architecture and deployment checklist.

## Live data backend patch

The Worker now includes an optional Cloudflare D1-backed **MACROSCOPE Live Data Gateway**. When configured, current official observations refresh on Worker Cron Triggers and the browser reads them from `/api/data/latest`; the existing generated economic-calendar JSON remains as a fallback and for richer release/surprise history. See `worker/LIVE_DATA_SETUP.md`.
