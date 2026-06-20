---
title: Multiple alignment (MAF) track configuration
description: Multiple alignment tracks using the MafTabixAdapter, BigMafAdapter, and BgzipTaffyAdapter
guide_category: Track types
---

A MAF track shows a multiple alignment of several species against a reference
genome: one row per aligned species, with a coverage summary on top. JBrowse
reads three formats, all configured as a `MafTrack` with a `LinearMafDisplay`.

<Figure src="/img/maf_track.png" caption="A MAF track: the coverage band on top, then one row per species (ordered by the guide tree shown in the left sidebar), with positions where a species differs from the reference drawn as colored marks."/>

## Adapters

| Format         | Adapter                                                 |
| -------------- | ------------------------------------------------------- |
| BigMaf         | [BigMafAdapter](/docs/config/bigmafadapter)             |
| MAF (tabix)    | [MafTabixAdapter](/docs/config/maftabixadapter)         |
| TAF (bgzipped) | [BgzipTaffyAdapter](/docs/config/bgziptaffyadapter)     |

The `samples` array lists the aligned species in track order, and an optional
`nhLocation` supplies a Newick guide tree that orders and labels the rows.

Example using the tabix-indexed BED form:

```json
{
  "type": "MafTrack",
  "trackId": "volvox_maf",
  "name": "MAF",
  "assemblyNames": ["volvox"],
  "adapter": {
    "type": "MafTabixAdapter",
    "samples": ["volvox", "simvolvox", "minivolvox", "microvolvox"],
    "bedGzLocation": { "uri": "volvox.maf.bed.gz" },
    "nhLocation": { "uri": "volvox.maf.nh" },
    "index": {
      "indexType": "TBI",
      "location": { "uri": "volvox.maf.bed.gz.tbi" }
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

<Figure src="/img/maf_conservation.png" caption="Enabling the conservation band from the track menu (top), and the resulting percent-identity profile drawn above the alignment rows on a 0–100% scale (bottom)."/>

This is a true identity metric and is distinct from the score shaded into the
zoomed-out summary bars, which comes from the UCSC `bigMafSummary` — a
normalized alignment score rather than a percent identity.
