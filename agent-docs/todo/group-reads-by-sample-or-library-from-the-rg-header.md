---
name: group-reads-by-sample-or-library-from-the-rg-header
description: needs an RG-to-SM/LB map from the adapter — the values are in the header's `@RG` lines, not in the record the generic tag dimension reads
metadata:
  area: alignments
  category: ready
---

# Group reads by sample or library, not just by read group

`RG` already groups through the generic tag dimension, because it is a tag on
the record. `SM` and `LB` are not: they live in the header's `@RG` lines, so
grouping by either needs the adapter to hand over an RG→SM/LB map before
`groupFeatures` can resolve a read to one.

That map is the whole of the work — once a read resolves to a sample name, the
grouping is the dimension that already exists. Checked 2026-08-26: nothing in
`plugins/alignments` reads `SM`/`LB` off a header today.
