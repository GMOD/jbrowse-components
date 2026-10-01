---
name: lane-layers
description: "ADR-180's lane layers after the spike: template layers and described lanes as temporary assemblies are built and the Hubs plugin's assembly answer is released; left is a GC cost measurement before jb2hubs writes GC into every star, once the twobit index fix ships."
---

The spike is `laneLayers` on `MultiWaySyntenyDisplay`: a row of data per lane
from each genome's own track, drawn as bars through the lane's frame on one
shared scale ([ADR-180](../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md),
`laneLayers.ts`, `laneLayerConfigSchema.ts`).

## Next

Template layers and lanes the session lacks are built (`7700ccb6bb`): a
described lane is a temporary assembly, so its sequence reaches an adapter
only through renaming, and never through an RPC by hand
(`reference/MULTIWAY_SYNTENY_DISPLAY.md` §"Settled invariants",
§"Where things live"). Driven on hg38's hosted star at TP53: all nine lanes draw
their own genome's GC, and "Open in new view" hands a lane to its hub's
connection without losing it.

1. **Measure before jb2hubs writes GC into every star.** Cold at TP53, a
   chromosome-level lane reads 2.4-2.9 MB of 2bit, mostly its chromosome's
   soft-mask block list, against about 1 MB for a gc5Base bigWig. A
   scaffold-level lane read far more under `@gmod/twobit` 6.0.12, whose
   `getIndex` read `sequenceCount * (1 + 255 + offsetSize)` bytes: bisBis1's
   315k scaffolds cost 118 MB. twobit-js main `e908bff` sizes that read by
   typical names (a few MB for bisBis1); release it and take it with
   `pnpm update @gmod/twobit`, then measure bisBis1 again. Then the star builder
   (`ucsc2jbrowse/src/multiwayStarTrack.ts`) writes the layer and sizes each
   lane at 22 + 12 (gene names) + the band + 2; its 22 is already short by
   the gene-name row, and the gene-page link's pitch (34) grows by the band.

## Not now

Genes as `laneLayers[0]`: a union array blinds `jbrowse validate`
(`generateConfigManifest.ts`), every `laneLayers` consumer indexes by
position, and placement boxes borrow the gene colours. It pays once a second
glyph layer (another annotation, repeats, assembly gaps) is wanted.
