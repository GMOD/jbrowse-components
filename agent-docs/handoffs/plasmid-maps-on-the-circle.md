---
name: plasmid-maps-on-the-circle
description: Plasmid and organelle maps on the circular view (2026-10-14). Open are radial ring labels (a call for Colin), overlay canvases (waiting on Colin), and a way into the linear view across the origin. Read before touching ring labels or circular GFF3.
---

# Plasmid and organelle maps on the circular view

`test_data/human_mito` (16.5 kb, its D-loop written 16024..17145) is the
working example. Its gene track with `facet: { field: 'strand' }` and
`color: { field: 'type' }` draws a plasmid-style map with no other setting.

Landed, each with a test that fails on the code before it:

- Base-pair ticks on every circle: `CircularView/rulerTicks.ts`, drawn by
  `Ruler.tsx`, the tick band in `rulerLabels.ts` (`tickReachPx`).
- A circle of one region is titled in the middle (`middleTitle`), and closes
  its gap and ticks its first base only where the region is a whole sequence
  the assembly lists in `circularRefNames` (`closesRing`, from the view's
  `circleRegions`). jb2hubs writes it into the hosted configs: hg38 lists
  `chrM`, GenArk GRCh38 `NC_012920.1`, E. coli K-12 `NC_000913.3`.
- GFF3 features past a sequence's `##sequence-region` length cut at the origin:
  `plugins/gff3/src/originSpanning.ts`, used by both GFF3 adapters. The piece
  past the origin takes `originTailId` of the id (`@jbrowse/core/util/originCut`).
- The two pieces share a row: `packRef.ts` pairs them in `prepareRefPack`
  (`originPartners`) and places them through `GranularRectLayout`'s
  `addRectsAtOneTop`.
- Ring labels and highlights: `FloatingLabelHost` in display-kit, answered by
  the canvas display's and the mark display's `floatingLabels`; drawn by
  `rings/RingOverlay.tsx` through `rings/ringPolar.ts`, on screen and in the SVG
  export. `ringLabels` culls every label against every other through
  `cullOverlappingLabels`, unrolled to arc px and radius, wrapping at the
  strip's end, and labels a feature cut at the origin once, by its piece before
  it.
- A ring lays its display out in its band: `TrackHeightMixin`'s `hostHeight`,
  which `layoutRings` sets from bands sized by each display's
  `configuredHeight`. A fit-mode track then packs its rows and labels at the
  size they draw; a display whose height follows its content is still scaled.
- The fit ladder keeps a body carrying an overlay subfeature label at its full
  height (`fitLabeledBodyFloor`). The SARS-CoV-2 peptide names that ran over
  their neighbours sat on bodies the `thinned` rung had shortened, on the
  linear view as much as the ring.
- `forEachDisplayLabel` labels both copies of a contig listed twice, and a
  feature cut at the origin once where its pieces meet at the seam.
- The walkthrough is `website/docs/tutorials/organelle_map.md`, on
  `test_data/human_mito` (track `mito_genes`).

## Next

1. **Radial labels.** The ring-labels proposal decided "along the arc when every
   label on the ring fits its span, else radial, one orientation per ring", the
   ruler's `labelsRunAlongArcs` rule. Only along-the-arc is built. A ring stacks
   lines, so a radial label would cross the lines inside and outside it; ask
   Colin whether it still stands before building it.
2. **Overlay canvases never reach a ring**: the ring samples the strip's first
   `<canvas>`, so density bands, indel glyphs, alignments labels and MAF
   overlays are dropped. Waiting on Colin, with the other review items in
   memory under circular-view-review-thread.
3. **Opening the linear view across the origin.** Two regions do it by hand:
   `NC_012920.1:15,000-16,569 NC_012920.1:1-2,000` on `human_mito` shows the
   D-loop's pieces abutting in one row with true coordinates, labelled once.
   What is missing is a way in that does not need two regions typed: a
   locstring whose end wraps past the origin, or a menu item. Not decided.
