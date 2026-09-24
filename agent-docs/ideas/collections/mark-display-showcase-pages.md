---
name: mark-display-showcase-pages
description: Three pages that would show the mark display off — a Vega-Lite-style examples gallery, small multiples over a multi-BigWig with rows "source", and a flatten step over a per-transcript GFF attribute — parked after v5.0.0 because each is new content with figures and nothing in the release turns on it; plus the SV-sizes-as-points plot, declined because a point misrepresents a structural variant that spans kilobases
---

# Mark display showcase pages

Parked 2026-09-21 from a grammar-of-graphics review of the mark display. Only
two of about 75 tutorials use the display. Each page below is new content with
its own figures. The release ships without them.

**An examples gallery.** One dataset and a dozen short `marks` configs, each
with a figure and a live link, the way Vega-Lite's example gallery teaches.
People learning a grammar learn by copying a working example, and two long
tutorials don't give them one.

**Small multiples over a multi-BigWig.** A `MultiQuantitativeTrack`'s rows
carry `source`
([ADR-126](../../architecture-decision-records/adr-126-a-row-lane-on-bar-and-point.md)),
so `rows: "source"` on a mark display draws one row per file with the rows
sharing one y axis, like ggplot2's `facet_grid`. `scatac_pseudobulk`'s
per-cell-type BigWigs fit it. The multi-wiggle display already draws those
files as rows, so the page is worth writing only where the grammar adds
something that display can't, such as a binned or derived value per band.

**Flatten, shown once.** `flatten` turns a feature carrying a list into one
feature per element: a gene whose GFF attribute lists a value per transcript
becomes one feature per transcript, which a point mark can then plot. No
tutorial or figure uses it. `dtu`'s per-transcript statistic is the natural
case: flatten to transcripts, a point each, a threshold colour, and a reference
line at significance.

## Declined

**SV sizes as a point per SV.** The review proposed a point at log10
|`INFO.SVLEN`| per structural variant. A point stands at one position, and an
SV spans kilobases, so at any zoom where the SV is wider than a pixel the point
misstates where it lies. An SV size plot would draw each SV as a `span` over
its extent.
