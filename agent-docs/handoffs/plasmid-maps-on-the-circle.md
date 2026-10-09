---
name: plasmid-maps-on-the-circle
description: Plasmid and organelle maps on the circular view, 2026-10-09. Landed base-pair ticks, the one-contig circle (closed ring, origin tick, middle title), GFF3 features cut at a circular origin, and ring labels and highlights for the canvas feature display. Open are the two halves of an origin-crossing feature landing in different rows, the mark display's text marks on rings, the two idea docs this overtook, and a tutorial. Read before touching ring labels or circular GFF3.
---

# Plasmid and organelle maps on the circular view

`test_data/human_mito` (16.5 kb, its D-loop written 16024..17145) is the
working example. Its gene track with `facet: { field: 'strand' }` and
`color: { field: 'type' }` draws a plasmid-style map with no other setting.

Landed, each with a test that fails on the code before it:

- Base-pair ticks on every circle: `CircularView/rulerTicks.ts`, drawn by
  `Ruler.tsx`, the tick band in `rulerLabels.ts` (`tickReachPx`).
- A circle of one region closes its gap (`gapUnitsAfter`), ticks its first
  base, and is titled in the middle (`middleTitle`).
- GFF3 features past a sequence's `##sequence-region` length cut at the origin:
  `plugins/gff3/src/originSpanning.ts`, used by both GFF3 adapters.
- Ring labels and highlights: `FloatingLabelHost` in display-kit, answered by
  the canvas display's `floatingLabels`; drawn by `rings/RingOverlay.tsx`
  through `rings/ringPolar.ts`, on screen and in the SVG export.

## Next

1. **The two halves of an origin-crossing feature get packed into separate
   rows**, so the D-loop reads as two arcs offset radially. The fix lives in the
   canvas layout (`packRef.ts`): pin the `-origin` half to its head's row.
2. **The mark display's text marks (ADR-162) never reach a ring.** It needs a
   `floatingLabels` of its own, through `placeTextMarks`.
3. **File the remainders of the two idea docs this overtook, then delete them.**
   They are `ideas/ready/a-ring-draws-its-displays-labels-and-highlights.md`
   (open: text marks) and
   `ideas/waiting-on-a-number/circular-genomes-and-origin-spanning-features.md`
   (open: the linear view's scroll through the origin, and formats other than
   GFF3).
4. **A tutorial: an organelle or plasmid map.** It needs a capture of the
   mitochondrion with labels on, at a view height that fits the circle.
5. **A ring label is drawn per strip line and culled within that line only.**
   Two lines can still touch where a long label curves near a short row, so
   capture a dense gene ring before relying on it.
