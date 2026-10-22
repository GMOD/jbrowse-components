---
name: hic-ratio-count-filter
description: A Hi-C ratio built from a few counts is speckle, and the display has no filter to quiet it beyond the pseudocount of 1. The Hi-C display has no `filter` slot yet, and adding one is a config spelling the 5.0.0 tag freezes.
metadata:
  area: config
  category: ready
  order: 2
  first_move: "decide whether LinearHicDisplay takes ADR-238's `filter` list over `observed` and `control`, applied in the worker before the ratio"
---

# A Hi-C ratio can leave out cells built from a few counts

Observed/expected and observed/control both divide small numbers far from the
diagonal. The pseudocount of 1 that observed/control adds (`executeRenderHicData.ts`)
tames a ratio of two near-zero counts, and Juicebox stops there too, but a
reader comparing two shallow libraries still sees speckle that a minimum count
would remove.

ADR-238's predicate list is the spelling: `filter: [{ field: 'control', gte: 5 }]`
quiets the cells whose denominator is noise, and `{ field: 'observed', gte }`
the numerator. The fields are the two counts the worker already holds per cell,
so the predicate is one compare in the packing loop.

- A filter on observed alone drops exactly the contacts a condition lost, the
  cells observed/control exists to show. A default, if any, filters on the sum
  or on the control.
- Hi-C has no `filter` slot today; adding one is config vocabulary, so it lands
  before the 5.0.0 tag or waits a major version.
