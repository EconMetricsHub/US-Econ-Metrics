# MACROSCOPE v7.3.1 — JSON Reliability

This release keeps the v7.3 lean scenario context and terminal UI, while making Scenario Studio more tolerant of imperfect model output.

## Changes

- Scenario construction now requests a normal JSON object instead of a strict provider-side JSON Schema.
- MACROSCOPE remains the enforcement layer: unknown slider IDs, shock targets, invalid ranges, and unsupported operations are rejected or clamped server-side.
- Minor field-shape differences are normalized before validation (`snake_case`, alternate wrapper keys, and common aliases).
- JSON parsing strips code fences and can extract the first complete JSON object from surrounding text.
- If the provider rejects JSON-object mode, the Worker retries once without `response_format` while requiring a single JSON object.
- Scenario output allowance is raised modestly to reduce truncation risk.

The security model is unchanged: the LLM proposes a command; MACROSCOPE validates it and the user still reviews the preview before execution.
