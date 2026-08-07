---
name: changelog
description: Use when creating or updating changelog entries.
---

# Changelog Writing

Write concise, customer-facing entries in one file per month:
`changelogs/YYYY-MM.md`.

## Rules

1. Use one file per month. Do not grow one changelog file forever.
2. Group entries by day inside the monthly file, using ISO dates.
3. Use plain wording, short sentences, and active voice.
4. Describe customer impact. Do not expose engine internals, services, or tooling.
5. Include a short commit SHA when it helps users or maintainers trace the change. Keep it out of the prose.
6. Use newest-first order.
7. Omit internal, trivial, and non-user-facing changes.
8. Use automation for formatting or reminders only. A person must curate the final entries.

## Example

```md
# August 2026

## 2026-08-07
- Improved graph loading for large datasets. ([2d4f9a1](https://github.com/example/repo/commit/2d4f9a1))
```
