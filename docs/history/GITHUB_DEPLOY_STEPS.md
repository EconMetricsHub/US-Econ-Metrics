# MACROSCOPE v7 — GitHub Pages + Groq/Cloudflare deployment

This version keeps the economic model in the browser and uses an AI service only to translate natural-language counterfactuals into validated MACROSCOPE controls and to explain completed model runs.

## 1. Upload the v7 files to the GitHub repository

Replace/add these files while preserving their paths:

- `index.html`
- `data/slider-registry.json`
- `worker/src/index.js`
- `worker/wrangler.toml.example`
- `worker/README.md`
- `worker/.gitignore`
- `README.md`
- `V7_AI_COUNTERFACTUAL.md`

If you use the full v7 ZIP, you can replace the repository contents with the ZIP contents instead.

Commit and push to the branch that currently publishes the site. If the existing GitHub Pages URL is already live, this is normally all that is needed for the static-site update.

If Pages is not configured, open **Repository → Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. `index.html` is in the repository root.

## 2. Create a Groq API key

Create a Groq API key in the Groq console. Do **not** put the key in `index.html`, JavaScript, GitHub Pages, or the Git repository.

The supplied Worker defaults to:

- API base: `https://api.groq.com/openai/v1`
- model: `openai/gpt-oss-20b`

## 3. Deploy the Cloudflare Worker

From a terminal with Node.js installed:

```bash
cd worker
npm install -g wrangler
cp wrangler.toml.example wrangler.toml
wrangler login
wrangler secret put LLM_API_KEY
wrangler deploy
```

When prompted by `wrangler secret put LLM_API_KEY`, paste the Groq key.

The example configuration allows the production GitHub Pages origin:

```toml
ALLOWED_ORIGIN = "https://YOUR-WORK-ACCOUNT.github.io"
```

If the site is hosted under a different GitHub account or a custom domain, change this to the site's **origin only**. For example, `https://example.github.io`, not `https://example.github.io/repository-name/`.

After deployment, Cloudflare prints a Worker URL similar to:

```text
https://macroscope-ai.YOUR-SUBDOMAIN.workers.dev
```

Open that URL in a browser. A GET request should return a small JSON health response identifying the MACROSCOPE AI bridge.

## 4. Wire the Worker into the public website

In the repository-root `index.html`, find:

```js
const DEFAULT_AI_ENDPOINT = '';
```

Change it to the Worker URL:

```js
const DEFAULT_AI_ENDPOINT = 'https://macroscope-ai.YOUR-SUBDOMAIN.workers.dev';
```

Commit and push `index.html` again. Once GitHub Pages redeploys, public users no longer need to paste an endpoint manually.

## 5. Test the deployed pipeline

Open the public site in a fresh/incognito browser and try these in **AI Counterfactual Studio**:

1. `What happens if inflation rises by two percentage points for a year?`
2. `Simulate a recession with higher unemployment and lower consumption.`
3. `What if the Federal Reserve responds aggressively to inflation?`
4. `Compare the baseline with a persistent oil-price shock.`
5. `What happens if the Taylor Rule is enabled?`

The expected workflow is:

```text
question
→ Groq returns a schema-constrained command
→ browser validates IDs/ranges/operations again
→ preview is displayed without changing the live scenario
→ user clicks Run validated scenario
→ MACROSCOPE applies the accepted controls and runs the simulator
→ the Worker explains the resulting baseline/counterfactual differences
```

Also test **Ask MACROSCOPE** after running a scenario. It should explain only the simulator state sent to it rather than inventing current market data.

## 6. Important operating notes

- The Groq key lives only in the Cloudflare Worker secret store.
- `slider-registry.json` is the common control contract used by the UI and AI layer.
- Unknown slider IDs are rejected.
- Values are range checked and snapped to slider steps in the browser.
- The Worker performs an additional validation pass before returning the command.
- The AI never executes arbitrary JavaScript and cannot create new simulator controls.
- News/document text is treated as a scenario input unless the application separately identifies it as observed data.
- PDF text extraction is client-side; scanned/image-only PDFs require OCR and are not handled by this implementation.
- The Worker origin restriction reduces accidental cross-site use of your quota, but a public Worker endpoint is not equivalent to authenticated access. If traffic grows or abuse becomes a problem, add Cloudflare rate limiting, Turnstile, or another server-side access-control layer.

## 7. Updating the simulator later

When adding or changing a UI slider, update `data/slider-registry.json` at the same time. Keep the registry version synchronized with `AI_REGISTRY_VERSION` in `index.html`. The AI layer should never be given controls that the local simulator cannot validate and execute.
