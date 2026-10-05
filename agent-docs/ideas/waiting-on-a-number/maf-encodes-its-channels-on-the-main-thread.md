---
name: maf-encodes-its-channels-on-the-main-thread
description: MAF's encodeMafRows walks every fetched block on the main thread per fetch — buildMafChannels, then mafInsertionChannels at about a fifth of that again. Nobody knows the main-thread share at a real zoom; the encode cannot move to the worker without refetching on every colour or order edit, so a number that says a reader feels it buys a lane split, not a move.
---

# MAF encodes its channels on the main thread

`encodeMafRows` (`plugins/maf/src/LinearMafDisplay/encodeMafRows.ts`) runs
`buildMafChannels` and `mafInsertionChannels` over a region's whole
`MafBlock` arena on the main thread for each fetch. The insertion walk costs
about a fifth of the channel encode over the same blocks, measured on
2026-10-02 when the shared insertion mark landed.

**The encode stays on the main thread.** It reads the palette, the identity
ramp, the source-chromosome colours, the row order and the codon toggles, all
of which an edit changes without a refetch, as ADR-202 keeps every mark colour.
Moving it to the worker turns each of those edits into a fetch, or keeps a
second encoder that has to agree with this one forever — the obstacle
[wiggle-instance-packing-moves-to-the-worker](../waiting-on-a-call/wiggle-instance-packing-moves-to-the-worker.md)
found for wiggle.

**If the number says a reader feels it**, split the lanes instead: the worker
ships what no edit moves (cell positions, base codes, the row each block row
lands on) and the main thread writes colour and order over them, the first of
the three designs in
[alignments-still-repacks-every-row-instanced-pass-on-the-main-thread](alignments-still-repacks-every-row-instanced-pass-on-the-main-thread.md).

**Waiting on:** `encodeMafRows` milliseconds per fetch, apart from the worker's
pack and `placeMafRegionData`, at the zoom where bases draw over 26 and 470
species. `typed-sources-maf-display` times all three together over a whole
fixture region at a base a cell
(94.4-203.8ms<!--m:typed-sources-maf-display.mafMs.range-->), which says neither which thread
pays nor what a real window costs. `plugins/maf/benches/mafOnMarks.bench.ts`
is the harness to split.
