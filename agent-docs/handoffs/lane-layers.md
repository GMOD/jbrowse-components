---
name: lane-layers
description: "What ADR-180's config-declared lane layers still need after the spike: template layers that reach genomes the session lacks, the Hubs plugin's sequence answer and the jb2hubs star; genes stay out of laneLayers for now."
---

The spike is `laneLayers` on `MultiWaySyntenyDisplay`: a row of data per lane
from each genome's own track, drawn as bars through the lane's frame on one
shared scale ([ADR-180](../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md),
`laneLayers.ts`, `laneLayerConfigSchema.ts`).

## Next

1. **Template layers and genomes the session lacks.** A layer may name one
   `adapter` every lane reads through its own genome; core keys a
   `DERIVES_FROM_SEQUENCE` adapter per sequence (`e12f8ced81`), so it needs
   no `adapterId`. **The sequence reaches that adapter only through an
   assembly**: `loadRefNameMap`'s `CoreGetRefNames` primes it and
   `renameRegionsIfNeeded` derives it for every fetch. Never pass
   `sequenceAdapter` through an RPC by hand, `CoreGetRefNames` included, and
   never let renaming keep a caller's (Colin, 2026-09-27). A held lane needs
   nothing more. A described lane has no assembly, so it draws a template
   only once its genome becomes one. `hasAnnotation` stays off the layer
   sources so a layer never rebuilds `laneStack`. A zoom cap per lane, since
   a template reads its lane's whole fetch window of sequence.
2. **Hubs plugin and jb2hubs.** The description's sequence adapter carries
   `baseUri`, since jb2hubs writes a relative `chromSizes`. The star builder
   (`ucsc2jbrowse/src/multiwayStarTrack.ts`) writes a GC layer and grows its
   height and the gene-page link's lane pitch by the band.

## Not now

Genes as `laneLayers[0]`: a union array blinds `jbrowse validate`
(`generateConfigManifest.ts`), every `laneLayers` consumer indexes by
position, and placement boxes borrow the gene colours. It pays once a second
glyph layer (another annotation, repeats, assembly gaps) is wanted.
