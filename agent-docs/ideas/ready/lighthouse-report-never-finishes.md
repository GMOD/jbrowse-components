---
name: lighthouse-report-never-finishes
description: "browser-tests/lighthouse-report.ts ran past a 400 s timeout on the shell scenario (2026-11-19): Lighthouse waits for a network-quiet window the app does not give it. Cap its load wait, or retire it for measure-web-bundle and the coverage probe."
---

# lighthouse-report never finishes

`node browser-tests/lighthouse-report.ts shell` on a fresh production build
printed npx's notices and nothing else for 400 s, then was killed.

- **Likely cause:** Lighthouse ends a load on network and CPU quiet, and the
  page keeps a worker and polling alive. `measure-web-bundle` and
  `analyze-loaded-bundles` end on the app's own drawn marker instead.
- **Fix:** pass `--max-wait-for-load` (and possibly
  `--throttling-method=provided`), and confirm it then reports.
- **Or retire it:** its unused-JS audit stops at the chunk, which
  [a-coverage-probe-that-maps-unused-bytes-to-source-files](a-coverage-probe-that-maps-unused-bytes-to-source-files.md)
  answers per source file and across the worker.
