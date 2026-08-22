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

**TL;DR:** a multi-genome ortholog track in a plain linear genome view can draw
as a `MultiWaySyntenyDisplay`: one lane per genome, with ribbons connecting each
ortholog between adjacent lanes. The top lane is the view's own assembly at
genomic coordinates; every other lane is laid out in that genome's own local
frame, fitted to the viewport.

## One track, one lane per genome

A
[stacked linear synteny view](/docs/tutorials/multiway_synteny_grape_peach_cacao)
gives each genome a full row with its own scale bar and its own tracks, which is
the right tool for driving each genome around independently. This display
answers the question of what one locus looks like across all N genomes inside a
single ordinary track, so it sits directly under the reference genome's own gene
and alignment tracks and pans with them.

Each lane below the anchor is drawn in its genome's **own coordinates**: the
display looks up which orthologs fall in the visible window, takes the span they
cover in each genome, and fits that span to the track's width. Each lane's
header names the chromosome and coordinate range it is showing, with `[rev]` on
a lane whose gene order runs against the anchor's. The grey ribbons carry the
correspondence between lanes, so an insertion or a local expansion in one genome
simply takes more of its own lane.

A lane draws real gene models when the session has a gene track for that
assembly: the display finds the first GFF3 feature track declared for the lane's
assembly alone and fetches its genes over the lane's window, so exons and
introns come from the same annotation the ortholog table was built from. A lane
with no gene track draws the table's own gene spans as plain boxes.

This tutorial uses the hosted grape/peach/cacao demo, whose one
`MCScanBlocksAdapter` track carries an ortholog column for seven plant genomes;
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao)
builds that file from scratch.

## Opening it

Open a linear genome view on the anchor genome and turn on the ortholog track,
then pick the display from the track menu under **Display types**. The
declarative equivalent, as a `defaultSession`:

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

The track entry names the display type and its settings the same way any track
entry in a session spec does. `rowOrder` pins the lanes it names to the top, in
its order; lanes it does not name follow in the order the data brings them up.

<Figure caption="The grape gene track over the same locus as a multi-way lane stack, one lane per genome from a single MCScan blocks track. The peach and cacao lanes carry their own gene models from those genomes' gene tracks, the lanes without one carry the table's gene spans as boxes, and a ribbon chain stops at the first lane missing the ortholog." src="/img/multiway_synteny/lgv_track_lanes.png" />

Ordering the lanes by how much of the block each genome keeps is what lets the
ribbon chains run: a ribbon connects **adjacent** lanes only, so a near-empty
lane placed mid-stack would cut the chains of every denser lane below it.

## Zooming to genes

Zoomed in, each ribbon connects one gene to one ortholog, and a copy-number
difference shows up as a ribbon fanning from one gene into several. A sparse
lane holds its genome's scale: a lane never zooms in past the anchor's own
bp-per-pixel, so a lone ortholog draws at gene size with its lane's frame
centered on it.

<Figure caption="The same lanes cut to a few genes, close enough to read exon structure in the annotated lanes. Each ribbon links one gene to its ortholog in the lane below, and the lanes that kept a single gene here show it at the anchor's scale." src="/img/multiway_synteny/lgv_track_zoom.png" />

Clicking a glyph opens the feature detail panel for its ortholog group, on any
lane.

## What the lanes can say

Reading down a column answers presence per genome, the same reading the
[grouped `LGVSyntenyDisplay` lanes](/docs/tutorials/multiway_synteny_grape_peach_cacao#restacking-around-a-locus)
give, and each lane's own gene spacing makes local order and expansion within
the lane visible too. Reading along a ribbon chain follows one ortholog group
through every genome that kept it.

The display draws whatever pairs the track serves for the visible window, so it
works on any adapter whose features carry a `mate` per other assembly. An
ortholog group is keyed by gene name, with the adapter's `syntenyId` as the
fallback for sources that carry no names.

## The same shape on the human pangenome

The table does not need an ortholog pipeline when the genomes share an
annotation. HPRC release 2 annotates every haplotype assembly with CAT, which
projects the GENCODE gene set onto each assembly's own contigs under the same
gene names, so joining the annotations by gene name produces the blocks table
directly.
[`build_hprc_cfhr_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc_cfhr_synteny.sh),
the script behind the
[HPRC pangenome tutorial](/docs/tutorials/pangenome_hprc)'s CFH-cluster figures,
slices two haplotypes' CAT annotations to that window and then writes the gene
BED per assembly and the join:

<!-- from: scripts/build_hprc_cfhr_synteny.sh -->

```bash
# one plain BED per genome, from the gene rows of its own annotation
zcat hprc_cfhr_HG00099.1.genes.gff3.gz \
  | awk -F'\t' -v OFS='\t' '$3=="gene" {
      match($9, /Name=[^;]*/)
      print $1, $4 - 1, $5, substr($9, RSTART+5, RLENGTH-5), 0, $7
    }' > hprc_cfhr_HG00099.1.bed
```

One row per GRCh38 gene in the window, one column per genome, `.` where an
annotation has no copy. HG01109.1 carries the CFHR3/CFHR1 deletion, and its own
CAT annotation has neither gene, so the two ribbon chains reach the non-carrier
lane and stop there.

<Figure caption="The complement factor H cluster on chr1: hg38 genes over one multi-way track with a lane per HPRC haplotype, each carrying its own CAT gene models on its own contig. The CFHR3 and CFHR1 chains connect hg38 to the non-carrier haplotype and no further, and every flanking gene's chain runs through both." src="/img/multiway_synteny/hprc_cfhr_lanes.png" />

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config/mcscanblocksadapter)
