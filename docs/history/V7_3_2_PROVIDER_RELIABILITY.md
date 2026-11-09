# MACROSCOPE v7.3.2 — Provider reliability

This patch addresses scenario requests where Groq returned HTTP 200 but the
assistant message contained no final `content`.

For GPT-OSS scenario construction the Worker now:

- uses low reasoning effort for JSON-producing scenario calls;
- excludes reasoning traces from the response;
- gives the model a larger completion budget so reasoning cannot consume the
  entire response allowance;
- reports `finish_reason` and completion-token metadata when the provider still
  returns no final content;
- retries once in plain-output mode with compact-JSON instructions;
- preserves MACROSCOPE's own allowlist/range validation before any scenario can
  be previewed or executed.

The existing lean-registry, sourced-data, provenance, and v7.3 terminal UI
changes are preserved.
