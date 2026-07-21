---
title: MAF track
description:
  Multiple alignment tracks using the MafTabixAdapter, BigMafAdapter, and
  BgzipTaffyAdapter
guide_category: Track types
---

A MAF track shows a multiple alignment of several species against a reference
genome: one row per aligned species, with a coverage summary on top. JBrowse
reads three formats, all configured as a `MafTrack` with a `LinearMafDisplay`.
This page covers the data formats and configuration; for what the track looks
like and does once loaded, see the
[MAF track user guide](/docs/user_guides/maf_track).

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
carry the two optional sub-adapters below.

## Sub-adapters: summary and CDS frames

Two optional sub-adapters hang off the MAF **adapter**, alongside the main
location:

- **`summaryAdapter`** — a UCSC `bigMafSummary` (a `BigBedAdapter` over
  `bigMafSummary.bb`) used for cheap rendering when zoomed far out. Its bars are
  shaded by the summary's normalized alignment score, which is a different
  metric from the per-base percent identity the conservation band computes from
  the alignment itself (that needs no file).
- **`annotationAdapter`** — a UCSC `mafFrames` file (a `BigBedAdapter` over
  `multiz<N>wayFrames.bb`) carrying each gene's CDS reading frame projected
  through the alignment, one record per (species, region), keyed by `src`
  species. It enables the **Show CDS frames** overlay and the **Codon view**
  (amino-acid changes) in the track menu, both off by default. When the file
  carries a record for the reference `src`, the reference row shows its own gene
  structure too.

## Display options

The conservation band, per-row identity (heatmap / X-Y plot), color by source
chromosome, and inversion (strand-flip) overlays are all derived from the
alignment with no extra configuration — toggle them from the track menu. The
[user guide](/docs/user_guides/maf_track) covers what each one shows.

## A larger example: the human 470-way

These features scale to genome-scale alignments. The UCSC hg38 **470-way
multiz** (the Zoonomia mammals and more) is a `BigMafAdapter` over
`multiz470way.bigMaf` with its `multiz470waySummary.bb` (zoom-out) and
`multiz470wayFrames.bb` (CDS frames / codon view), the same three pieces as the
smaller examples above, just pointed at the UCSC downloads. Because the
reference is a chromosome-level assembly, the rows read far cleaner than a
fragmented scaffold-level alignment.

```json
{
  "type": "MafTrack",
  "trackId": "multiz470way",
  "name": "Multiz 470-way",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BigMafAdapter",
    "bigBedLocation": {
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470way.bigMaf"
    },
    "summaryAdapter": {
      "type": "BigBedAdapter",
      "bigBedLocation": {
        "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470waySummary.bb"
      }
    },
    "annotationAdapter": {
      "type": "BigBedAdapter",
      "bigBedLocation": {
        "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470wayFrames.bb"
      }
    }
  }
}
```

A subtree filter (from the track menu) narrows the hundreds of species to a
focused set for detailed reading; see the
[user guide](/docs/user_guides/maf_track) for how the large alignment renders.

## See also

- [MAF track](/docs/user_guides/maf_track)
- [Synteny track config](/docs/config_guides/synteny_track)
- [Supported file types](/docs/config_guides/file_types)
