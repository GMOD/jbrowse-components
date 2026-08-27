---
title: Multi-way synteny in one track
sidebar_label: Synteny (multi-way track)
description:
  Draw an N-genome ortholog table as lanes and ribbons in a single linear genome
  view track
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: hosted
---

**TL;DR:** we read one grape locus across seven plant genomes without leaving
grape's own view. Each genome gets a lane under the gene track, drawn in that
genome's own coordinates, and grey ribbons carry every ortholog from one lane
down to the next. The lane stack is one ordinary track display, a
`MultiWaySyntenyDisplay`, so it pans with the tracks above it.

## Prerequisites

- nothing to install to read along: every session below opens from a hosted demo
  config, and each figure links the session it was captured in
- **to build the same track on your own genomes**, an ortholog table with a
  column per genome (jcvi MCScan blocks, OrthoFinder orthogroups) or an
  all-vs-all PAF
- one BED per genome, placing the gene ids the table names
- every genome loaded as an assembly in the same session
- a GFF3 feature track per assembly, without which that genome's lane outlines
  the table's gene spans instead of drawing gene models
- [Synteny from an ortholog table](/docs/tutorials/multiway_synteny_grape_peach_cacao)
  builds the grape table this page opens, end to end

## Where the data comes from

Five hosted demo configs, each carrying an ortholog table or an alignment that
serves a mate per genome.

- grape, peach, cacao and four more plant genomes, from a jcvi MCScan `.blocks`
  table: https://jbrowse.org/demos/grape_peach_cacao/config.json
- five grasses, from an OrthoFinder run:
  https://jbrowse.org/demos/orthofinder_grasses/config.json
- five vertebrates, from the same pipeline:
  https://jbrowse.org/demos/orthofinder_vertebrates/config.json
- HPRC release 2 haplotypes, joined on their CAT gene names:
  https://jbrowse.org/demos/hprc/config.json
- five _E. coli_ strains, from an all-vs-all PAF:
  https://jbrowse.org/demos/ecoli_pangenome/config.json

## Opening the track

We'll start on the hosted grape/peach/cacao demo, whose one
`MCScanBlocksAdapter` track carries an ortholog column for seven plant genomes:

- Open a linear genome view on **grape** and navigate to `11:778,000-866,000`.
- Turn on the grape gene track, and the ortholog track **Grape vs peach, cacao,
  arabidopsis, poplar, tomato, citrus (MCScan blocks)**.
- In its track menu, choose **Display types → Multi-way synteny display**.

The same thing as a `defaultSession`, which the live link below opens directly:

```json session config=https://jbrowse.org/demos/grape_peach_cacao/config.json
{
  "defaultSession": {
    "name": "Grape multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "grape",
          "loc": "11:778,000-866,000",
          "tracks": [
            {
              "trackId": "grape_genes",
              "type": "LinearBasicDisplay",
              "showOnlyGenes": true,
              "displayMode": "compact"
            },
            {
              "trackId": "grape_peach_cacao_blocks",
              "type": "MultiWaySyntenyDisplay",
              "rowOrder": [
                "peach",
                "cacao",
                "poplar",
                "citrus",
                "arabidopsis",
                "tomato"
              ],
              "height": 340
            }
          ]
        }
      }
    ]
  }
}
```

<Figure caption="The grape gene track over the same locus as a multi-way lane stack, one lane per genome from a single MCScan blocks track. The peach and cacao lanes carry their own gene models from those genomes' gene tracks, the lanes without one carry the table's gene spans as boxes, and a ribbon chain stops at the first lane missing the ortholog." src="/img/multiway_synteny/lgv_track_lanes.png" />

## Reading a lane header

Each lane has its own scale, so each lane states it:

- **Left**: where the lane starts, with `[rev]` where its gene order runs
  against the anchor's.
- **Right**: the lane's span, and the multiple of the anchor's span where that
  is not one.
- **Ticks** fall at one interval, named in the anchor's header, so two lanes at
  the same spacing are at the same bp-per-pixel.
- **The view's own gridlines stop at the anchor lane**, the only lane they are
  true for.
- **A lane with no GFF3 track for its assembly** outlines the table's gene spans
  and says `no annotation`.

## Ordering the lanes

- `rowOrder` pins the lanes it names to the top; the rest follow densest-first
  over the whole fetched table, so the order holds still across a pan.
- That is what keeps the chains long, since a near-empty lane placed mid-stack
  cuts the chain of every denser lane below it.

## Zooming to genes

Cut the window to a few genes and each ribbon connects one gene to one ortholog:

- A lone ortholog draws at gene size, centered in its lane, since the shortest
  rung on the ladder of lane spans is the anchor's own.
- Hovering a ribbon names its ortholog group and highlights it down every lane
  that kept the gene; clicking a glyph opens the feature detail panel.

<Figure caption="The same lanes cut to a few genes, close enough to read exon structure in the annotated lanes. Each ribbon links one gene to its ortholog in the lane below, and the lanes that kept a single gene here show it at the anchor's scale." src="/img/multiway_synteny/lgv_track_zoom.png" />

<Video src="/media/synteny/multiway_zoom_out.mp4" caption="The grape lanes from gene scale back out to the block: a hovered ribbon reads one ortholog group down the stack, and each zoom-out re-fits every lane's own frame to the anchor's widening window." />

## What the lanes say

Three readings in the one picture:

- **Down a column**: which genomes kept the gene.
- **Along a chain**: one ortholog group through every genome that kept it.
- **Within a lane**: local gene order and spacing, so an expansion in one genome
  crowds its own lane.

## From lanes to a full stack

- **Launch stacked synteny view (visible region)** in the track menu opens the
  [multi-panel dialog](/docs/tutorials/multiway_synteny_grape_peach_cacao#restacking-around-a-locus),
  cut from this track's dataset over the visible window.
- Every genome aligning there is offered a full row of its own.

The five-grass OrthoFinder table behind
[Synteny from OrthoFinder orthogroups](/docs/tutorials/orthofinder_synteny#grasses)
reads both ways: as lanes under rice's own genes, and as a stack where every
grass gets a row to drive.

<Figure caption="A rice window over sorghum, brachypodium, setaria and maize lanes from one OrthoFinder orthogroups track, each lane carrying that grass's own gene models. The block is syntenic in all four, and the maize lane shows the better-kept of maize's two duplicated copies." src="/img/multiway_synteny/grasses_rice_lanes.png" />

<Video src="/media/synteny/multiway_launch_stack.mp4" caption="The handoff from the grasses lane track: the track menu's launch entry, the dialog printing where each grass's row would open, one row whose span comes back out of scale unticked, and Replace current view swapping the lane view for the stack." />

## The same track on other sources

The display draws whatever pairs the track serves for the visible window, so any
adapter whose features carry a `mate` per other assembly works. It keys an
ortholog group by gene name, falling back to the adapter's `syntenyId`.

### A pangenome's own annotations

HPRC release 2 annotates every haplotype assembly with CAT, which projects the
GENCODE gene set onto each assembly's own contigs under the same gene names, so
joining the annotations by name is the whole pipeline.
[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh)
does that for the CFHR3/CFHR1 deletion:

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# one plain BED per genome, from the gene rows of its own annotation
gzip -dc hprc_cfhr_HG00099.1.genes.gff3.gz \
  | awk -F'\t' -v OFS='\t' '$3=="gene" {
      match($9, /Name=[^;]*/)
      print $1, $4 - 1, $5, substr($9, RSTART+5, RLENGTH-5), 0, $7
    }' > hprc_cfhr_HG00099.1.bed
```

<Figure caption="The complement factor H cluster on chr1: hg38 genes over one multi-way track with a lane per HPRC haplotype, the ones homozygous reference at the CFHR3/CFHR1 site above the ones homozygous for the deletion, each carrying its own CAT gene models on its own contig. The CFHR3 and CFHR1 chains stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/multiway_synteny/hprc_cfhr_lanes.png" />

### An all-vs-all alignment

An alignment file names no genes, so each record is its own ribbon. The track
also fetches each **adjacent** pair's own records from the same file, so the
gutters carry the direct alignments the file holds for that pair.

```json session config=https://jbrowse.org/demos/ecoli_pangenome/config.json
{
  "defaultSession": {
    "name": "E. coli all-vs-all multi-way track",
    "views": [
      {
        "type": "LinearGenomeView",
        "init": {
          "assembly": "K12",
          "loc": "chr:1,443,000-1,466,000",
          "tracks": [
            { "trackId": "ecoli_pggb_depth", "height": 60 },
            {
              "trackId": "ecoli_ava",
              "type": "MultiWaySyntenyDisplay",
              "rowOrder": ["NCTC86", "CFT073", "Sakai", "IAI39"],
              "height": 340
            }
          ]
        }
      }
    ]
  }
}
```

<Figure caption="The paa operon island on K-12, read twice: the pangenome graph-depth wiggle steps down where fewer genomes carry the sequence, and the all-vs-all lanes below name them. K-12 and NCTC86 carry the island, and the white wedges in the ribbon bands are the strains whose alignment skips it." src="/img/multiway_synteny/ecoli_island_lanes.png" />

### Deep-time orthologs

The lanes hold up past the range whole-genome alignment reaches: the
five-vertebrate OrthoFinder table draws the human HOXD cluster with a lane per
genome.

<Figure caption="The human HOXD cluster over chicken, frog, gar and zebrafish lanes from one OrthoFinder orthogroups track. The cluster's block stays syntenic in every lane, each lane names its own chromosome and orientation, and the ribbon chains thin outside it where the orthogroups scatter." src="/img/multiway_synteny/vertebrate_hox_lanes.png" />

Two more orthogroup sets read as lanes beside their stacked views:

- [five Drosophila genomes](/docs/tutorials/orthofinder_synteny#one-locus-one-lane-per-fly),
  where the block survives out to _D. virilis_ and its orientation does not.
- [five nightshade genomes](/docs/tutorials/orthofinder_synteny#one-locus-five-lanes-five-scales),
  where the same genes need three times the DNA in pepper as in tomato.

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config/mcscanblocksadapter)
