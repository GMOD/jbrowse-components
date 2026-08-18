---
name: maf-long-block-fetch-cost
description: The MAF-tabix fetch cost on megabase alignment blocks — designed in full, parked because the premise cannot be confirmed in this repo. What the reporter would have to send before any of it is worth building.
---

# MAF fetch cost on long blocks

Parked, not declined. The design is finished and lives in
[reference/MAF_LARGE_BLOCKS.md](../reference/MAF_LARGE_BLOCKS.md) — the layer
costs, why "clip to the visible region" is the wrong fix, and the three options
that are not. Nothing is built.

**What parks it is that the premise cannot be checked here.** The whole design
assumes a user's alignment blocks really are enormous, and that started as
speculation from a bug report carrying no sample data ("plugins/maf is slow and
crashes", "potentially each alignment is long"). One line settles it against a
real file:

```sh
bgzip -dc their.bed.gz | awk '{print $3-$2}' | sort -n | tail -5
```

The widest single line across every MAF-tabix file this repo can reach is
**20 kb** — `test_data/ce11.26way.chrI_subset.bed.gz` maxes at 1,228 bp,
`test_data/volvox/volvox.maf.bed.gz` is 100 bp flat, and the synthesized
250-column bench fixture tops out at 1,995 bp. Long blocks are a property of the
*producer* (`hal2maf` without chunking, pairwise chains and nets converted to
MAF), not of MAF generally, so no fixture in tree reproduces the reported
symptom and none can be synthesized into evidence that it happens to anyone.

So the entry moves here rather than staying an action item: it is waiting on a
file, and until one arrives every build decision on it is guessing at a
distribution nobody has seen.

**Pick it up when a reporting user sends a `.bed.gz`.** Run the line above
first. If the max block is a few kb, stop and say so — blocks are not that
user's problem, and the worker-side allocation in MAF_LARGE_BLOCKS.md's "Still
open" is where to look instead.

**The byte-gate half already closed on its own**, so don't re-open it: the gate
no longer scales an estimate by span, it re-measures at the viewport it is
judging, which is what makes a cost quantized by feature measured rather than
modelled (REGION_TOO_LARGE.md §"Measurement follows the viewport").
