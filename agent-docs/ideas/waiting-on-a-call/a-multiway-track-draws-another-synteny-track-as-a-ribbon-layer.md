---
name: a-multiway-track-draws-another-synteny-track-as-a-ribbon-layer
description: MultiWaySyntenyDisplay reads one synteny source, where a LinearSyntenyView level overlays several. A `ribbonLayers` entry would draw another track's ribbons into its lanes, for a source that states no blocks of its own but has a chained track beside it. Read before overlaying sources on the multiway display or chaining its ribbons.
---

# A multiway track draws another synteny track as a ribbon layer

Raised 2026-11-20 while reviewing copy lanes
([ADR-278](../../architecture-decision-records/adr-278-a-copy-of-the-window-draws-as-its-own-lane.md)):
zoomed out to 3 Mb, peach chrG7 against grape reads as a few solid bands
when drawn from MCScan's `.anchors.simple` (one record per collinear block),
and as hundreds of crossing hairlines from `.anchors` (one per gene pair).
Colin asked whether the display should overlay synteny tracks the way a
LinearSyntenyView level does.

MCScan no longer needs it: an `.anchors` pair states its block, and the display
draws each block under its gene pairs
([ADR-281](../../architecture-decision-records/adr-281-a-sources-blocks-draw-under-its-gene-pairs.md)).
What is left is a source that states no blocks and has a chained track beside
it, such as a PAF with a block file another tool wrote.

## Why a plain overlay does not fit

A LinearSyntenyView level holds a list of tracks (`tracks: [[a, b]]`), each
display painting its ribbons over the same gap, because the rows' frames
belong to the view. A MultiWaySyntenyDisplay decides its lanes per window
from its own source: the contig each lane shows, its flip and squeeze
(`laneDecision.ts`), the copy lanes and their floor (`copyLane.ts`). Two
sources stacked as two tracks give two lane stacks; two sources inside one
display would disagree about every one of those decisions.

## The shape

The display's own source keeps deciding the lanes; a layer only draws into
them, as `laneLayers` (`laneLayerConfigSchema.ts`) draws another track's data
through each lane's frame:

```js
{
  type: 'MultiWaySyntenyDisplay',
  ribbonLayers: [{ track: 'chained_blocks' }],
}
```

- A layer's ribbon draws where both its feet land in the lanes the source
  placed: its anchor foot on the anchor's axis, its mate foot inside the
  frame of the lane that genome or copy holds. Anything else is dropped; a
  layer never adds, removes or reorders a lane.
- Layers draw under the source's ribbons, at lower opacity, so gene pairs
  stay readable on top of their blocks.
- No zoom switch: the layer draws at every zoom. Drawing blocks only past a
  zoom threshold was declined on 2026-09-21 as flicker
  ([multiway-synteny-lgv-track](../collections/multiway-synteny-lgv-track.md),
  "Collinear runs as block ribbons").

## Calls to make

- **Hover.** A gene ribbon over its block: does the hover read the gene alone,
  or the gene with its block as a second line?
- **Legend.** Two sources need a key naming which ribbons came from which; the
  ribbon color legend holds one source today.
- **What a layer may be.** Any synteny track on the same genomes, or only one
  whose genomes are a subset of the source's? A layer naming a genome no lane
  shows draws nothing there.
- **Export.** Whether `multiwayTables` carries layer ribbons, so a figure
  rebuilt in R matches the view.

## What it does not cover

Sources with no chained file: an OrthoFinder gene table, or a whole-genome
alignment such as the hosted `Brapa_to_TAIR10.pif.gz`, whose three
*B. rapa* copies of Arabidopsis Chr5:3–7 Mb draw as hatching at 4 Mb. Those
need chaining, in the display ("Collinear runs as block ribbons" in the
collection) or in the file
([block-level-synteny-from-external-tools](../ready/block-level-synteny-from-external-tools.md)).
A layer is the cheaper first step where a tool already chained the blocks,
and its chaining is the tool's own.

## Evidence

Captures from the 2026-11-20 review, shot on ada from probe specs that were
never committed to main: the peach chrG7:17–20 Mb pair (`.anchors` against
`.anchors.simple`), the 12 Mb blocks shot (nine copy lanes, most holding one
small block, so copy lanes read best between about 0.5 and 3 Mb), and the
*Brassica* 4 Mb hatching.
