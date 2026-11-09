# Current revision: source reliability, event identity and reviewed assumptions

1. Added a shared source configuration for Fed, BLS CPI/employment, BEA and GDELT. The browser and scheduled collector isolate failures and preserve usable saved data. Added per-source health, freshness, official-source filtering and RSS/Atom imports. The ZIP includes a real official-news snapshot; GDELT was unavailable during collection.
2. Added conservative event grouping and retained all source links. Reapplying related reporting replaces an existing event assumption; manual event association covers missed matches.
3. Added a transactional current/proposed model and portfolio preview. Edits or scenario changes invalidate the preview; applying requires a matching preview.
4. Added a news assumption ledger with provenance, chosen coefficients, magnitude, timing and edit/disable/remove actions. Custom definitions restore exactly with saved scenarios and undo/redo.
5. Split the former large app script into model, ingestion/service, storage, UI and bootstrap files while preserving the economic equations and no-build setup. Moved remaining embedded styles to CSS files and corrected the inherited mobile sidebar-column issue.

The previous privacy cleanup remains: no Git history, former personal Worker endpoint, active D1 configuration, duplicate patch payloads, timestamped backups or installer scripts. Original GPL-3.0 remains intact. This does not erase copies of historical external records.
