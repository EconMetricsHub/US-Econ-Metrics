# MACROSCOPE AI Counterfactual Worker

This Cloudflare Worker is the private server-side bridge between the static GitHub Pages frontend and an OpenAI-compatible LLM provider. The included configuration targets **Groq + `openai/gpt-oss-20b`**.

The browser never receives the provider API key. The LLM cannot directly modify the interface or execute arbitrary code. It returns a JSON-schema-constrained **scenario command**. The website validates that command against `data/slider-registry.json`, previews it, and only applies it after an explicit user action. After execution, the same Worker can receive baseline/counterfactual simulator outputs in `mode: "analyst"` and explain the model result.

## Deploy with Groq

1. Create a free Groq API key.
2. Install Wrangler: `npm i -g wrangler`
3. From this `worker/` directory, copy `wrangler.toml.example` to `wrangler.toml`.
4. Replace `YOUR-USERNAME` in `ALLOWED_ORIGIN` with your GitHub username. If the Pages site uses a custom domain, use that origin instead.
5. Authenticate Wrangler: `wrangler login`
6. Store the Groq key as a secret: `wrangler secret put LLM_API_KEY`
7. Deploy: `wrangler deploy`
8. Open the printed `https://...workers.dev` URL in a browser. A small JSON health response should appear.
9. Paste that Worker URL into **Events & Shocks → AI Counterfactual Studio** or **Ask MACROSCOPE**. The site stores only the Worker URL in localStorage.

## Required provider configuration

```toml
LLM_API_BASE = "https://api.groq.com/openai/v1"
LLM_MODEL = "openai/gpt-oss-20b"
```

The scenario route uses Groq strict Structured Outputs (`response_format.type = "json_schema"`, `strict = true`). The Worker performs a second validation pass even though the model output is schema constrained.

## Request modes

### Scenario construction (default)

```json
{
  "prompt": "What happens if oil rises to $130 for a year and the Fed follows the Taylor Rule?",
  "context": { "...": "registry + current simulator state" }
}
```

Returns:

```json
{ "command": { "...": "validated scenario command" } }
```

### Analyst/explanation

```json
{
  "mode": "analyst",
  "prompt": "Explain the baseline-to-counterfactual changes.",
  "context": { "...": "baseline + result + command" }
}
```

Returns `{ "answer": "..." }`.

## Make the public site use the Worker automatically

After `wrangler deploy`, copy the HTTPS Worker URL (for example `https://macroscope-ai.YOUR-SUBDOMAIN.workers.dev`).
In the repository root `index.html`, find:

```js
const DEFAULT_AI_ENDPOINT = '';
```

and replace it with:

```js
const DEFAULT_AI_ENDPOINT = 'https://macroscope-ai.YOUR-SUBDOMAIN.workers.dev';
```

Commit that change to the GitHub Pages publishing branch. Visitors will then use the Worker automatically. The endpoint field in the AI Studio remains available as a per-browser override.

`ALLOWED_ORIGIN` is enforced on browser POST requests as well as returned in CORS headers. For the current GitHub Pages deployment use `https://YOUR-WORK-ACCOUNT.github.io` (origin only; do not include the repository path). During local development you can temporarily add a second comma-separated origin such as `http://localhost:8000`, then remove it for production.


## Live Data Gateway (D1 + Cron)

This patch adds a persistent latest-data layer without changing the simulator equations or the Groq scenario route.

- `src/live-data.js` owns the approved series catalog and data transport.
- FRED API + `FRED_API_KEY` is the preferred source.
- Public FRED graph CSV is a keyless continuity fallback.
- A D1 binding named `MACROSCOPE_DB` stores latest values, history, revisions, and sync health.
- Cron Triggers refresh automatically; the static GitHub Pages site does not need to be rebuilt for each data release.
- Data Copilot now prefers stored D1 observations and falls back to direct validated retrieval.

See [`LIVE_DATA_SETUP.md`](LIVE_DATA_SETUP.md) for the one-time D1 setup and endpoint list.
