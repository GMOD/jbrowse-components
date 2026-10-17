---
name: compact-parsed-indexes-in-bam-js-and-tabix-js
description: A parsed BAI, CSI or TBI holds up to about 4.2x its uncompressed bytes as JS objects, and a CRAI about 4.3x, so the embedded engine can only estimate an adapter's weight. A `retainedBytes` getter would still be an estimate and `maxMemoizedRefs` would not shrink the HPRC TBI; the fix is compact index storage in bam-js, tabix-js and cram-js, justified by browser worker memory.
---

# Compact parsed indexes in bam-js and tabix-js

`packages/tables/src/cache.ts` weighs an adapter at four times the
uncompressed size of each index it read whole, because no parser reports what
its parsed index holds. A BAI holds 1.7x its file with one contig read and 4.2x
with five, since `memoizeByRefId` keeps five decoded contigs as `Chunk` objects
and `VirtualOffset` arrays, and a CRAI holds 4.3x.

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
