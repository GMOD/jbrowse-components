---
name: gc-in-every-multiway-star
description: jb2hubs writes a GC lane layer into every hosted multiway star from each genome's gc5Base bigWig, about 1 MB a lane cold. Not GCContentAdapter over the 2bit, whose name index costs a scaffold-level lane 118 MB.
---

# GC in every multiway star

[ADR-180](../../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md)'s
lane layers draw a row of data per lane from each genome's own track, and a
described lane is a temporary assembly (`reference/MULTIWAY_SYNTENY_DISPLAY.md`
§"Settled invariants"). On hg38's hosted star at TP53 all nine lanes draw their
own genome's GC.

## The source is the bigWig, not the sequence

A lane layer takes either `tracks`, one catalog track per lane, or an adapter
computing from the sequence (`laneLayerConfigSchema.ts`). The builder writes
`tracks`, naming each genome's `gc5Base` bigWig: about 1 MB a lane cold at
TP53, whatever the assembly's shape.

`GCContentAdapter` over the 2bit is the wrong source for a hosted star. A
chromosome-level lane reads 2.4-2.9 MB, mostly its chromosome's soft-mask
block list, and a scaffold-level lane pays for the 2bit's name index on any
sequence read: 118 MB for bisBis1's 315k scaffolds under `@gmod/twobit`
6.0.12. A later twobit release shrinks that index read, and the star still
does not depend on it.

A genome whose hub carries no `gc5Base` gets no GC band.

## The builder

The star builder (`ucsc2jbrowse/src/multiwayStarTrack.ts` in jb2hubs) writes
the layer and sizes each lane at 22 + 12 (gene names) + the band + 2. Its 22
is already short by the gene-name row, and the gene-page link's pitch (34)
grows by the band.

Genes as `laneLayers[0]` is not part of it: a union array blinds
`jbrowse validate` (`generateConfigManifest.ts`), every `laneLayers` consumer
indexes by position, and placement boxes borrow the gene colours. It pays once
a second glyph layer (another annotation, repeats, assembly gaps) is wanted.
