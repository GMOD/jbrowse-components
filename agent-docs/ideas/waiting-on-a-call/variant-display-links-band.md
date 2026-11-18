---
name: variant-display-links-band
description: The merged variant display could get a `links` band drawing SVs as arcs through the shared `link` mark. Judged on 2026-11-18 as not worth a band; it reopens only if a breakend-only callset shows arcs carrying spans the records band cannot.
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

## The 2026-11-18 verdict: no band

A dedicated review weighed the captures against the band rules and found no
case that earns a band:

- **The winning case already has a route.** Both ends of BCR-ABL1 in view is a
  layout the reader assembles by hand; the record's "open breakpoint split
  view" row reaches the same join in one click, with reads as evidence.
- **No default is honest.** "On when the file has breakends" is known only from
  the records in view, so the band either appears and vanishes on pan or holds
  an empty strip taken from the genotype rows. Off by default is a toggle
  nobody finds.
- **The display's own users gain nothing.** Population callsets are
  DEL/DUP/INV/INS, where arcs repeat the bars (RHD). Cancer breakend files have
  one or two samples, so a second track costs no rows, and marks' default plot
  already draws `link` + `mate` for any mated file.

A hover-only arc (drawn to an in-view mate while its record is hovered) was
also declined: a view has to make sense as drawn.

What would reopen it:

- **A breakend-only callset** (GRIDSS, SvABA, Manta's intrachromosomal BNDs),
  which writes even a deletion as two points, captured with a link-mark
  stand-in in a single-chromosome window. If arcs there carry spans the
  records band's dots cannot, on a file with genotype rows worth keeping
  beside them (tumor/normal, a trio), the band has its case.
- **A request for arcs beside genotype rows** specifically.

If it is built, the smallest shape is `links: { show, height }` (ADR-231's
band object, the name ADR-232 reserved), resolving on only while a junction
has both feet in displayed regions, drawing one link per mated breakend pair
and nothing for DEL/DUP/INV/INS or a mate off view, colored by the records'
SV-type preset with mated records that carry no `svType` taking the breakend
class.
