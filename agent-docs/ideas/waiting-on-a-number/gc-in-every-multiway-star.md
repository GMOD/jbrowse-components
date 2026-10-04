---
name: gc-in-every-multiway-star
description: Before jb2hubs writes a GC lane layer into every hosted multiway star, measure what a lane's GC costs cold, once a @gmod/twobit release sizes its index read by typical names.
---

# GC in every multiway star

[ADR-180](../../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md)'s
lane layers draw a row of data per lane from each genome's own track, and a
described lane is a temporary assembly (`reference/MULTIWAY_SYNTENY_DISPLAY.md`
§"Settled invariants"). On hg38's hosted star at TP53 all nine lanes draw their
own genome's GC.

## The number it waits on

Cold at TP53, a chromosome-level lane reads 2.4-2.9 MB of 2bit, mostly its
chromosome's soft-mask block list, against about 1 MB for a gc5Base bigWig. A
scaffold-level lane reads far more under `@gmod/twobit` 6.0.12, whose
`getIndex` reads `sequenceCount * (1 + 255 + offsetSize)` bytes: bisBis1's 315k
scaffolds cost 118 MB, on any sequence read of that assembly. twobit-js
`e908bff` and `d7d1310` size that read by typical names (a few MB for bisBis1);
they are committed and unreleased. Release them, `pnpm update @gmod/twobit`,
and measure bisBis1 again.

## Then

The star builder (`ucsc2jbrowse/src/multiwayStarTrack.ts` in jb2hubs) writes
the layer and sizes each lane at 22 + 12 (gene names) + the band + 2. Its 22
is already short by the gene-name row, and the gene-page link's pitch (34)
grows by the band.

Genes as `laneLayers[0]` is not part of it: a union array blinds
`jbrowse validate` (`generateConfigManifest.ts`), every `laneLayers` consumer
indexes by position, and placement boxes borrow the gene colours. It pays once
a second glyph layer (another annotation, repeats, assembly gaps) is wanted.
