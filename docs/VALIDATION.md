# Validation of the current revision

Validated on 2026-11-09 in Node, Python and Chromium.

## Automated checks

- 8 news unit tests passed: article/date/URL normalization, official hostname labeling, conservative preset suggestions, bounded draft validation, cache and partial-source fallback behavior, and event grouping/identity.
- Existing Worker live-data suite passed.
- 4 Python collector tests passed: RSS/Atom parsing, independent source failures with retained articles, honest timestamps on total failure/empty responses, and URL validation.
- JavaScript syntax checks passed for every extracted/new source file. Both Python refresh scripts compiled.
- Economic equations in `core/model.js` were compared with the pre-extraction source and matched exactly.

## Chromium integration

Passed the shipped `tests/browser-smoke.cjs` with controlled upstream responses:

- Simultaneous successful official RSS/media ingestion and independent source failures.
- Related-story grouping, official/media filters and source links.
- Previewing leaves the scenario snapshot unchanged.
- Model and portfolio outcomes after applying match the preview.
- Editing assumptions invalidates the preview; changing model inputs while reviewing blocks acceptance until re-preview.
- Related reporting replaces an existing active event assumption.
- Ledger edit, disable/re-enable and removal operate on the existing shock engine.
- Undo restores the removed assumption; redo removes it and its custom definition again.
- Atom imports render article titles as text, and unsafe article links are rejected.
- Navigation across overview, portfolio, events and saved scenarios produced no uncaught page errors.

Desktop and 390-pixel layouts were inspected. A legacy hidden-sidebar grid column was corrected. This is a focused integration check, not exhaustive validation of every existing simulator feature.

## Actual source collection

The key-free collector successfully retrieved 93 real articles from Federal Reserve (20), BEA (49), BLS CPI (12) and BLS Employment Situation (12) feeds. The saved snapshot contains their actual source timestamps and collection metadata. GDELT returned HTTP 503 and is marked unavailable. Successful source collection was not dependent on GDELT. The unavailable BLS generic URL was replaced with working topic-specific feeds.

Direct browser access remains subject to provider CORS, network policy, rate limits and outages. Feed parsing and browser ingestion were tested with fixtures; successful collection of the real official feeds was verified through the scheduled-collector code path. No guarantee of future upstream availability is implied.

GitHub Pages deployment, optional keyed Worker/FRED provisioning, and authorship in a new GitHub repository were not performed. Configure those using the included setup guide.
