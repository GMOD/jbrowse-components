---
name: jb-fittowindow-viewid-a-helper-that-shrinks-tracks-until-the
description: `jb.fitToWindow(viewId?)`, a helper that shrinks tracks until the session fits and scrolls the view into frame
area: tooling-tests-and-docs
---

# `jb.fitToWindow(viewId?)`, a helper that shrinks tracks until the session fits and scrolls the view into frame

declined 2026-09-06 in the review of
the plan drawn from the five filmed MCP takes. Every take spent turns on
set-height, screenshot, adjust, so it looked like the biggest lever. But a
fit needs per-view-type height knowledge (the linear view has no `setHeight`,
a synteny stack resizes levels, a dotplot sets one height), it overwrites
heights the user chose, and the gap the transcripts actually show is not
knowing the view was offscreen — which `jb.waitReady`'s `offscreen` report
now answers, with `scrollY` beside the page and window heights.
