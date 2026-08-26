---
name: group-reads-by-sample-or-library-from-the-rg-header
description: needs an RG-to-SM/LB map from the adapter — the values are in the header's `@RG` lines, not in the record the generic tag dimension reads
---

# Group reads by sample or library, not just by read group

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. A feature, and the adapter has to grow a header map
before any of it is reachable.

`RG` already groups through the generic tag dimension, because it is a tag on
the record. `SM` and `LB` are not: they live in the header's `@RG` lines, so
grouping by either needs the adapter to hand over an RG→SM/LB map before
`groupFeatures` can resolve a read to one.

That map is the whole of the work — once a read resolves to a sample name, the
grouping is the dimension that already exists. Checked 2026-08-26: nothing in
`plugins/alignments` reads `SM`/`LB` off a header today.
