---
name: gc-in-every-multiway-star
description: jb2hubs writes a GC lane layer into every hosted multiway star, computed from the sequence by GCContentAdapter. A chromosome-level lane reads 2.4-2.9 MB of 2bit cold; a scaffold-level lane adds its name index, 9.5 MB for bisBis1 since @gmod/twobit 6.0.13.
---

# GC in every multiway star

[ADR-180](../../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md)'s
lane layers draw a row of data per lane from each genome's own track, and a
described lane is a temporary assembly (`reference/MULTIWAY_SYNTENY_DISPLAY.md`
§"Settled invariants"). On hg38's hosted star at TP53 all nine lanes draw their
own genome's GC.

## The source is the sequence

A lane layer takes either `tracks`, one catalog track per lane, or an adapter
computing from the sequence (`laneLayerConfigSchema.ts`). The builder writes
`{ type: 'GCContentAdapter' }`, which draws a better band than `gc5Base` and
needs no per-genome track.

Cold at TP53 a chromosome-level lane reads 2.4-2.9 MB of 2bit, mostly its
chromosome's soft-mask block list, against about 1 MB for a `gc5Base` bigWig.
A scaffold-level lane also reads the 2bit's whole name index on its first
sequence read: 9.5 MB for bisBis1's 450,182 scaffolds under `@gmod/twobit`
6.0.13, measured 2026-10-08 against UCSC's hosted file, down from 117 MB under
6.0.12.

## The builder

The star builder (`ucsc2jbrowse/src/multiwayStarTrack.ts` in jb2hubs) writes
the layer and sizes each lane at 22 + 12 (gene names) + the band + 2. Its 22
is already short by the gene-name row, and the gene-page link's pitch (34)
grows by the band.

Genes as `laneLayers[0]` is not part of it: a union array blinds
`jbrowse validate` (`generateConfigManifest.ts`), every `laneLayers` consumer
indexes by position, and placement boxes borrow the gene colours. It pays once
a second glyph layer (another annotation, repeats, assembly gaps) is wanted.
