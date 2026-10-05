---
name: maf-encodes-its-channels-on-the-main-thread
description: MAF's encodeMafRows walks every fetched block on the main thread per fetch — buildMafChannels, then mafInsertionChannels at about a fifth of that again. Moving both to the worker is the fix if anything is; it waits on a main-thread time from a real MAF that says a reader feels it.
---

# MAF encodes its channels on the main thread

`encodeMafRows` (`plugins/maf/src/LinearMafDisplay/encodeMafRows.ts`) runs
`buildMafChannels` and `mafInsertionChannels` over a region's whole
`MafBlock` arena on the main thread for each fetch. The insertion walk costs
about a fifth of the channel encode over the same blocks, measured on
2026-10-02 when the shared insertion mark landed.

**If anything, both encodes move to the worker together**, which ships packed
channels rather than blocks. A lazy insertion index would only defer the
smaller fifth.

The encode reads the palette and `binBp`, so moving it means a toggle or a
zoom tier change re-asks the worker instead of re-encoding locally. That is
the trade to price.

**Waiting on:** main-thread milliseconds per fetch for `encodeMafRows` on a
real multi-species MAF at the zoom where bases
draw, against a frame budget. The synthetic fixture in
`plugins/maf/benches/mafOnMarks.bench.ts` times the channel encode in node
and says nothing about the frame.
