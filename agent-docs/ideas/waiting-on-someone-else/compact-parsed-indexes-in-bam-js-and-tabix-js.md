---
name: compact-parsed-indexes-in-bam-js-and-tabix-js
description: A parsed BAI, CSI or TBI holds up to 4x its uncompressed bytes as JS objects, and a CRAI about 4x, so the embedded engine can only estimate an adapter's weight. A `retainedBytes` getter would still be an estimate and `maxMemoizedRefs` would not shrink the HPRC TBI; the fix is compact index storage in bam-js, tabix-js and cram-js, justified by browser worker memory. The bgzf and range-cache hooks this note also asked for shipped.
---

# Compact parsed indexes in bam-js and tabix-js

`packages/tables/src/cache.ts` weighs an adapter at four times the
uncompressed size of each index it read whole, because no parser reports what
its parsed index holds. A BAI holds 1.7x its file with one contig read and 4.2x
with five, since `memoizeByRefId` keeps five decoded contigs as `Chunk` objects
and `VirtualOffset` arrays.

- **A `retainedBytes` getter would only be an estimate.** The parsers would
  have to sum object sizes V8 does not expose.
- **`maxMemoizedRefs` would not help the HPRC v2.1 segs TBI.** Its 605.7 MiB is
  the inflated index, which the `getIndices` closure keeps whole.
- **The fix is compact storage.** For BAI and CSI, keep the raw bytes plus a
  per-ref typed-array directory of bin offsets and decode a query's bins on
  demand, so a parsed index holds about its uncompressed size and its weight is
  known. For CRAI, keep the records as columnar typed arrays.
- **Browser worker memory justifies it.** A worker holds one parsed index per
  open track, and the embedded engine gains the same.
- **The change spans three repos.** `SYNC:` comments pair the index code in
  bam-js and tabix-js, so a change moves both, and cram-js holds the CRAI
  parser.

Shipped from this note's earlier list, adopted in `@jbrowse/tables`:

- `@gmod/bgzf-filehandle` 6.8.1 caps each wasm inflate at 8 MiB, so the
  inflater's wasm memory stays near 20 MiB. One 20 kb window of 1000x long
  reads left 261.9 MiB under 6.8.0 and 9.3 MiB under 6.8.1.
- `@gmod/range-cache-filehandle` 1.6.0 adds `setChunkCacheLimit` and
  `cachedBytes`, so `limit` bounds the chunks and `chunks` reports what the
  cache holds.
