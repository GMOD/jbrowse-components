---
name: comparing-an-imported-function-against-a-local-copy-of-it
description: Comparing an imported function against a local copy of it, as a perf A/B.
area: performance-and-measurement
---

# Comparing an imported function against a local copy of it, as a perf A/B.

V8 optimizes the two differently, and the gap is large enough to invent a
result: a control pitting `buildInstanceBuffer` against a byte-identical local
copy read 0.93x / 1.09x / 0.95x across three shapes. Anything under ~10% in
that harness is noise. Copy *both* sides locally, alternate which runs first
(whichever goes first absorbs the other's GC — worth 13% on its own), and
assert the two outputs are identical before believing the timings. Same
lesson, different mechanism, as the sequential-timing entry above.
