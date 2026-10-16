---
name: gmod-memory-hooks-for-the-embedded-engine
description: The embedded engine (@jbrowse/tables, ggjbrowse) bounds decoded records, chunks and indexes separately because three @gmod libraries expose no byte counts or limits. Three releases would let it hold one budget of real bytes, and the bgzf one also lowers a floor `limit` cannot touch.
---

# Memory hooks the embedded engine needs from @gmod

`packages/tables/src/cache.ts` keeps three bounds that share no space:
decoded records under `limit`, chunks under the chunk cache's fixed cap, and
adapters while their estimated index weight fits another `limit`. One budget
over real bytes would be simpler, and each piece below is what stops it.

- **`@gmod/bgzf-filehandle`: let the inflater's wasm memory shrink.** A
  `WebAssembly.Memory` only grows, so one large inflate pins its high-water
  mark for the life of the process. After one window of 1000x long reads the
  bundle in Node held about 262 MiB that `clearCache()` could not free, the
  biggest pool the engine cannot see. Re-instantiating the module once its
  memory passes about 64 MiB would return it.
- **`@gmod/bam`, `@gmod/tabix`, `@gmod/cram`: report what a parsed index
  holds.** The engine weighs an index by its file size times a per-format
  factor (BAI 4, CSI 5, CRAI 12, TBI 20), measured with five contigs read.
  A BAI holds 1.7x its file with one contig read and 4.2x with five, since
  `memoizeByRefId` keeps five decoded contigs. A `retainedBytes` getter, or a
  `maxMemoizedRefs` option, would replace the estimate.
- **`@gmod/range-cache-filehandle`: expose `setChunkCacheLimit` and
  `cachedBytes`.** The engine counts the bytes its host answered to range
  requests and clamps the count to `MAX_CACHE_ENTRIES * CHUNK_SIZE`, the only
  bound it can name. With both, chunks could join the decoded records under one
  `limit`.
