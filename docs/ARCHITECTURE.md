# Application boundaries

The page remains a static, no-build application. Script tags in `index.html` are the dependency manifest; do not mark them async or reorder them casually. Classic global bindings retain compatibility with existing HTML handlers. These are separated source files, not isolated ES modules. Some legacy UI helpers still live beside the domain state they operate on; future changes can move them behind explicit interfaces incrementally.

## Data ingestion

`news-client.js` reads the shared source configuration, fetches public RSS/Atom and GDELT concurrently, normalizes article records and HTTP(S) links, and merges available results with snapshots and cache. Its output is news context, never model state. Source publication time, browser collection time, collector last-success time and cache reuse are distinct.

`scripts/update_news.py` uses the Python standard library to collect the same source configuration outside browser CORS restrictions. Failed and empty responses preserve each source's previous good articles. Total failure retains the prior generated timestamp. Writes use a temporary file plus replacement. The Pages workflow restores previous snapshots from Actions cache; cache expiration falls back to the checked-in snapshot.

`services/official-data.js` owns numeric observation ingestion, baseline synchronization and official release surprises. `services/ai.js` owns the optional constrained scenario service. Neither is needed for local news assumptions.

## Event identity

`news-events.js` normalizes headline tokens and reporting periods, and groups conservative matches. A cluster prefers an official source as its representative. Complete-linkage matching avoids a generic bridge article joining otherwise unrelated events. A shared macro reporting period forms a reusable event identity across release revisions. Other events use canonical source identity, plus related-story matching when checking existing assumptions.

Unknown publication dates are not treated as current. Topic matches alone do not establish event equivalence. Users can explicitly associate a new story with an existing ledger event. This replaces, rather than stacks, the earlier assumption. It does not suppress unrelated manual shocks or official-data release signals; those require user review.

## Model and preview

`core/model.js` contains the existing economic equations, extracted without equation changes. `core/state.js` contains defaults, preset events and shock timing/overlap logic.

`core/news-scenarios.js` is the news-to-model bridge. It validates a reviewed draft, finds related existing assumptions, and previews a replacement by temporarily installing one event and excluding related active events. A `try/finally` restores the original active-event object and removes the temporary definition, even if computation fails. The preview uses the same enrichment, timing and portfolio calculations as application. The UI accepts a preview only if values, event choice and scenario/portfolio fingerprint still match.

News coefficients are bounded, illustrative scenario priors. They do not constitute article sentiment scores, inferred observations or estimated causal effects.

## UI and storage

`ui/news.js` owns feed filtering, source health, review controls, preview tables and the assumption ledger. The ledger is derived from custom news event definitions and active shock configuration; it has no independent duplicate store. Source references are canonicalized and deduplicated before serialization.

`storage/scenarios.js` owns saved scenarios. `storage/history.js` owns shared URL state, snapshots and undo/redo. Restoring a snapshot replaces the custom definitions, which prevents removed news events from lingering in the ledger or stale definitions overriding restored coefficients. Scenario exports preserve provenance, reporting timestamps, review time, chosen preset and all linked article URLs.

`ui/dashboard.js`, `ui/scenario-tools.js`, `ui/analysis.js`, `ui/interaction.js` and `ui/terminal.js` retain the surrounding app. `app.js` runs initialization after all definitions load. The existing command-center extension loads last. Styles are separated into base, command-center and news files; the final news stylesheet also fixes a legacy mobile layout that reserved a hidden sidebar column.
