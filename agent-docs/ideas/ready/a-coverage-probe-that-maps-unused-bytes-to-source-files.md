---
name: a-coverage-probe-that-maps-unused-bytes-to-source-files
description: "Which source files ship bytes that never run? Chrome's precise coverage on the page and every worker, mapped through the source maps and unioned over several loads, answers it; analyze-loaded-bundles and Lighthouse stop at the page or the chunk."
---

# A coverage probe that maps unused bytes to source files

The probe exists as a scratch script; it belongs in
`products/jbrowse-web/browser-tests/` beside `analyze-loaded-bundles.ts`.

- **What it does:** for each load, `Profiler.startPreciseCoverage` on the page
  session and on every dedicated worker, attached through
  `Target.setAutoAttach` with `waitForDebuggerOnStart` so the RPC worker and the
  bgzf pool are covered from their first line. It unions the executed bytes per
  chunk across the loads, walks each chunk's source map, and reports per source
  file the minified bytes, the bytes that ran, and both gzipped.
- **Loads:** the empty shell, an empty LGV, one wiggle track, four tracks and one
  CRAM track. A byte counts as used if any load ran it.
- **What it found** (2026-11-19, `cc7fae0f32`): 4.5 MB minified across 122
  files, 51% ever run. Ranked by unused gzip, the tail is long: past react-dom
  no file wastes more than about 9 KB, and the families that add up are menu
  builders, the generated shader interfaces, `render-core/marks`, and tooltips
  with floating-ui.
- **Caveat to print with it:** each source is gzipped alone, which overstates
  repetitive generated code by up to twice. Rank by it; confirm a cut with
  `measure-web-bundle --worker` on a rebuilt app.
- **Needs** a build with source maps and stats (`build.ts --stats`).
