# MACROSCOPE v7 — AI Counterfactual Controller

## Goal

MACROSCOPE v7 lets a small language model interpret economic counterfactuals without turning the model into an opaque LLM forecast. The LLM chooses from predefined controls; the local simulator still computes the result.

## Runtime pipeline

```text
User question / headline / extracted PDF text
    ↓
Cloudflare Worker
    ↓
Groq openai/gpt-oss-20b
    ↓
Strict JSON scenario command
    ↓
Browser registry validation + preview
    ↓
Explicit user approval
    ↓
MACROSCOPE slider state + structured shock engine
    ↓
Simulator outputs + charts + portfolio stress
    ↓
Worker analyst mode explains the baseline-to-counterfactual delta
```

The LLM never receives permission to execute JavaScript, write arbitrary state, or create new controls.

## Registry

`data/slider-registry.json` is version `2.0.0` and contains:

- 88 interface sliders
- slider ID, label, description, simulator variable, unit, range, step, default, region availability, allowed operations, economic meaning, downstream effects, source, category, and version
- 28 allowed time-dependent shock targets with explicit safe effect ranges
- the AI-controllable Taylor Rule setting

The browser checks that the registry contains every slider in the current UI. If the JSON cannot be loaded, an in-page fail-safe registry is used so the static simulator still works.

## Scenario command

A command can contain three independent kinds of change:

1. **Slider changes** — persistent levels such as oil price, unemployment, deficit, permitting speed, tariffs, or policy rate.
2. **Settings** — currently the Taylor Rule. The command contains an `apply` flag so a prompt that does not mention the rule does not silently change it.
3. **Structured shock** — temporary/persistent/structural effects with duration, lag, peak, decay, confidence, magnitude, and up to five channels.

The Worker validates the command once, then the browser validates it again against its locally loaded registry.

## Groq configuration

The included Worker defaults to:

```toml
LLM_API_BASE = "https://api.groq.com/openai/v1"
LLM_MODEL = "openai/gpt-oss-20b"
```

The provider key is stored with Wrangler as `LLM_API_KEY` and is never placed in `index.html`, a GitHub Actions variable, or a public repository file.

## GitHub Pages deployment

The GitHub Pages portion remains a static site. Commit these files to the repository root:

- `index.html`
- `data/slider-registry.json`
- `data/news-feed.json` and the existing data files
- `worker/` for source/configuration documentation (the Worker itself is deployed to Cloudflare, not GitHub Pages)

No build step is required for the AI frontend changes. After the GitHub Pages deployment completes, open the site, navigate to **Events & Shocks → AI Counterfactual Studio**, paste the Worker URL once, and run a test prompt.

## Recommended smoke tests

1. `Set oil to $120 per barrel.` — should propose a validated `oil` slider change.
2. `Inflation rises by two percentage points for one year.` — should prefer a temporary `cpiA` shock rather than inventing an inflation slider.
3. `Enable the Taylor Rule.` — should return `settings.taylorRule.apply=true` and `enabled=true`.
4. `Simulate a recession with unemployment at 7% and wider high-yield spreads.` — should use existing sliders/shock channels only.
5. Ask for a nonexistent control — the command should not invent an ID; if it does, browser validation discards it.
6. Run an approved scenario — the second LLM call should explain only the supplied baseline/counterfactual outputs.

## Limitations

- The LLM interprets the scenario; it does not estimate causal coefficients from historical data.
- Financial/portfolio outputs remain stress-test sensitivities, not investment recommendations or price forecasts.
- News and PDF content is treated as supplied text, not automatically verified.
- The PDF workflow extracts text client-side with PDF.js and does not OCR scanned image-only PDFs.
- Free-tier provider limits can change. The Worker URL and model can be replaced without changing the simulator equations.

## Public endpoint wiring

The browser code contains one deployment constant:

```js
const DEFAULT_AI_ENDPOINT = '';
```

After deploying the Worker, set that constant to the Worker HTTPS URL and commit the change. This prevents public visitors from having to paste an endpoint themselves. Local storage can still override the default for testing.

The Worker rejects POST requests whose browser `Origin` is not in `ALLOWED_ORIGIN`. This is useful quota hygiene, but it is not full authentication; the provider key remains protected because it exists only as the Cloudflare Worker secret `LLM_API_KEY`.

