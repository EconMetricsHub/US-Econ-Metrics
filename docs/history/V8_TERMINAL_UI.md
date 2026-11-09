# MACROSCOPE v8.0 — Compact Terminal UI

v8.0 is a presentation and control-layer overhaul built on the working v7.3.2 research/data/scenario pipeline.

## UI changes

- Compact four-row terminal shell: command bar, status strip, KPI strip, workspace.
- Bloomberg-style dense workspace with flatter panels, tighter typography, and reduced vertical padding.
- Consolidated header controls. Share/export/PDF/reset/shortcuts now live under **TOOLS**.
- Collapsible navigation rail via the ☰ button.
- Persistent right-side Copilot rail can be hidden from Appearance settings.
- Theme panel with Bloomberg Amber, Terminal Mono, Ice Cyan, Emerald, Violet, Alert Red, and a custom accent picker.
- Compact/comfortable density toggle.
- Theme/density/sidebar/rail preferences persist in localStorage.

## Scenario reasoning control

Scenario Studio now has a three-position reasoning slider:

- **Low** — default, fastest, lowest token use.
- **Medium** — larger reasoning/completion budget for multi-channel scenarios.
- **High** — deepest supported reasoning; slower and more token intensive.

The selected reasoning level is sent to the Worker as `context.aiOptions.reasoningEffort`. The Worker validates `low | medium | high` and scales completion budgets while preserving the existing JSON normalization and server-side registry/range validation.

## Deployment

Replace your existing project files with this folder, then from `worker` run:

```powershell
npx.cmd wrangler deploy --config wrangler.toml
```

Your existing `LLM_API_KEY` and `FRED_API_KEY` secrets remain stored in Cloudflare.
