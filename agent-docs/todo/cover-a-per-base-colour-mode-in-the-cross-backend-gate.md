---
name: cover-a-per-base-colour-mode-in-the-cross-backend-gate
description: `grep perBase` over the browser tests finds only the probe, so a wall that draws differently on the two backends has nothing to fail
metadata:
  area: alignments, browser tests
  category: ready
---

# No cross-backend test covers a per-base colour mode

`grep perBase` over `products/jbrowse-web/browser-tests/` finds
`probe-per-base-bin.ts` and nothing else. The probe is a two-build differ run by
hand for one measurement; it is not a gate and does not run in a sweep. So
`perBaseQuality` and `perBaseLetter` — the two modes that draw a cell per
aligned base, the densest thing the pileup paints — are covered by no
cross-backend check at any zoom.

That is why the sub-pixel bin shipped on a claim nothing could have failed. The
commit said "nothing visible changes"; it was true for `perBaseQuality` and
false for `perBaseLetter`, and the measurement that found it was written after
the fact ([reference/PER_BASE_SUBPIXEL_BIN.md](../reference/PER_BASE_SUBPIXEL_BIN.md)
§"The appearance claim was false").

**First move: one scene per mode in the existing gate**, not a new harness —
[reference/CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md) has what a
scene costs and what it compares. Pick the zoom deliberately: the interesting
band is where `binBp > 1`, since below 4 bp/px the bin is inert and the scene
would pass under any change to it.

Note the constant this locks in. `binBp` sits in `(bpPerPx/4, bpPerPx/2]`, so a
per-base pixel composites a constant 2-4 cells at every zoom by construction —
the wall still reads as sub-pixel, just less so. A scene that expects a clean
one-cell-per-pixel picture will be wrong about what it is looking at.
