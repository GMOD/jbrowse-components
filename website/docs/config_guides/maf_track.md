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

## Per-row identity

Where the conservation band summarizes all species into one profile, the per-row
identity rendering breaks the signal out **per species** so you can see _which_
genomes diverge in a region. Like the UCSC multiz per-species pairwise display,
it replaces the per-base coloring **once you zoom out past base level** — where
individual bases are no longer legible anyway — and the actual bases come back
when you zoom in. It is computed from the alignment (no extra files) and set
from the track menu, with two styles:

- **Heatmap** shades each row band by its local identity on a red→grey→blue ramp
  (red = divergent, blue = conserved).
- **X-Y plot** draws a per-species identity wiggle: a bar per pixel whose height
  is that position's identity to the reference, like one conservation band per
  row.

The zoom-driven swap is the default; uncheck **Auto-switch by zoom** in the same
menu to pin the identity plot on at every zoom level instead.

## Per-species CDS frames (gene structure)

A MAF display can overlay coding structure on every aligned species by reading a
UCSC `mafFrames` file — the CDS reading frame of a gene projected through the
alignment, one record per (species, region). Configure it as an
`annotationAdapter` on the `LinearMafDisplay` (a feature adapter, typically a
`BigBedAdapter` over `multiz<N>wayFrames.bb`). Each `mafFrames` row is keyed by
its `src` species and drawn as a thin strip at the bottom of that species' row,
colored by reading frame, so the gene's exon/CDS structure reads across the
whole alignment without hiding the per-base coloring. Toggle it from the track
menu (**Show CDS frames**), and hover any species row to read the gene name and
reading frame at that position.

<Figure src="/img/maf_cds_frames.png" caption="The ce11 26-way alignment with the per-species CDS frame overlay: each species row carries a thin reading-frame-colored strip marking the coding exons projected onto that species, so the gene structure reads vertically across the whole alignment. Frame colors are mirrored by strand (the three +-strand frames and three −-strand frames), matching JBrowse's CDS coloring elsewhere."/>

### Codon view (amino-acid changes)

With the same `annotationAdapter`, **Codon view (amino-acid changes)** in the
track menu switches the per-sample rows from per-base SNP coloring to a
per-**codon** view: every species is translated in the reference reading frame
(UCSC `wigMaf` "show codons"), and each codon cell is colored by how its amino
acid compares to the reference — **nonsynonymous** changes (the amino acid
changed) stand out, **synonymous** changes (a silent substitution) get a faint
tint, **stop** codons are flagged, and conserved codons stay clean. The amino
acid itself is drawn on each codon once you zoom in far enough to read it.
Unlike the per-base view, this answers "did the protein change here?" directly,
across every aligned species at once.

<Figure src="/img/maf_codon_translation.png" caption="Codon view on the ce11 26-way alignment: the per-sample rows show one cell per codon, colored by amino-acid change relative to the reference (nonsynonymous changes stand out, synonymous changes are faint, stops flagged, conserved codons clean), with the residue drawn on each codon. This reads the protein-level conservation across all species without the per-nucleotide noise of the SNP view."/>

Hovering a codon reads out the exact change: the species' codon and amino acid
alongside the reference's, plus the synonymous/nonsynonymous classification — so
a specific substitution is identifiable directly rather than inferred from the
cell color.

<Figure src="/img/maf_codon_tooltip.png" caption="The codon-view hover tooltip on the ce11 26-way alignment: over a codon cell it shows the species' codon and amino acid next to the reference's (here GAA → GCC, E → A) and labels the change nonsynonymous, alongside the alignment location and the CDS frame/gene the reading frame came from."/>

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
    }
  },
  "displays": [
    {
      "type": "LinearMafDisplay",
      "displayId": "multiz470way-LinearMafDisplay",
      "annotationAdapter": {
        "type": "BigBedAdapter",
        "bigBedLocation": {
          "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz470way/multiz470wayFrames.bb"
        }
      }
    }
  ]
}
```

The reference species' own gene structure appears on the reference (top) row
when the `mafFrames` file carries a record for the reference `src`, so this
doubles as a reference annotation overlay.

### Color by source chromosome

**Color by source chromosome** in the track menu replaces the per-base SNP
coloring with a structural view: each species' alignment blocks are filled by a
stable color derived from their source chromosome (the chromosome/scaffold the
aligned sequence comes from in that species' own genome). Because the color
depends only on the source chromosome, a species whose blocks across the window
come from more than one source chromosome **changes color along its row** — an
immediate flag for a translocation or rearrangement relative to the reference,
with no extra data to fetch (the source chromosome is already carried per
block). A compact legend maps each visible source chromosome to its color.

This needs no `annotationAdapter` and works on any MAF track; it is shown in the
detailed (per-base) view rather than the zoomed-out summary.

<Figure src="/img/maf_color_by_chromosome.png" caption="Color-by-source-chromosome mode on the ce11 26-way alignment: each species' blocks are colored by their source chromosome/scaffold. The reference (ce11) is a single color across the window, while several species' rows switch color where their aligned blocks come from different source scaffolds — surfacing rearrangements directly. The legend (top right) names each visible source chromosome."/>

### Inversions (strand flips)

**Show inversions (strand flips)** in the track menu overlays a diagonal hatch
on any block that aligns **inverted** relative to its own source chromosome's
consensus orientation. An aligned segment can map to the reference on either
strand; comparing each block to the consensus orientation of its scaffold
(rather than flagging every `−`-strand block) means an arbitrarily-oriented
scaffold isn't mistaken for an inversion — only a genuine intra-scaffold strand
flip is marked. It is an overlay, so it composes on top of the base, codon, or
per-row identity rendering without replacing them, and needs no extra files
(strand is already carried per block).

## See also

- [Synteny track config](/docs/config_guides/synteny_track) — pairwise alignment
  of two genomes (vs. MAF's multiple alignment against one reference)
- [Supported file types](/docs/config_guides/file_types) — preparing tabix and
  bgzip input
