# MACROSCOPE v6 — Scenario Laboratory

## Major additions

### Portfolio Lab
A factor-based portfolio stress engine translates the current macro scenario into 12-month sensitivity estimates for broad equity, sector, Treasury, credit, gold, oil, and cash proxies. It deliberately does **not** output security price targets. The assumptions are visible in `index.html` under `PORTFOLIO_ASSETS`.

### News → Shock → Portfolio pipeline
The existing news intelligence feed can send a headline into AI Shock Studio. After human review and explicit injection, the macro model recalculates and Portfolio Lab updates automatically. AI drafts also show a non-persistent portfolio impact preview before injection.

### Scenario Tree
Capture up to six frozen scenario branches, attach subjective probabilities, and calculate normalized probability-weighted GDP, CPI, Treasury, S&P-index and portfolio outcomes. Probabilities are user judgments, not model-estimated likelihoods.

### Ask MACROSCOPE
A new analyst interface sends the current model state, major GDP drivers, active shocks, release signals, portfolio exposures, and scenario-tree summary to the same optional serverless LLM backend. If no backend exists, a local deterministic model summary is available.

### Share links
Portfolio holdings and portfolio value now travel with shareable scenario URLs.

## Cloudflare Worker
The Worker now supports two modes:
- default / shock mode → returns validated structured shock JSON
- `mode: "analyst"` → returns a grounded explanation based only on supplied simulator context

The API key remains server-side.

## Important modeling caveat
Portfolio coefficients are transparent scenario priors, not estimated ticker-level betas. The portfolio engine is intended for comparative stress testing and educational scenario analysis, not investment advice or a security forecasting service.
