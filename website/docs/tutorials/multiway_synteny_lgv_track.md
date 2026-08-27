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

- nothing to install: every session below opens from a hosted demo config, and
  each figure links the session it was captured in
- a synteny track that pairs the anchor genome with each of the others, which
  every demo config below already carries.
  [Synteny from an ortholog table](/docs/tutorials/multiway_synteny_grape_peach_cacao)
  builds the grape one from scratch

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

## One track, one lane per genome

The display answers what one locus looks like across all N genomes of a table,
inside a single ordinary track:

- **One lane per genome**, sitting under the reference genome's own gene and
  alignment tracks and panning with them.
- **Each lane in its genome's own coordinates.** The display spans the orthologs
  falling in the visible window, per genome, and fits that span to the track's
  width, so a local expansion takes more of its own lane.
- **One grey ribbon per ortholog group, between adjacent lanes only.** A chain
  runs down the stack for as long as the genomes that kept the gene are
  adjacent.

The other tool for the same table is a
[stacked linear synteny view](/docs/tutorials/multiway_synteny_grape_peach_cacao),
a full row per genome with its own scale bar and tracks;
[launching one](#from-lanes-to-a-full-stack) from these lanes is the last step
here.

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

Every lane has its own scale, so every lane says what that scale is:

- **On the left**, where the lane starts, and `[rev]` where its gene order runs
  against the anchor's.
- **On the right**, the lane's span, and the multiple of the anchor's span where
  that is not one. A span snaps to a short ladder of anchor-span multiples, so a
  pan that leaves a lane on its rung leaves the lane's content where it was.
- **The anchor lane carries the same header**, so the stack states the scale
  everything else is read against.
- **Ticks, at one interval named in the anchor's header.** Two lanes whose ticks
  fall at the same spacing are at the same bp-per-pixel; crowded ticks mean that
  lane is zoomed out.
- **The view's own gridlines stop at the anchor lane**, the only lane they are
  true for.

What fills the lane depends on the session:

- With a gene track for that assembly, the lane draws real gene models: the
  display fetches the first GFF3 feature track declared for that assembly alone
  over the lane's window, so exons and introns come from the annotation the
  ortholog table was built from.
- Without one, the lane outlines the table's own gene spans as boxes and says
  `no annotation` in its header. A placement box and a gene model are never the
  same ink, so one box filling a lane cannot be misread as one enormous gene.

## Ordering the lanes

- `rowOrder` pins the lanes it names to the top, in its order.
- The rest follow densest-first, counted over the whole fetched table rather
  than the viewport, so the order holds still across a pan.
- Densest-first is what keeps the chains long, since a near-empty lane placed
  mid-stack cuts the chains of every denser lane below it. Most stacks need no
  `rowOrder` at all, and the one above only pins an order a reader of this locus
  already expects.

## Zooming to genes

Cut the window to a few genes and the same lanes read per gene:

- Each ribbon connects one gene to one ortholog, and a copy-number difference
  fans one gene into several.
- A sparse lane holds its genome's scale: the shortest rung on the ladder is the
  anchor's own span, so a lone ortholog draws at gene size, centered in its
  lane.
- Gene models draw the way the gene track above them does, coding intervals full
  height, untranslated ends thinner in the contrasting blue, introns carrying
  direction chevrons.
- Hovering a ribbon highlights and names its ortholog group down every lane that
  kept the gene; clicking a glyph opens the feature detail panel for the group,
  on any lane.
- Zooming back out re-fits each lane's own frame to whatever orthologs the
  anchor's window brings in, so the re-layout is per genome rather than one
  re-scale repeated down the stack.

<Figure caption="The same lanes cut to a few genes, close enough to read exon structure in the annotated lanes. Each ribbon links one gene to its ortholog in the lane below, and the lanes that kept a single gene here show it at the anchor's scale." src="/img/multiway_synteny/lgv_track_zoom.png" />

<Video src="/media/synteny/multiway_zoom_out.mp4" caption="The grape lanes from gene scale back out to the block: a hovered ribbon reads one ortholog group down the stack, and each zoom-out re-fits every lane's own frame to the anchor's widening window." />

## From lanes to a full stack

A lane you want to drive around independently is the stacked view's job, and the
track menu carries the handoff:

- Choose **Launch stacked synteny view (visible region)** from the track menu.
- The dialog that opens is the one the
  [rubberband route](/docs/tutorials/multiway_synteny_grape_peach_cacao#restacking-around-a-locus)
  reaches, cut from this track's dataset over the visible window.
- Every genome aligning there is offered a full row of its own, ordered with the
  dialog's arrows.

The five-grass OrthoFinder table behind
[Synteny from OrthoFinder orthogroups](/docs/tutorials/orthofinder_synteny#grasses)
serves both halves:

- As lanes, a rice window reads across sorghum, brachypodium, setaria and maize
  under rice's own genes, the maize lane on the better-populated of the two
  copies its whole-genome duplication left.
- Launched as a stack, every grass gets a row to drive, and pointing the maize
  row at both of its windows is how that tutorial's stacked figure reads the
  duplication itself.

<Figure caption="A rice window over sorghum, brachypodium, setaria and maize lanes from one OrthoFinder orthogroups track, each lane carrying that grass's own gene models. The block is syntenic in all four, and the maize lane shows the better-kept of maize's two duplicated copies." src="/img/multiway_synteny/grasses_rice_lanes.png" />

<Video src="/media/synteny/multiway_launch_stack.mp4" caption="The handoff from the grasses lane track: the track menu's launch entry, the dialog printing where each grass's row would open, one row whose span comes back out of scale unticked, and Replace current view swapping the lane view for the stack." />

## What else the lanes take

The display draws whatever pairs the track serves for the visible window, so any
adapter whose features carry a `mate` per other assembly works. It keys an
ortholog group by gene name, falling back to the adapter's `syntenyId` where a
source carries no names.

### A pangenome's own annotations

The table needs no ortholog pipeline when the genomes share an annotation:

- HPRC release 2 annotates every haplotype assembly with CAT, which projects the
  GENCODE gene set onto each assembly's own contigs under the same gene names,
  so joining the annotations by gene name produces the blocks table directly.
- [`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh),
  behind the [HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc)'s
  CFH-cluster figures, genotypes the CFHR3/CFHR1 deletion over all 464
  haplotypes, slices the CAT annotation of each haplotype it keeps, and writes
  one gene BED per assembly plus the join:

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# one plain BED per genome, from the gene rows of its own annotation
gzip -dc hprc_cfhr_HG00099.1.genes.gff3.gz \
  | awk -F'\t' -v OFS='\t' '$3=="gene" {
      match($9, /Name=[^;]*/)
      print $1, $4 - 1, $5, substr($9, RSTART+5, RLENGTH-5), 0, $7
    }' > hprc_cfhr_HG00099.1.bed
```

The join is one row per GRCh38 gene in the window, one column per genome, `.`
where an annotation has no copy. The panel below is 4 haplotypes homozygous
reference at the site over 4 homozygous for the deletion, and every carrier's
own CAT annotation is missing both genes, so the _CFHR3_ and _CFHR1_ chains stop
at the first carrier lane.

<Figure caption="The complement factor H cluster on chr1: hg38 genes over one multi-way track with a lane per HPRC haplotype, the ones homozygous reference at the CFHR3/CFHR1 site above the ones homozygous for the deletion, each carrying its own CAT gene models on its own contig. The CFHR3 and CFHR1 chains stop where the carriers begin, and every flanking gene's chain runs the whole way down." src="/img/multiway_synteny/hprc_cfhr_lanes.png" />

### An all-vs-all alignment

An alignment file names no genes, and the display reads that as a different kind
of source:

- Each record is its own ribbon.
- The track additionally fetches each **adjacent** lane pair's own records out
  of the same file, so the gutters between strain lanes carry the direct
  alignments the file holds for that pair.
- A lane's local frame is fitted robustly, so the stray short alignments a
  bacterial genome's repeats produce do not stretch it.

Pairing the lanes with a quantitative signal on the same axis is what turns them
into an explanation. The pggb graph-depth wiggle from the
[E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli) sits above them
here: the depth step at the K-12 paa operon says how many genomes carry the
island, and the lanes below say which ones.

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

The lanes hold up across species too divergent for whole-genome alignment. The
five-vertebrate OrthoFinder table behind
[Synteny from OrthoFinder orthogroups](/docs/tutorials/orthofinder_synteny)
draws the human HOXD cluster with a lane per genome: the block is syntenic in
all five, and each lane's header names the chromosome carrying it, its span and
`[rev]` where it is inverted.

<Figure caption="The human HOXD cluster over chicken, frog, gar and zebrafish lanes from one OrthoFinder orthogroups track. The cluster's block stays syntenic in every lane, each lane names its own chromosome and orientation, and the ribbon chains thin outside it where the orthogroups scatter." src="/img/multiway_synteny/vertebrate_hox_lanes.png" />

Two more orthogroup sets read as lanes on the same page as their stacked views:

- [five Drosophila genomes](/docs/tutorials/orthofinder_synteny#one-locus-one-lane-per-fly),
  where the block survives out to _D. virilis_ and its orientation does not.
- [five nightshade genomes](/docs/tutorials/orthofinder_synteny#one-locus-five-lanes-five-scales),
  where the same two dozen genes need three times the DNA in pepper as in tomato
  and each lane's header says so.

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config/mcscanblocksadapter)
