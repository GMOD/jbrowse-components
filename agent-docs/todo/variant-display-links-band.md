---
name: variant-display-links-band
description: The merged variant display gets a `links` band drawing SVs as arcs through the shared `link` mark, as alignments' `readConnections` band does. A breakend's mate becomes an arc instead of a point and a label, and overlapping SVs could read as nested arcs instead of stacked bars. After the merge (handoffs/variant-display-merge.md).
metadata:
  area: variants
  category: visual-call
  order: 2
  first_move: "draw the cancer SV tutorial's K562 StarFusion and 10x callsets as one VariantTrack with a `links` band beside today's `LinearMarkDisplay` link-mark tracks (specs/cancer_sv.ts ~944), and an overlapping-SV locus (1000 Genomes RHD) as arcs vs the records band's stacked bars"
---

# A links band on the variant display

Today SV arcs are the marks display's: a `LinearMarkDisplay` with a `link`
mark and a `mate` transform over a VCF (the cancer SV tutorial's K562 tracks).
Showing them beside a VCF's records means the duplicate-track workaround the
merge removes for records.

What arcs say that the records band cannot:

- **Breakends and translocations.** A BND record is a point in the records
  band, its mate elsewhere. An arc joins the two ends, or leaves the view
  toward the other sequence.
- **Overlapping SVs.** At RHD the records band stacks eight rows of nested
  deletions and duplications. Arcs nest instead of stacking, which may read
  more compactly.

The precedent is alignments' `readConnections` band (ADR-231): a band config
object whose arcs draw through render-core's `link` mark, the pipeline seam
(`mechanisms/feature-band-consumers.md`), no hosted display.

Open calls:

- **Additional band or alternative records drawing.** For breakends it adds
  information; for deletions and duplications an arc repeats the bar unless it
  replaces it.
- **Default.** On when the file has breakends, or whenever it has SVs.
- **Color.** The SV-type palette the records band uses, so a record and its
  arc share a color (reads-and-arcs-share-one-color-language).
