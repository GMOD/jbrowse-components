---
name: jump-to-the-next-significant-variant-in-view
description: An alignments track has no way to step from one real SNP to the next. `findSignificantInBin` already answers whether a bp range holds one against the local depth, so a menu item and a key give variant-to-variant navigation within the fetched region.
---

# Jump to the next significant variant in view

`findSignificantInBin` (`packages/alignments-core/src/positionIndex.ts`)
already answers "is there a real SNP in this bp range" against the local depth.
It exists for the hover tooltip at wide bpPerPx, so wiring it to a menu item
and a keyboard shortcut gives variant-to-variant navigation off data already on
the main thread.

- Its threshold is the caller's, so this reads the same
  `coverage.alleles.filter` the band's colors do rather than inventing a second
  notion of significant.
- It is bounded by the fetched region, which is the honest limit and worth
  saying in the UI: "next in view", not "next in the genome".
