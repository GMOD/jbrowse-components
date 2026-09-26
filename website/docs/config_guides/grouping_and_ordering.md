---
title: Grouping and lane order
description:
  The one `domain` slot that orders a track's sections, lanes and rows, across
  feature, alignments, mark, synteny and multi-row displays
guide_category: Track types
---

Several unrelated-looking track settings — a gene track's biotype sections, an
alignments track's haplotype bands, a multi-sample variant track's karyotype
rows, a multiway synteny track's lanes, a multi-row display's partitions — read
the same two ideas: a field (or, for multiway synteny, the assembly itself)
decides what gets its own section, and a `domain` list decides which section
draws first. This page is the shared mechanism; each example below links to the
guide or tutorial it is worked through in full.

## `field` and `domain`

Most of these displays take a `facet` object: `{ field, domain }`. `field` is a
feature attribute, a dotted path into a structured one (`INFO.SVTYPE`), or a
`jexl:` expression — whatever value it returns gets its own section. `domain` is
a list of values: the ones it names stack first, in that order, and every other
value found in the data follows, sorted. A value in `domain` that the data never
produces is simply never drawn — `domain` orders sections, it does not create
them, so naming one ahead of time costs nothing and refetches nothing when it
later appears.

A short form exists for the common case of no ordering: `"facet": "tags.HP"` is
`"facet": { "field": "tags.HP", "domain": [] }`.

## Feature tracks

NCBI RefSeq genes on hg38, grouped and colored by `gene_biotype`, with the
protein-coding section pinned to the top and each biotype given a distinct color
from the same `domain`:

```json
{
  "facet": {
    "field": "gene_biotype",
    "domain": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
  },
  "color": {
    "field": "gene_biotype",
    "domain": ["protein_coding", "snoRNA", "lncRNA", "pseudogene"]
  }
}
```

<Video src="/media/ui/gene_track_channel_spec.mp4" caption="NCBI RefSeq genes on hg38: Edit as JSON from the Group by dialog, the spec above pasted in, and the sections stacked in the facet's domain order, each biotype colored by its position in the color's domain." />

[The gene track guide's Grouping features into sections section](/docs/user_guides/gene_track#grouping-features-into-sections)
has the full mechanism — the Group by/Color by dialogs, the Sections menu, and
what **Edit as JSON...** accepts.

## Alignments tracks

The alignments displays take `facet` the same way, plus a handful of read
dimensions no attribute expresses — `strand`, `firstOfPairStrand`,
`pairOrientation`, `splitRead`, `mapq`. The same idea over a `LinearMarkDisplay`
faceting a BAM by its `HP` haplotype tag:

<Figure src="/img/mark_display/facet.png" caption="HG002 ONT reads faceted by their HP tag: each haplotype's reads packed into a separate band under the chip that names it, and the untagged reads in a third."/>

[The cookbook's alignments recipe](/docs/cookbook#alignments-tracks) has a
worked `LinearAlignmentsDisplay` config; the reordering rule is the same
`domain`.

## Variant tracks

`LinearMultiSampleVariantDisplay` takes the same `facet` object to band rows by
a metadata column instead of VCF file order. Bands are what makes two
biologically meaningful examples readable rather than a wall of samples in
whatever order the VCF lists them:

```json
"facet": { "field": "karyotype", "domain": ["Standard", "In(2L)t"] }
```

<Figure src="/img/popgen/in2lt_inversion.png" caption="Top: the six dm6 arms with the In(2L)t extent over Fst between the two arrangements; the block on 2L stands against low background elsewhere. Below, a second view of chr2L adds one row per DGRP line, genotyped for the inversion and grouped by karyotype. The carrier block spans breakpoint to breakpoint; the Fst plateau runs past both." links="Six arms=popgen/fst_in2lt_2L"/>

```json
"facet": { "field": "karyotype", "domain": ["2L+a/2L+a", "2La/2L+a", "2La/2La"] }
```

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings throughout. Top: the published extents of 2La and of Vgsc, the two loci the blocks below sit on. r² fills the 2La extent in the Cameroon panel, which segregates both arrangements, and is empty over that span in Gabon, which is near-fixed for the standard arrangement."/>

The domain in each case is a genetics decision, not an alphabetical one: dosage
order in the mosquito figure, standard-before-carrier in the fly figure, both
read straight off the figure's caption.
[Population genomics](/docs/tutorials/population_genomics#the-inversion-genome-wide-and-per-line)
and
[LD in mosquitoes](/docs/tutorials/ld_mosquitoes#the-block-on-the-karyotype-lanes)
work through both.

## The mark display

`LinearMarkDisplay` takes the same `facet` object, and separately, a `row`
channel that packs features within a section (a BAM's own pileup, or any mark
whose `transform` runs a `pileup` step). Faceting and row-packing are
independent — a facet splits into sections first, and each mark packs its own
rows inside each section:

<Figure src="/img/mark_display/facet.png" caption="HG002 ONT reads faceted by their HP tag: each haplotype's reads packed into a separate band under the chip that names it, and the untagged reads in a third."/>

[The mark display guide's Facets section](/docs/config_guides/mark_display#facets)
has the full mechanism, including how the track menu's **Sections** list writes
a drag back into `domain`.

## Multiway synteny

`MultiWaySyntenyDisplay` draws one lane per assembly rather than one section per
field value, so there is no `facet` — `domain` sits directly on the display and
lists assembly names. It composes with `ribbonColor`, which paints each ribbon
by a field of its own — here, the relative strand between the two lanes a ribbon
joins:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_cacao_blocks",
  "name": "Grape vs peach, cacao, arabidopsis, poplar, tomato, citrus (MCScan blocks)",
  "assemblyNames": [
    "grape",
    "peach",
    "cacao",
    "poplar",
    "citrus",
    "arabidopsis",
    "tomato"
  ],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "grape_peach_cacao.blocks",
    "blockAssemblies": [
      "grape",
      "peach",
      "cacao",
      "poplar",
      "citrus",
      "arabidopsis",
      "tomato"
    ],
    "bedLocations": [
      "grape.bed",
      "peach.bed",
      "cacao.bed",
      "poplar.bed",
      "citrus.bed",
      "arabidopsis.bed",
      "tomato.bed"
    ]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "grape_peach_cacao_blocks-MultiWaySyntenyDisplay",
      "domain": ["peach", "cacao", "poplar", "citrus", "arabidopsis", "tomato"],
      "ribbonColor": { "field": "strand" }
    }
  ]
}
```

<Figure src="/img/multiway_synteny/lgv_track_lanes_colored.png" caption="The same grape locus over seven genomes, lanes pinned by retention, ribbons colored by relative strand: red where a lane's orientation matches the one above it, blue where it is inverted." />

Unlisted assemblies still get a lane — they stack below the named ones,
densest-first, so a ribbon chain through them is cut as late as possible.
[The synteny track guide](/docs/config_guides/synteny_track#three-or-more-genomes)
covers the adapter side, and
[the grape/peach/cacao tutorial](/docs/tutorials/multiway_synteny_grape_peach_cacao#ordering-the-lanes)
works through picking the lane order itself.

## Row-partitioned tracks

`LinearMultiRowFeatureDisplay` fixes one row per value rather than a foldable
section — no chip, no hide, no overflow merge — through `rows` instead of
`facet`, with the same `domain`. Nine ENCODE cell types, pinned to ENCODE's own
tiers rather than alphabetical order:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "broad_chromhmm_multirow_hg19",
  "name": "ChromHMM chromatin state (Broad ENCODE, 9 cell types)",
  "assemblyNames": ["hg19"],
  "category": ["ENCODE", "Chromatin state"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "wgEncodeBroadHmm.multirow.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "rows": {
        "field": "cellType",
        "domain": [
          "GM12878",
          "H1-hESC",
          "K562",
          "HepG2",
          "HUVEC",
          "HMEC",
          "HSMM",
          "NHEK",
          "NHLF"
        ]
      },
      "height": 200
    }
  ]
}
```

The same mechanism at a larger scale — a `rows.domain` of six names, with
`rows.kept` narrowing a 127-epigenome track to the three tissues a figure is
actually about, in the order the comparison reads:

<Figure src="/img/chromhmm_hoxa_fibroblasts.png" caption="Lung fibroblasts, foreskin fibroblasts and ES cells over HOXA. Lung fibroblasts keep HOXA1-A7 (red box) active and HOXA9-A13 (blue box) Polycomb-repressed, foreskin fibroblasts the reverse, and ES cells hold the whole cluster repressed."/>

[The ChromHMM tutorial](/docs/tutorials/chromhmm#the-legend-filtering-and-row-order)
has both tracks in full, plus what an unset `rows.domain` does instead:
**Cluster rows by similarity...** derives a row order from the data itself.

## Reordering at runtime

Every one of these displays writes a drag-to-reorder back into the same `domain`
slot it read the curated order from — the gene track and mark display's
**Sections** list, the alignments track menu's group-by sections, multiway
synteny's **Lanes** menu and lane-header drag, and the multi-row display's row
drag, which writes `rows.domain`. A session saved after reordering carries the
new order in `config.json` terms, not as separate runtime-only state.

## See also

- [](/docs/user_guides/gene_track)
- [](/docs/config_guides/mark_display)
- [](/docs/config_guides/alignments_track)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/linearmultisamplevariantdisplay)
- [](/docs/config/linearmultirowfeaturedisplay)
- [](/docs/config/multiwaysyntenydisplay)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/pangenome_hprc_part3)
- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/population_genomics)
- [](/docs/tutorials/ld_mosquitoes)
