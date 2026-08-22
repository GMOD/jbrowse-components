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
cover in each genome, and fits that span to the track's width. The grey ribbons
carry the correspondence between lanes, so an insertion or a local expansion in
one genome simply takes more of its own lane.

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

<Figure caption="The grape gene track over the same locus as a multi-way lane stack, one lane per genome from a single MCScan blocks track. The lanes thin from peach down to tomato, and a ribbon chain stops at the first lane missing the ortholog." src="/img/multiway_synteny/lgv_track_lanes.png" />

Ordering the lanes by how much of the block each genome keeps is what lets the
ribbon chains run: a ribbon connects **adjacent** lanes only, so a near-empty
lane placed mid-stack would cut the chains of every denser lane below it.

## Zooming to genes

Zoomed in, each ribbon connects one gene to one ortholog, and a copy-number
difference shows up as a ribbon fanning from one gene into several. A sparse
lane holds its genome's scale: a lane never zooms in past the anchor's own
bp-per-pixel, so a lone ortholog draws at gene size with its lane's frame
centered on it.

<Figure caption="The same lanes cut to a few genes. Each ribbon links one gene to its ortholog in the lane below, the cacao-to-poplar ribbon fans where the copy number differs, and the lanes that kept a single gene here show it at the anchor's scale." src="/img/multiway_synteny/lgv_track_zoom.png" />

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

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config/mcscanblocksadapter)
