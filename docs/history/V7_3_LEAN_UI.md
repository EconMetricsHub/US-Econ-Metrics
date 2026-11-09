# MACROSCOPE v7.3.1 — Lean Scenario Context + Sleek Research Terminal

This build combines two upgrades:

1. **Lean Scenario Context** — Scenario Studio now sends a prompt-aware subset of slider controls, compact field names, a compact shock registry, and a generic structured-output schema. Unknown IDs are still rejected by the Worker after generation. The UI estimates request size before sending and targets a payload below the Groq 8k TPM/request ceiling.
2. **Sleek Research Terminal UI** — a persistent system strip, denser navigation, a right-side MACROSCOPE Copilot rail, live model snapshot, provenance badges, tighter cards, and staged Data Copilot research progress. The rail collapses automatically on narrower screens.

## Deploy

Overwrite the existing project with this directory. Then from `worker` run:

```powershell
npx.cmd wrangler deploy --config wrangler.toml
```

Cloudflare secrets (`LLM_API_KEY`, `FRED_API_KEY`) remain stored server-side and do not need to be re-entered unless the Worker/account changed.

## Rate-limit note

Groq's TPM window resets with time, but a single request larger than the account's TPM allowance will still fail after waiting. v7.3.1 reduces the scenario request itself so detailed counterfactual prompts fit much more comfortably.
