# MACROSCOPE v7.2 — Sourced Data Copilot

This patch adds a review-gated official-data workflow to MACROSCOPE.

## What it does

- Adds **Data Copilot** to the Analysis navigation.
- Accepts natural-language requests such as **Bring MACROSCOPE current**.
- Uses the LLM only to choose from an approved macro-series catalog.
- Fetches actual observations directly from FRED.
- Shows the value, prior observation, current-model value, source agency, FRED series, observation date, retrieval time, and model mapping.
- Requires explicit user review before any model update is applied.
- Updates compatible sliders for direct-input data.
- Uses GDP, headline CPI, Treasury yields, and mortgage rates as output calibration anchors.
- Keeps metrics such as Core CPI as sourced display context instead of forcing them into a nonexistent slider.

## Files to replace

1. Repository root: `index.html`
2. Worker source: `worker/src/index.js`
3. Optional: replace/confirm `worker/wrangler.toml`

## Worker secrets

From the local `worker` directory:

```powershell
npx.cmd wrangler secret put LLM_API_KEY --config wrangler.toml
npx.cmd wrangler secret put FRED_API_KEY --config wrangler.toml
```

Paste the corresponding key when prompted. Neither secret belongs in GitHub or `wrangler.toml`.

## Deploy the Worker

```powershell
npx.cmd wrangler deploy --config wrangler.toml
```

The health URL should still return the MACROSCOPE AI bridge JSON.

## Publish the frontend

Upload the new root `index.html` to the GitHub repository, commit it, and wait for GitHub Pages to redeploy. Hard refresh the public site afterward.

## First test

Open **Analysis → Data Copilot** and submit:

> Bring MACROSCOPE current. Retrieve the latest major U.S. macro observations, cite every source and date, compare them with the current model, and prepare updates for my approval.

Review the proposed observations. Click **Apply approved updates** only after checking the source/date mappings.

## Approved series in v7.2

Headline CPI, Core CPI, PCE inflation, unemployment, labor-force participation, monthly payroll change, real GDP growth, effective fed funds rate, interest on reserve balances, 2-year Treasury, 10-year Treasury, 30-year mortgage, housing starts, WTI crude oil, Henry Hub natural gas, industrial production growth, and real consumer spending growth.


## v7.2.1 routing and review update

- **Ask MACROSCOPE now auto-routes current/latest-data requests to Data Copilot.** The ordinary analyst endpoint no longer tries to fabricate a current-data checklist.
- Broad “bring MACROSCOPE current” requests retrieve the full approved series catalog, including industrial production and IORB.
- Proposed observations render in a review table with checkboxes, current model values, latest official values, deltas, observation dates, source links, and explicit model actions.
- Applying a proposal remains review-gated. Official observations, model outputs, scenario assumptions, and user overrides remain conceptually separate.
- User-facing version labels are normalized to **MACROSCOPE v7.2**.
