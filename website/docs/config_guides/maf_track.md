---
title: Multiple alignment (MAF) track configuration
description:
  Multiple alignment tracks using the MafTabixAdapter, BigMafAdapter, and
  BgzipTaffyAdapter
guide_category: Track types
---

A MAF track shows a multiple alignment of several species against a reference
genome: one row per aligned species, with a coverage summary on top. JBrowse
reads three formats, all configured as a `MafTrack` with a `LinearMafDisplay`.

<Figure src="/img/maf_track.png" caption="The UCSC ce11 26-way multiz alignment (C. elegans and related nematodes): the coverage band on top, then one row per species ordered by the guide tree in the left sidebar, with positions where a species differs from the reference drawn as colored marks."/>

## Adapters

| Format         | Adapter                                             |
| -------------- | --------------------------------------------------- |
| BigMaf         | [BigMafAdapter](/docs/config/bigmafadapter)         |
| MAF (tabix)    | [MafTabixAdapter](/docs/config/maftabixadapter)     |
| TAF (bgzipped) | [BgzipTaffyAdapter](/docs/config/bgziptaffyadapter) |

Provide the aligned species either as a `samples` array (in track order) or via
an `nhLocation` Newick tree, which both supplies the species and orders/labels
the rows as a dendrogram.

Example using the tabix-indexed BED form (the UCSC ce11 26-way, ordered by its
phylogenetic tree):

```json
{
  "type": "MafTrack",
  "trackId": "ce11.26way",
  "name": "UCSC 26-way multiple alignment",
  "assemblyNames": ["ce11"],
  "adapter": {
    "type": "MafTabixAdapter",
    "bedGzLocation": {
      "uri": "https://jbrowse.org/demos/ce/ce11.26way.bed.gz"
    },
    "nhLocation": {
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/ce11/multiz26way/ce11.26way.nh"
    },
    "index": {
      "indexType": "TBI",
      "location": {
        "uri": "https://jbrowse.org/demos/ce/ce11.26way.bed.gz.tbi"
      }
    }
  }
}
```

The BigMaf form swaps the adapter for a single `bigBedLocation`, and may also
carry a `summaryAdapter` (a UCSC `bigMafSummary`) used for cheap rendering when
zoomed far out.

## Conservation (percent identity) band

The conservation band plots per-reference-base **percent identity**: at each
position, the fraction of aligned species (excluding the reference) whose base
matches the reference. Zoomed out, each pixel shows the mean identity of the
bases beneath it — a sliding-window conservation profile that makes conserved
versus divergent regions stand out without having to read individual bases. It
is computed from the alignment itself, so it appears at the zoom levels where
the per-species rows are loaded. Toggle it from the track menu.

<Figure src="/img/maf_conservation.png" caption="Enabling the conservation band from the track menu (top), and the resulting percent-identity profile on the 26-way alignment drawn above the rows on a 0–100% scale (bottom) — high over the conserved exon, dropping off in the divergent flanks."/>

This is a true identity metric and is distinct from the score shaded into the
zoomed-out summary bars, which comes from the UCSC `bigMafSummary` — a
normalized alignment score rather than a percent identity.

## Per-row identity overlay

Where the conservation band summarizes all species into one profile, the per-row
identity overlay breaks the signal out **per species**, drawn over each row so
you can see _which_ genomes diverge in a region — comparable to the UCSC multiz
per-species pairwise display. It is computed from the alignment (no extra files)
and set from the track menu, with two styles:

- **Heatmap** shades each row band by its local identity on a red→grey→blue ramp
  (red = divergent, blue = conserved).
- **X-Y plot** draws a per-species identity wiggle: a bar per pixel whose height
  is that position's identity to the reference, like one conservation band per
  row.
