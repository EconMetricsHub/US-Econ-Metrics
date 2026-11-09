# MACROSCOPE v5 Overhaul

## What changed
- Automatic GitHub Pages deployment on every push to `main`.
- Hourly scheduled data refresh + deployment, so official data and the news layer update without manual Pages deployment.
- New **Live News Intelligence** page populated by GDELT DOC 2.0.
- New **AI Shock Studio** inside Events & Shocks. It converts natural-language scenarios into reviewable structured shocks.
- Optional Cloudflare Worker keeps the LLM API key off GitHub Pages.
- News headlines can be sent directly to the AI Shock Studio as context.

## One-time GitHub configuration
1. Settings → Pages → Build and deployment → Source → **GitHub Actions**.
2. Settings → Secrets and variables → Actions → repository secret `FRED_API_KEY`.
3. Commit this version to `main`. From then on, pushes deploy automatically and the hourly schedule refreshes data/deploys the current artifact.

## Why the AI layer is not a literal Duck.ai proxy
GitHub Pages is static and cannot safely hold credentials or run a server-side proxy. Duck.ai also does not provide a documented public API contract intended for this integration. v5 therefore copies the useful interaction pattern—a privacy-conscious chat-like scenario composer—while using an explicit, configurable serverless backend.

## Recommended v6 architecture
The current app remains a very large single `index.html`. The next cleanup should split it into `src/model/`, `src/ui/`, `src/data/`, `src/shocks/`, and `src/charts/`, with a small Vite build. That would make testing, versioning, and future AI/news integrations much safer.
