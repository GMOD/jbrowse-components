---
name: deleting-the-alignments-dup-guard-dedupebyid
description: Deleting the alignments dup guard (`dedupeById`)
area: performance-and-measurement
---

# Deleting the alignments dup guard (`dedupeById`)

investigated 2026-08-11
and kept, though it is catching nothing today. `@gmod/bam`'s `blocksForRange`
runs `optimizeChunks`, which absorbs a chunk already covered by its neighbour:
~4800 index queries over the 20x/200x/1000x fixtures produced **zero**
overlapping chunk pairs — including where the 5MB merge cap fires, the only
branch that could push one — and fetching the benchmark window on all six
produced **zero** duplicate records. The motivation that is genuinely gone is
older than the code comment's: block rendering fetched adjacent overlapping
regions, so a feature spanning a boundary arrived twice. It stays because what
it prevents is silent (a doubled coverage depth, not a crash), because
`@gmod/bam` hit the same class in its own mate path and still guards it, and
because keying it on the record's number instead of its id string made it
nearly free anyway (12.5% → 5.9% of busy worker time).
