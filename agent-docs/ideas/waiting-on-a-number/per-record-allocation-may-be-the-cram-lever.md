---
name: per-record-allocation-may-be-the-cram-lever
description: A deep CRAM render spends 12% of the RPC worker in GC while the slice workers starve; one feature object per record is the suspect, and a CRAM allocation profile has to confirm it before anyone goes columnar.
---

# Per-record allocation may be the CRAM lever

The slice workers are starved and the RPC worker spends 12% (724 ms) in GC on a
1000x short-read render
([CRAM_STACK_INTEGRATION.md](../../reference/CRAM_STACK_INTEGRATION.md)
§"Slice-decode parallelism is not the lever"). The hypothesis it is consistent
with, not a measured finding, is that we allocate one `CramSlightlyLazyFeature`
per record (153,677 for that fixture) and then serialize the lot out of the
worker.

- `@gmod/cram` already solved this inside itself with the read-feature arena
  and the tag/quality columns, stopping one layer short of us. If the
  hypothesis holds, the fix is columnar all the way to the renderer rather than
  a wrapper per read.
- The BAM analogue is profiled as `alignments-memory-per-read`
  ([BAM_STACK_INTEGRATION.md](../../reference/BAM_STACK_INTEGRATION.md)
  §"What a read costs in memory"): per-read feature objects, mismatch entries
  and wrappers are 125 of 276 peak worker heap bytes per read, and none is kept.

The number to take first: a CRAM allocation profile of that render.
