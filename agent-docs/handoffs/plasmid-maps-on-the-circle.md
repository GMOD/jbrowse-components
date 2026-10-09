---
name: plasmid-maps-on-the-circle
description: Plasmid and organelle maps on the circular view, 2026-10-09. Landed base-pair ticks, the one-contig circle, GFF3 features cut at a circular origin and drawn as one labelled arc in one row, and ring labels (canvas labels and text marks, culled across lines) and highlights. Open are a tall display's labels shrinking away on a ring, overlay labels overrunning on inner lines, radial labels, overlay canvases, the linear view's scroll through the origin, other formats, and a tutorial. Read before touching ring labels or circular GFF3.
---

# Plasmid and organelle maps on the circular view

`test_data/human_mito` (16.5 kb, its D-loop written 16024..17145) is the
working example. Its gene track with `facet: { field: 'strand' }` and
`color: { field: 'type' }` draws a plasmid-style map with no other setting.

Landed, each with a test that fails on the code before it:

- Base-pair ticks on every circle: `CircularView/rulerTicks.ts`, drawn by
  `Ruler.tsx`, the tick band in `rulerLabels.ts` (`tickReachPx`).
- A circle of one region closes its gap (`gapUnitsAfter`), ticks its first
  base, and is titled in the middle (`middleTitle`). Any single region does,
  since core has no flag saying a contig is circular.
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

## Next

1. **A tall display's labels shrink away on a ring.** `layoutRings` scales each
   display's whole `height` into its band, so the SARS-CoV-2 gene track
   (`test_data/sars-cov2`, height 500) lands on a ~185 px band at a third of
   its size and every label falls under `MIN_RING_LABEL_PX`; at height 180 the
   same ring is labelled throughout. Laying the display out at the band's
   height, so fit mode re-solves its rows and labels there, would fix it at the
   source, but it needs a ring-only height that is not the persisted one.
2. **An overlay subfeature label overruns its peptide on an inner line.** The
   strip placed it to fit at `stripRadiusPx`; an inner radius gives it more
   turn, so on SARS-CoV-2 `nsp8 (ORF1ab polyprotein)` runs over its neighbours.
   The cull only compares labels with labels.
3. **Radial labels.** The ring-labels proposal decided "along the arc when every
   label on the ring fits its span, else radial, one orientation per ring", the
   ruler's `labelsRunAlongArcs` rule. Only along-the-arc is built. Every label
   reads `offsetRadians` for its flip, so measure a rotation drag on a dense
   ring before adding more.
4. **Overlay canvases never reach a ring**: the ring samples the strip's first
   `<canvas>`, so density bands, indel glyphs, alignments labels and MAF
   overlays are dropped. Waiting on Colin, with the other review items in
   memory under circular-view-review-thread.
5. **The linear view cannot scroll through the origin.** Listing the contig
   twice in `displayedRegions` with zero inter-region padding gives the `2L`
   space and true coordinates for free, and the two pieces then abut at the
   seam. Try it by hand on a bacterial genome before building anything.
6. **Formats other than GFF3 are not cut.** A BED or bigBed record with its end
   past the contig length still draws into virtual space. Count first whether
   jb2hubs serves any origin-spanning features, or only `Is_circular` contigs.
7. **A tutorial: an organelle or plasmid map.** It needs a capture of the
   mitochondrion with labels on, at a track height that fits the band (item 1).
