---
name: lane-layers
description: "ADR-180's lane layers after the spike: template layers and described lanes as temporary assemblies are built; left are releasing the Hubs plugin's assembly answer, a GC cost measurement (and a twobit index over-read) before jb2hubs writes GC into every star, and the hg38 star reading every child's index."
---

The spike is `laneLayers` on `MultiWaySyntenyDisplay`: a row of data per lane
from each genome's own track, drawn as bars through the lane's frame on one
shared scale ([ADR-180](../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md),
`laneLayers.ts`, `laneLayerConfigSchema.ts`).

## Next

Template layers and lanes the session lacks are built (`7700ccb6bb`): a
described lane is a temporary assembly, so its sequence reaches an adapter
only through renaming, and never through an RPC by hand
(`reference/MULTIWAY_SYNTENY_DISPLAY.md` §"Lanes the session lacks",
§"Lane layers"). Driven on hg38's hosted star at TP53: all nine lanes draw
their own genome's GC, and "Open in new view" hands a lane to its hub's
connection without losing it.

1. **Release the Hubs plugin's new answer.** `describeAssemblies.ts` answers
   `{ assembly, geneAdapter }`, `baseUri` stamped beside each `uri`
   (committed in jbrowse-plugin-hubs, unreleased). Core now reads only those
   two, so hub stars on a main build draw no mate genes until it ships; land
   and release together.
2. **Measure before jb2hubs writes GC into every star.** Cold at TP53, a
   chromosome-level lane reads 2.4-2.9 MB of 2bit, mostly its chromosome's
   soft-mask block list, against about 1 MB for a gc5Base bigWig. A
   scaffold-level lane reads far more: `@gmod/twobit` 6.0.12 `getIndex`
   reads `sequenceCount * (1 + 255 + offsetSize)` bytes, so bisBis1's 315k
   scaffolds cost 118 MB and dasNov3's 12.6 MB. That over-read hits every
   2bit read on such a genome, the reference sequence track's too; fix it in
   twobit-js first. Then the star builder
   (`ucsc2jbrowse/src/multiwayStarTrack.ts`) writes the layer and sizes each
   lane at 22 + 12 (gene names) + the band + 2; its 22 is already short by
   the gene-name row, and the gene-page link's pitch (34) grows by the band.
3. **The hg38 star reads every child's index.** On the default lanes at TP53
   it fetched 241 `.pif.gz.csi` files, 234 MB, with temporary assemblies
   off, where on 2026-09-24 it read the eight lanes it drew. Separate from
   lane layers, and larger than anything above.

## Not now

Genes as `laneLayers[0]`: a union array blinds `jbrowse validate`
(`generateConfigManifest.ts`), every `laneLayers` consumer indexes by
position, and placement boxes borrow the gene colours. It pays once a second
glyph layer (another annotation, repeats, assembly gaps) is wanted.
