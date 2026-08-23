---
name: group-the-methylation-paths-cigar-walk-the-way-the-marks-path-now-is
description: decide whether the exported callback's order is a contract
metadata:
  area: alignments, perf
  category: ready
---

# Group the methylation path's CIGAR walk, the way the marks path now is

`getModPositions` shares one positions array across the types of an MM group, and
`forEachMaxProbMod` groups the entries holding it by identity so a `C+mh` read
walks the CIGAR once instead of once per type. **`forEachModRefPos` is the third
walk and still per entry** — same duplication, one layer over in the
fill-unmarked methylation path (it is what `getMethBins` drives). A CIGAR walk is
O(read length), so on a 50 kb read a combined code pays ~50k iterations twice for
offsets the first pass already visited.

Two things make this not a copy of the fix that landed:

- **The callback order changes**, from "all of type m, then all of type h" to
  "both types at each position, ascending". `getMethBins` is order-independent —
  it writes `methBins[ref]` and `hydroxyMethBins[ref]`, disjoint arrays keyed on
  position — but `forEachModRefPos` is **exported from
  `@jbrowse/modifications-utils`**, so an external consumer accumulating
  sequentially per type would break. Decide whether that export is a contract
  before reordering it, or give the grouped walk its own entry point.
- **It is unmeasured.** `modCombinedCode.bench.ts` prices the marks path; nothing
  prices this one, and the mode is off by default (fill-unmarked). Extend that
  bench with a `getMethBins` arm rather than reasoning from the other number — the
  emit work per position is genuinely different here, since both channels are
  kept rather than only the winner.
