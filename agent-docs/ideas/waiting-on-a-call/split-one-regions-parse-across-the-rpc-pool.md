---
name: split-one-regions-parse-across-the-rpc-pool
description: "A deep alignments window (100x over 1 Mb, BAM) draws at 3.96 s with one render worker busy 2.6 s of it. Each line item is a 3-7% cut; only splitting one region's parse across the RPC pool gives 2x or more, and that is a design call against ADR-053 and the CRAM slice-decode finding."
---

# Split one region's parse across the RPC pool

The profile in [COLD_LOAD_PROFILE.md](../../reference/COLD_LOAD_PROFILE.md)
§"Deep windows" puts `extractFeatureArrays` at 608 ms, BGZF unzip 378 ms,
coverage 309 ms and `@gmod/bam` parsing 285 ms inside one worker. Trimming any
line returns 3-7%. Dividing one region's parse across workers could return 2x or
more.

The call to make weighs it against
[ADR-053](../../architecture-decision-records/adr-053-alignments-layout-stays-on-the-main-thread.md),
[CRAM_STACK_INTEGRATION.md](../../reference/CRAM_STACK_INTEGRATION.md)
§"Slice-decode parallelism is not the lever",
[copies-between-each-parser-and-its-instance-buffer](../waiting-on-a-number/copies-between-each-parser-and-its-instance-buffer.md)
and [collections/alignments](../collections/alignments.md).
