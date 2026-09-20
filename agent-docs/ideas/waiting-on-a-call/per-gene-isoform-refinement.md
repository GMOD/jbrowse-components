---
name: per-gene-isoform-refinement
description: Refine the fit ladder's one global isoform count per gene, so a lone gene in a sparse column keeps the transcripts a crowded column's neighbour cannot — parked at 8.18ms of extra solve per drag frame, with the two shapes that would make it affordable.
---

# Per-gene isoform refinement

The fit ladder's `isoforms` rung solves ONE count and applies it to every gene
on screen (ADR-092). That is the count the busiest column needs, and a lone gene
in a sparse stretch of the same viewport gets it too — trimmed to five
transcripts with 60px of empty track under it.

## The design

After the global bisection lands on `k`, walk the trimmed genes in bp order and
bisect each one's own count in `[k, isoformCount]` with every other gene fixed,
keeping the largest that still fits. Genes in bp order rather than by how much
they have to give, so the answer does not depend on the order a re-solve happens
to visit them in, and a pan that brings one more gene into view moves the
neighbours it actually stacks with rather than reshuffling the screen.

`trimIsoformStack` already answers per gene, so the only new machinery is a
per-gene count map where `LayoutInputs.maxIsoformsPerGene` is a scalar, threaded
through `decideLabelReservations` and the incremental memo's cache key.

## Why it is parked: 8.18ms per drag frame

Measured 2026-08-25 in a jest process on a 30-gene region (4-11 transcripts
each, 70 bp/px, 200px track), through `createIsoformCountProbe` — the same
prepared-once probe the rung uses:

| what                                | ms   |
| ----------------------------------- | ---- |
| one pack at one count               | 0.17 |
| the global solve (prep + ~5 probes) | 0.88 |
| per-gene refinement, 22 genes × 3   | 8.18 |

The refinement is **9x the solve it refines**, and it lands on a frame that has
not yet paid for the committed pack, the clone, `applyIsoformTrim`, the GPU
upload or the paint. Every pan settle and every resize-drag frame re-solves, so
this is a per-frame cost, not a one-off. At a 16.7ms budget it is not affordable
as written.

## What would make it affordable

- **A per-gene probe.** The 8.18ms is 66 whole-region packs to answer 22
  one-gene questions. A gene's own count only moves its own column, so a probe
  that re-packs the affected bp span rather than the region would cut it by
  roughly the ratio of one gene's span to the viewport's.
- **Refine off the drag path.** The global count is what a drag frame needs; the
  refinement is a settled-state improvement. Solving it once the height has held
  still — the cadence `coarseBpPerPx` already uses for zoom — costs a drag frame
  nothing and still gives the reader the fuller stack they end up looking at.
  The cost is a visible reflow after the drag stops, which is the thing to
  measure before building it.

Re-measure before either: the numbers above are a jest process, so treat them as
a ratio rather than as wall-clock in the app.
