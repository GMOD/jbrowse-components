---
name: variant-display-links-band
description: The merged variant display could get a `links` band drawing SVs as arcs through the shared `link` mark. Captured on 2026-11-09, arcs earned their place only on breakends with both ends in view; the call is whether to build it after v5.
---

# A links band on the variant display

> Moved from the v5.0.0 release list on 2026-11-09: declining it keeps today's
> picture, since a `LinearMarkDisplay` link-mark track over the same VCF still
> draws the arcs (the cancer SV tutorial's K562 tracks).

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

## What the 2026-11-09 captures showed

Stand-ins, not the band: today's link-mark tracks over the same files under
the records band, arcs colored by `svType` (the records band's preset).

- **BCR-ABL1 with both ends in view** (chr22 + chr9, K562 STAR-Fusion and 10x):
  the arc is the one mark that shows the two ends joined, and the records above
  keep the IDs and coordinates. The best case for the band.
- **Mates on another chromosome** (K562 at chr9:130.69-131.32 Mb): each arc is a
  short hook at the band's floor, and the record's label already names the mate.
- **Overlapping SVs at RHD** (1000 Genomes ensemble calls): the arcs repeat the
  bars, cross rather than nest, take more height, and lose what the bars show:
  `<INS>` draws no arc (the `mate` step drops it) and a deletion spanning the
  whole view draws nothing. Arcs replacing the bars is out.
- STAR-Fusion rows carry no `svType`, so their arcs are no-value grey beside
  gold records.

If it is built, the shape the captures support is an additional band, on by
default only when the file has breakends.
