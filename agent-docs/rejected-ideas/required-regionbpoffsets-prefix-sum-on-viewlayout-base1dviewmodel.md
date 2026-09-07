---
name: required-regionbpoffsets-prefix-sum-on-viewlayout-base1dviewmodel
description: Required `regionBpOffsets` prefix-sum on `ViewLayout`/`Base1DViewModel`
area: config-and-mst
---

# Required `regionBpOffsets` prefix-sum on `ViewLayout`/`Base1DViewModel`

—
works, and erases ~2.3ms of a 16.7ms frame (measured 2026-07-31, 3000 regions,
viewport on the last: `calculateStaticBlocks` 1.94ms/call,
`calculateDynamicBlocks` 0.33ms, `pxToBp` 0.11ms per mousemove). Rejected: it
makes a derivable value a required field whose consistency with
`displayedRegions` nothing can check, and drags ~90 call sites plus most tests.
Shipped instead: a `break` past the window's right edge, fixing the head of
the scan. A module-level `WeakMap` on the regions array is also out. Discuss
before re-attempting.
